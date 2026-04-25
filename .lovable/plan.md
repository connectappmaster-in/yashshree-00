# Deep audit — bugs & improvements

I went through every route, lib, server function, RLS policy, security scan and the latest migrations. Most of the previous "bug-fix sweep" plan is shipped; below are everything still broken, plus fresh findings from this pass, grouped by severity.

---

## 🔴 P0 — Must fix now

### S0. Runtime syntax error in `attendance.tsx`
Build is currently failing with `Unexpected token (72:3)` — leftover stray `});` from the `students_safe` migration edits. Fix the structure of `MarkTab()` so the student-source helper sits cleanly inside the `useQuery`.

### S1. Payment edit/delete missing (you approved adding it)
`payments` table is admin-only by RLS, but the UI never lets admins fix typo'd amounts/dates/modes/notes — they're stuck forever. Add:
- Inline **Edit** + **Delete** action buttons in the payment-history table on `fees.tsx`.
- `AlertDialog` confirm on delete with student name + amount.
- Audit entries: `update`/`delete` on `payment` entity with old & new values.
- Re-invalidate `payments` and `students` queries on success.

### S2. Teacher attendance scope (you approved narrowing)
Today any teacher can mark attendance for any student. Tighten by:
1. **DB**: new `teacher_classes` table (`teacher_id`, `class`, `batch`, `academic_year`, unique on the 4-tuple). RLS: admins ALL, teachers SELECT own rows.
2. **DB**: replace teacher INSERT/UPDATE policies on `attendance` with predicates that require the student's `(class, batch, academic_year)` to exist in the teacher's `teacher_classes`. Use a SECURITY DEFINER helper `teacher_can_mark_student(_student_id uuid)` to keep RLS simple.
3. **UI**: in `attendance.tsx` `MarkTab`, scope the student list for teachers to their assigned (class, batch). Admins continue to see all.
4. **UI**: in admin Users management, add an "Assigned Classes" mini-editor on the teacher row (multi-pick of `class` × `batch`) — writes `teacher_classes`.
5. Audit `teacher_classes` create/delete.

---

## 🟠 P1 — Functional bugs still present

### B1. React key inside fragment (warning every render)
`whatsapp-logs.tsx` line 191: the `<>...</>` returned from `.map()` has no key. Replace with `<React.Fragment key={log.id}>` and drop the inner `key=` props.

### B2. `users.functions.ts` audit inserts bypass `log_audit_event` & don't stamp `user_email`
`createUser`, `updateUser`, `deleteUser` insert directly into `audit_logs` via service role with `user_email = null`. Stamp `user_email` from `assertAdmin()` (look up email once) so the audit page shows who did it.

### B3. `AdminGuard` side-effect navigation
`AdminGuard.tsx` calls `router.navigate` in `useEffect` — flashes the protected page for one frame. Convert each admin route (fees, reports, whatsapp-logs, audit, users, teachers) to use `beforeLoad: ({ context }) => assertAdminOrRedirect()`. Reduce `AdminGuard` to a defensive wrapper that just hides children when role is wrong.

### B4. `onAuthStateChange` re-fetches role on every TOKEN_REFRESHED
Every ~50 minutes the entire app re-renders. Filter the handler to `SIGNED_IN`/`SIGNED_OUT`/`USER_UPDATED` only.

### B5. `lectures` partial-unique missing → race-condition duplicates
"Warn before duplicate" relies on SELECT-then-INSERT. Two simultaneous "Log Lecture" submits both pass the check and both insert. Add partial unique index `(teacher_id, date, subject, batch, academic_year)`; convert the duplicate detection to catch the unique-violation error.

### B6. `window.confirm` still used in 3 places
- `teachers.tsx:369` — duplicate lecture
- `tests.tsx:225` — over-cap marks
- `students.tsx:678` — over-pay (extra payment)

Migrate all three to shadcn `AlertDialog` for theme consistency.

### B7. `as any` casts on `board` (stale)
The Supabase-generated type for `students` already includes `board` — drop the `(s as any).board` casts in `students.tsx` (4×), `fees.tsx` (1×), `reports.tsx` (3×) and let TS prove it.

### B8. Recharts statically imported on dashboard / students / reports
Adds ~70KB gz to first paint. Wrap each chart panel in `React.lazy` + `Suspense` fallback. Note: `dashboard.tsx` is the biggest win and the most visited screen.

### B9. Dashboard derived data recomputed every render
Class distribution, MoM delta, top pending, monthly chart array, attendance %, newest admissions — all are recalculated on every state change (e.g. the `showCollected` toggle re-runs `studentPending.map`). Wrap each in `useMemo` keyed on the related queries.

### B10. Sequential `for` loop upserts (3 places)
- `attendance.tsx` line ~195 (student attendance save)
- `teachers.tsx` line ~241 (teacher attendance save)
- `tests.tsx` line ~241 (marks save)

Replace each with a single batched `.upsert(arr, { onConflict: "..." })` — one round-trip instead of N.

### B11. `bulkPending` builds a throwaway URL just to validate mobile
`fees.tsx` line 97 calls `buildWhatsAppUrl()` then discards it just to test validity. Use `sanitizeMobile(s.mobile)` directly.

### B12. `audit.tsx` search OR clause not escaped
A user typing `,`, `%`, `_`, `(`, `)` in the search box breaks `q.or(\`user_email.ilike.%${s}%,entity_id.ilike.%${s}%\`)`. Escape these chars before building the OR string.

### B13. `whatsapp-logs.tsx` Broadcast still uses `setTimeout`-in-loop
Line 272: `setTimeout(() => window.open(url, "_blank"), i * 600)`. If the user navigates away the timers still fire and pop-ups blast the new screen. Refactor to the same sequential `await new Promise(r=>setTimeout(r,700))` queue with progress toast and `AlertDialog` confirm — same pattern already used in `fees.tsx` bulk-remind.

### B14. `inr()` adoption still incomplete
~10 sites still build `₹${n.toLocaleString("en-IN")}` by hand (dashboard.tsx 4×, students.tsx 2×, teachers.tsx 1×). Single global swap to `inr(x)` so a future currency/format change is one file.

### B15. `printReceipt` receipt number can collide
`Date.now().toString().slice(-8)` — two payments in the same ms get the same number. Use the freshly-inserted payment row id (`ins.id.slice(0,8)`) instead, and only render the Print button after the payment is recorded.

---

## 🟡 P2 — UX & polish

### U1. Per-route `errorComponent` still missing on every `_authenticated/*` file
Only the global `defaultErrorComponent` catches today. Add `errorComponent: RouteError` to all 10 admin routes (the component already exists — `src/components/RouteError.tsx`).

### U2. Loading skeletons
Students/Teachers/WhatsApp-logs/Audit tables still show "Loading…" text. Use the existing `loading-skeleton` component for visual consistency.

### U3. `aria-label` on icon-only buttons
Many ghost icon-only buttons in fees/teachers/tests/whatsapp-logs (send/resend/edit/delete/print) lack `aria-label`. Add for keyboard + screen-reader accessibility.

### U4. Hardcoded pass mark = 50
`tests.tsx` line 293 hardcodes `pct >= 50` for green/red. Read from `app_settings` key `pass_mark` with default 35. (Earlier plan noted this.)

### U5. Empty-state usage incomplete
`EmptyState` exists; only used in audit + whatsapp-logs. Apply to: tests list (no tests / filter mismatch), attendance history (no days), students table (no results), reports tabs.

### U6. Form-level zod validation
Students form does inline `if (!/^\d{10}$/.test(mobile))` mixed with mutation. Centralise with a `studentSchema` zod (mobile regex, fees ≥ 0, discount 0..total_fees, due_day 1..28). Same for `teachers` form (`fixed_salary ≥ 0`, `per_lecture_fee ≥ 0`).

### U7. Audit "Export CSV" exports current page only
Button label says "Export CSV" but only exports `rows` (the visible page). Add a second button **"Export filtered (all pages)"** that fetches without `range()` and respects all current filters.

### U8. Bulk-remind count visibility
`fees.tsx` Bulk Remind button doesn't show how many students will be messaged. Display `Bulk Remind (N)`.

---

## 🟢 P3 — Performance & DB

### P1. Missing DB indexes (one migration, zero-risk)
Add:
- `audit_logs(created_at desc)` — pagination
- `audit_logs(action)`, `audit_logs(entity)` — filters
- `whatsapp_logs(sent_at desc)`, `whatsapp_logs(student_id)` — feed + per-student lookup
- `payments(student_id)`, `payments(payment_date)` — fee aggregation & month buckets
- `attendance(date)`, `attendance(student_id, date)` — per-day & per-student
- `lectures(teacher_id, date)` — teacher dashboard
- `test_results(test_id)`, `test_results(student_id)` — marks pages
- `students(academic_year, status)` — most lists scope on this

### P2. `select("*")` everywhere
Most queries don't need every column. Biggest wins:
- `payments.select("id, student_id, amount, payment_date, payment_mode, academic_year, notes")`
- `attendance.select("id, student_id, date, status")`
- `whatsapp_logs.select("id, student_id, message, type, sent_at")`
- `tests.select("id, name, standard, subject, test_date, max_marks, academic_year")`

### P3. Default 1000-row cap unhandled
`payments-all`, `attendance-all`, `test-results` (no filter) silently truncate at 1000 rows. Add explicit `.range()` or scope by `academic_year` consistently and surface a "(showing first 1000)" hint when capped.

---

## ✅ Already shipped (no work)
- Audit log spoofing → `log_audit_event` + `log_audit_event_anon` RPCs in place; `audit_logs` insert policy dropped.
- XSS in print receipt → escaped with `esc()` and `win.print()` from parent window.
- Student mobile hidden from teachers → `students_safe` view + `studentsReadFrom(isAdmin)` helper.
- Login `validateSearch` for redirect-back.
- Bulk-remind sequential queue with progress toast (fees only).
- AlertDialog for over-payment in fees PaymentForm.
- Copy-from-yesterday 14-day lookback.
- Resend re-validation in WhatsApp logs.

---

## ⏭ Out of scope (deferred / cannot fix here)
- **Leaked-password protection (S6)** — single Supabase dashboard toggle, no code/migration can do this.
- Landing-page hash-anchor → split routes (low priority; SEO concern only for marketing site).
- Pre-computed Postgres views for chart aggregation (defer until >5k payments).

---

## Files touched

**Edited (~16)**
- `src/routes/_authenticated/attendance.tsx` — fix syntax error, narrow teacher view, batch upsert, empty state
- `src/routes/_authenticated/fees.tsx` — payment edit/delete UI, drop `as any`, `inr()`, `aria-label`, receipt # from row id, batched validation
- `src/routes/_authenticated/whatsapp-logs.tsx` — fragment-key fix, broadcast queue + AlertDialog, loading skeleton, aria-labels
- `src/routes/_authenticated/teachers.tsx` — AlertDialog, batched teacher attendance upsert, `inr()`, aria-labels, loading skeleton, lecture unique-violation handling
- `src/routes/_authenticated/tests.tsx` — AlertDialog, pass_mark from `app_settings`, batched marks upsert, empty state
- `src/routes/_authenticated/students.tsx` — drop `as any`, AlertDialog, zod schema, `inr()`, loading skeleton, empty state
- `src/routes/_authenticated/dashboard.tsx` — `useMemo` everywhere, lazy recharts, `inr()`, scoped column selects
- `src/routes/_authenticated/reports.tsx` — drop `as any`, lazy recharts, `inr()`, scoped column selects
- `src/routes/_authenticated/audit.tsx` — search escaping, "Export filtered (all pages)" button
- `src/routes/_authenticated/users.tsx` — `beforeLoad` admin guard, "Assigned Classes" mini-editor for teachers
- `src/lib/auth-context.tsx` — filter `onAuthStateChange` events
- `src/components/AdminGuard.tsx` — convert to defensive wrapper
- `src/utils/users.functions.ts` — stamp `user_email` in audit inserts
- All 10 `_authenticated/*` route files — add `errorComponent: RouteError`

**New / migrations**
- `supabase/migrations/<ts>_indexes_and_lecture_unique.sql` — DB indexes + partial unique on `lectures`
- `supabase/migrations/<ts>_teacher_classes_scope.sql` — `teacher_classes` table + `teacher_can_mark_student()` SECURITY DEFINER helper + new `attendance` RLS policies for teachers

**Dependencies**: none new.

---

After this sweep the only remaining security warning is **Leaked Password Protection** (manual Supabase dashboard toggle).