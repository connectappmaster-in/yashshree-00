
## Deep audit — Round 3 findings

I went through the entire codebase end-to-end. Things are in good shape after the previous passes — most of what's left is one **functional gap** (teacher-class assignment), one **real RLS hole** flagged by the security scanner, and a batch of polish/perf items.

---

### 🔴 Critical / functional bugs

1. **`teacher_classes` table exists, but no UI to populate it.**
   - `attendance` RLS for teacher INSERT/UPDATE relies on `teacher_can_mark_student(student_id)`, which checks a row in `teacher_classes`.
   - Result today: **a teacher can mark attendance for zero students** because `teacher_classes` is always empty. Attendance saves silently fail (RLS rejects every row, but our batched `.upsert` only surfaces a generic error).
   - Fix: add an "Assigned Classes" section on the Teachers admin page. Multi-select of `class × batch`, scoped to the current AY. Wire to `teacher_classes` with RLS (admins only — already in place).

2. **RLS gap flagged by scanner: `attendance` SELECT for teachers is too broad.**
   - Current policy `Teachers view attendance` uses just `has_role(auth.uid(), 'teacher')` — every teacher can read every attendance row in the institution (leaking student_ids and presence patterns across classes they don't teach).
   - Fix: tighten the policy to `has_role(auth.uid(), 'teacher') AND teacher_can_mark_student(student_id)`, mirroring the INSERT/UPDATE policy. Once `teacher_classes` is populated, teachers see only their own classes.

3. **`UsersPage` still has a render-time admin redirect (flash + double-guard).**
   - Lines 129–133 of `src/routes/_authenticated/users.tsx`: `if (!isAdmin) { toast.error(...); router.navigate(...) }`. With `beforeLoad: requireAdmin` already in place, this branch is unreachable for non-admins **and** triggers a navigate during render (React warning) if it ever did fire.
   - Fix: drop the render-time guard. The `beforeLoad` and the `isReady` early return are sufficient.

4. **Dashboard `StatCard` typed `to: string` but uses `<Link to={to}>`.**
   - TanStack Router `<Link to>` is a typed union of route paths, not a free string. This silently fails type-check in stricter setups (currently passes only because of a wider inferred type). Type as `LinkProps['to']` from `@tanstack/react-router` (or a string-union of valid routes) for safety.

5. **Dashboard pie colors use CSS vars that aren't all defined.**
   - `PIE_COLORS` includes `var(--info, #6366f1)` but other entries (`--secondary`, `--warning`) may render as transparent/wrong if the design tokens don't exist (need to verify in `styles.css`). Quick fix: switch to known palette tokens and hex fallbacks for each.

---

### 🟡 Bugs & correctness issues

6. **`AdminGuard.tsx` is dead code.** No file imports it after the refactor. Delete the file and shrink the bundle.

7. **`students.tsx` still has a duplicate inline `PaymentForm` (lines ~647–end).** It's a near-clone of the one in `fees.tsx` but **without** `onConflict`, **without** student name in the audit log, and **without** the over-payment confirm wired through correctly (it does have a confirm, but the receipt printing logic from `fees.tsx` isn't there). Either:
   - extract a shared `PaymentForm` component, or
   - delete the inline copy in `students.tsx` and reuse the dialog from `fees.tsx`.
   Right now there are two slightly different payment-recording paths — bug-prone.

8. **`reports.tsx`: monthly-payment & teacher-attendance queries ignore AY when month is from a different AY.**
   - `monthPayments` filters only by date range, ignoring AY (good intent for cross-AY reporting), but the **stats card legend** says "AY {year}" — misleading. Either label it "(across years)" or filter by AY.

9. **`whatsapp-logs.tsx`: filter `type` dropdown lists `attendance` and `test`, but the codebase only ever inserts `reminder`, `broadcast`, and `attendance`** (from `reports.tsx`). `test` and `other` are dead options. Remove them so users don't filter for nothing.

10. **`fees.tsx` `PaymentForm.printReceipt` opens popup before save.**
   - The `Print` button is now disabled until `savedPaymentId` is set, so this is fine in the current flow — but `setTimeout(() => onSuccess(), 1500)` (line 529) means the dialog auto-closes 1.5s after save, sometimes **before the user clicks Print**. Increase to ~5s, or close only when user explicitly closes.

11. **`attendance.tsx` `streakMap` recomputes against `filtered` (which mutates whenever `attendance` state changes).** Causes the streak Flame badge to flicker as the user toggles present/absent. Memoize against `students` + `monthlyAttendance` only (not draft state).

12. **`tests.tsx` overEntries ignores draft marks** — `initialMarks(s.id)` reads either draft `marks[sid]` OR the saved value. But `useMemo` deps only include `marks`, `results`, `students`, `test.max_marks`. When the user changes a draft value, the memo recomputes correctly — actually fine. **But:** the draft is reset on test change via `useEffect(() => setMarks({}), [test.id])`. That's OK; no fix needed. *(Removing this from the action list — false positive on re-read.)*

13. **`audit.tsx`: search escaping doesn't escape backslash.** A user typing `\` produces an invalid escape sequence in the PostgREST `or()` filter. Add `\\` to the escape regex.

14. **`logout()` in `auth-context.tsx` calls `logAudit` AFTER `signOut`** would be safer flipped — current code logs first then signs out, which is correct. *(Verifying — yes, line 120 logs before line 121 signOut. OK.)*

15. **`buildWhatsappUrl` always prefixes `91`.** If a user enters a 10-digit number that's already country-code-prefixed (rare here, but possible in a real deployment), it double-prefixes. Lock to 10 digits via `sanitizeMobile` (already done) — keep, but document that this is India-only.

---

### 🟢 Performance & polish

16. **`payments-all` is fetched on every page (Dashboard, Students, Fees, Reports) and never paginated.** As payments grow past a few thousand it'll start showing the 1000-row Supabase cap and silently truncate. 
    - Short-term: bump `staleTime` to 5 min and add `range(0, 9999)` to lift the implicit limit.
    - Medium-term: switch totals to a server-side aggregate (RPC `get_payment_totals(year)` returning per-student paid sums).

17. **`recharts` is bundled into the main entry** because Dashboard, Students, and Reports import it eagerly. Lazy-load via `React.lazy(() => import('recharts'))` on Dashboard (biggest win — dashboard is the post-login landing).

18. **`dashboard.tsx` runs five separate `useQuery` calls for the same `payments` table.** Collapse `payments` + `ayPayments` + `monthAttendance` to fewer round trips, and memoize the derived stats with `useMemo` so changing `showCollected` doesn't re-derive everything.

19. **Add `errorComponent: RouteError` to all 9 remaining authenticated routes** (only `fees.tsx` has it). Currently routes fall back to the generic `defaultErrorComponent`, losing the contextual "Try again" UX.

20. **Standardize INR formatting.** Use `inr()` everywhere instead of inline `₹${n.toLocaleString("en-IN")}`. ~25 call sites across `dashboard.tsx`, `students.tsx`, `teachers.tsx`, `reports.tsx`. Pure cleanup, no behavior change.

21. **Add `EmptyState` to remaining tables** (teachers salary table, reports tabs, marks-entry table). `audit.tsx` and `whatsapp-logs.tsx` already use it.

22. **Remove `<Card> <Card>` nesting in `students.tsx` left pane** (filter card + table card with separator gives a cleaner look on mobile — current double border looks heavy).

---

### Manual / external

23. **Leaked Password Protection still disabled in Supabase Auth.** [Toggle here](https://supabase.com/dashboard/project/hkzytmnbqfmvknvqpsmc/auth/providers) — one-click, then this finding clears.

24. **Supabase linter: 15 `SECURITY DEFINER` function warnings.** These are expected for our helper functions (`has_role`, `teacher_can_mark_student`, `current_user_teacher_id`, `log_audit_event`, etc.) — they need definer rights to bypass RLS for the lookups they perform. We can either:
    - leave as-is and ignore the warnings (they're WARN, not ERROR), or
    - explicitly `REVOKE EXECUTE ... FROM anon` on each, keeping `authenticated` execute rights. Recommended for the 7 anon-callable ones.

---

## Proposed action plan (in dependency order)

### Migrations
- **M1**: Tighten `attendance` SELECT policy for teachers to `... AND teacher_can_mark_student(student_id)`.
- **M2**: `REVOKE EXECUTE ... FROM anon` on the 7 SECURITY DEFINER functions that don't need anon access (keeps `log_audit_event_anon` callable).

### Code — high impact
- **C1**: Add Teacher-Class assignment UI on Teachers page (admin-only). Multi-select class+batch matrix per teacher, scoped to AY, writes to `teacher_classes`.
- **C2**: Delete `src/components/AdminGuard.tsx` (dead code).
- **C3**: Drop the render-time admin guard in `users.tsx`.
- **C4**: Extract `PaymentForm` to `src/components/payment-form.tsx`, reuse in both `students.tsx` and `fees.tsx`. Remove the in-file copies.
- **C5**: Add `errorComponent: RouteError` to the other 8 authenticated routes (dashboard, students, attendance, audit, teachers, tests, reports, users, whatsapp-logs).
- **C6**: Lazy-load `recharts` in `dashboard.tsx` (and `students.tsx`, `reports.tsx`) via `React.lazy` + `Suspense`.

### Code — polish
- **P1**: Replace `whatsapp-logs.tsx` filter dropdown options with the actually-used types (`reminder`, `broadcast`, `attendance`).
- **P2**: Fix `audit.tsx` search escaping to also escape `\`.
- **P3**: Fix `attendance.tsx` `streakMap` deps (`students` + `monthlyAttendance`, not `filtered` which depends on draft state).
- **P4**: Fix `dashboard.tsx` pie palette (use only known tokens; provide hex fallbacks).
- **P5**: Fix `fees.tsx` PaymentForm receipt window — increase auto-close to 5s or remove.
- **P6**: Standardize `inr()` everywhere (25 sites).
- **P7**: Bump `staleTime` and lift row cap on `payments-all` in queries.
- **P8**: Cleanup unused `useEffect` import / dead types if any after the above edits.

Want me to execute the **Migrations + C1–C6 + P1–P5** in one go and skip the cosmetic ones (P6, P8) for a follow-up? Or include everything?
