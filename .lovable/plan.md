# Deep audit — bugs, security & improvements found

I went through every route, lib, server function, RLS policy, security scan output and the latest migration. Below is everything still broken or worth improving, grouped by severity.

---

## 🔴 P0 — Security & correctness (must fix)

### S1. XSS in print receipt (flagged by scanner)
`src/routes/_authenticated/fees.tsx` `printReceipt()` uses `document.write()` with raw template-string interpolation of `studentName`, `notes`, `mode`, `date`. The popup shares the same origin, so injected `<script>` reads `localStorage` (Supabase JWT). Fix: HTML-escape every interpolated value (or rebuild via DOM API).

### S2. Receipt popup also uses inline `<script>` to print
That inline script triggers same XSS surface. Replace with `win.print()` called from the parent window after `win.document.close()`.

### S3. Lecture-form `unique` index missing
"Warn before duplicate" relies on a SELECT-then-INSERT race. Two simultaneous "Log Lecture" submits both pass the check and both insert. Add a partial unique index `(teacher_id, date, subject, batch, academic_year)` (allow NULL gaps); convert duplicate detection to catch the unique-violation error.

### S4. `payments` has no UPDATE/DELETE policy gap is fine, but no admin UPDATE either
RLS on `payments` only has the catch-all "Admins full access" — that's correct. But the UI never deletes or edits a payment once recorded, even when a typo lands. **Bug**: there is no "Edit / Delete" button on payment history rows. Add admin-only edit + delete with audit trail entries.

### S5. `attendance` teacher policies allow any teacher to mark any student
Acceptable v1 (you said), but worth narrowing with a `teacher_classes` mapping later. **No code change in this plan; just calling it out.**

### S6. Leaked-password protection still disabled
Supabase linter still warns. This is a single dashboard toggle — I'll surface a clear instruction and link in the plan output. Cannot be fixed by migration.

---

## 🟠 P1 — Functional bugs

### B1. React fragment without key (console warning every render)
`src/routes/_authenticated/whatsapp-logs.tsx` line 191 — the `<>...</>` returned inside `.map()` has no key. Replace with `<React.Fragment key={log.id}>` (and remove the inner `key=` props since the fragment owns it).

### B2. `users.functions.ts` writes audit_logs directly via service role
`createUser`, `updateUser`, `deleteUser` insert into `audit_logs` directly with `supabaseAdmin`. That works (service role bypasses RLS), but bypasses the new `log_audit_event` standardisation and means `user_email` is null for those rows. Fix: look up the calling admin's email once and write it, OR call `log_audit_event` via an authed client. Cheaper fix: stamp `user_email` in the insert payload.

### B3. Login auto-redirect loop on already-authenticated visit
`login.tsx` returns a blank shell when `isAuthenticated`, then schedules `navigate()` in an effect. If the user is on `/login` with a stale session that fails RLS later, you get a flash of blank → dashboard → 403 toast. Replace with `beforeLoad: ({ context }) => isAuthenticated && throw redirect(...)` so the route never mounts.

### B4. AdminGuard side-effect navigation
`AdminGuard.tsx` calls `router.navigate` in a `useEffect`. Per TanStack guidance, this should be `beforeLoad: throw redirect(...)` on each admin route to prevent the brief mount of the protected page. I'll convert each admin route to `beforeLoad` and reduce `AdminGuard` to a defensive wrapper that just hides children.

### B5. `fetchRole` never re-runs on token refresh
`onAuthStateChange` runs on `SIGNED_IN`/`SIGNED_OUT`/`TOKEN_REFRESHED`. We re-fetch role on every event, including `TOKEN_REFRESHED`, which re-renders the entire app every 50 minutes. Filter to `SIGNED_IN`/`SIGNED_OUT`/`USER_UPDATED` only.

### B6. `bulkPending` recomputes WhatsApp URL twice
`fees.tsx` line 97 builds a throwaway URL just to check validity. Use `sanitizeMobile(s.mobile)` directly — much cheaper and avoids re-encoding the message.

### B7. Lecture duplicate `confirm()` still uses native `window.confirm`
`teachers.tsx` line 369. Migrate to `AlertDialog` per the previous plan's standard.

### B8. Tests: marks save uses `window.confirm` for over-cap
`tests.tsx` line 218. Same migration to `AlertDialog`.

### B9. Students form: extra payment confirm uses `window.confirm`
`students.tsx` line 671. Same migration.

### B10. `as any` casts across the app
`(s as any).board` appears in students.tsx (4×), fees.tsx (1×), reports.tsx (3×). The Supabase types DO contain `board` — these casts are stale leftovers. Drop them and let TS prove they exist.

### B11. Recharts statically imported on dashboard, reports, students
Bundle bloat (~70KB gz). Wrap each chart in `React.lazy` + `Suspense` fallback so the tab/sidebar loads instantly.

### B12. Dashboard derived data recomputed every render
class distribution, MoM delta, top pending, monthly chart array, attendance %, newest admissions — all are re-calculated on every render including unrelated state changes (e.g. `showCollected` toggle re-runs the entire `studentPending.map`). Wrap each in `useMemo` keyed on the queries.

### B13. `whatsapp-logs.tsx` `Broadcast` still uses `setTimeout`-in-loop & native `confirm`
Same issue as old fees Bulk Remind. Refactor to sequential `await new Promise(r=>setTimeout(r,700))` queue with progress toast & `AlertDialog`.

### B14. `TeacherAttendanceView` upserts in a sequential `for` loop
`teachers.tsx` line 241. Use a single `.upsert(records, { onConflict: "teacher_id,date" })` with the array — one round-trip instead of N.

### B15. Same loop pattern in `MarksEntryTable.saveMut` and `attendance.tsx saveMutation`
Replace with batched `.upsert(arr, { onConflict: ... })`.

### B16. `audit.tsx` ALL_ENTITIES list missing values from union
`AuditEntity` union (in `lib/audit.ts`) includes `report` but lacks audit-trail of `app_settings`, `user_roles`. Either drop unused entries or include them — current state lets users filter for entries that don't exist. I'll align with the union.

### B17. Audit search uses `or(... ilike %s%)` without escaping `%` `_` `,`
A user typing `,` in search breaks the OR clause. Sanitize: replace `%`, `_`, `,`, `(`, `)` with escaped equivalents before building the OR string.

### B18. `inr()` adoption still incomplete
40+ `₹...toLocaleString` sites remain (dashboard, students details, teachers, reports, fees Tabs). Single global swap to `inr(x)` so a future currency/format change is one file.

---

## 🟡 P2 — UX & polish

### U1. Per-route `errorComponent` still missing
Only the global `defaultErrorComponent` exists — but tanstack-start guidelines say every route with a loader should have its own. None of `_authenticated/*` have one. Add `errorComponent: RouteError` to all 10 route files (RouteError component already exists).

### U2. `notFoundComponent` per route
For `tests`, `students`, `teachers`, `users` — adding a per-route 404 helps when an entity_id route is added later. Skip until those exist.

### U3. Loading skeleton coverage
Students table, Teachers salary table, Whatsapp-logs, Audit table still show "Loading..." text. Use `loading-skeleton` for consistency.

### U4. Form-level zod validation
Students form does inline `if (!/^\d{10}$/.test(mobile))` — works but mixes validation with mutation. Centralise with a `zod` schema for `studentSchema` (mobile regex, fees ≥ 0, discount 0..total_fees, due_day 1..28). Same for teachers (`fixed_salary ≥ 0`, `per_lecture_fee ≥ 0`).

### U5. Empty-state usage incomplete
`EmptyState` exists; only used in audit + whatsapp-logs. Apply to: tests list (none / filter mismatch), attendance history (no days), students table (no results), reports tabs.

### U6. aria-label on icon buttons
Many icon buttons in teachers, tests, fees still lack `aria-label`. Add for accessibility (keyboard + screen reader).

### U7. Pass-mark threshold hardcoded to 50 in tests UI
`tests.tsx` line 286 hardcodes `pct >= 50` for green/red. Read from `app_settings` key `pass_mark` with default 35 (matches earlier plan; admins likely want 35 not 50).

### U8. `printReceipt` shows `Date.now().toString().slice(-8)` as receipt number
Two payments at the same ms collide. Generate a stable receipt number from the inserted payment ID and only render the print button after the payment is recorded (not before).

### U9. Bulk-remind keeps "Pending only" toggle hidden once you turn it off
Minor: `pendingOnly=false` can show paid students whose Reminder button is hidden (correct), but the "Bulk Remind" count still reflects all filtered. Show the count next to the button: `Bulk Remind (N)`.

### U10. Landing page (`index.tsx`) hash-anchor navigation
Everything (`#home`, `#courses`, `#features`, `#contact`) lives on a single page. tanstack-start guidelines say to split into separate routes for SSR/SEO. Out of scope unless you want it — calling it out only.

### U11. Currency in PDF says `Rs.` but UI says `₹`
`export-utils.ts` strips `₹` for jsPDF. Acceptable, but worth a one-liner comment so future devs don't "fix" it.

### U12. WhatsApp resend doesn't pre-validate `type` enum
If `whatsapp_logs.type` ever gets a value outside the UI's TYPES list, the type select silently filters it out. Add a fallback "other" badge style.

### U13. `audit.tsx` Export CSV says "Export page" but exports only the current page
Good — but the button label mismatch with "page" vs full filtered set could confuse. Add a second button "Export filtered (all pages)" that fetches without `range()`.

### U14. Login background uses `bg-primary` over a dark page even in light theme
Visual: secondary text becomes hard to read in light theme. Add a subtle gradient that respects `[data-theme]`.

---

## 🟢 P3 — Performance & DB

### P1. Missing DB indexes
Add (one migration):
- `audit_logs(created_at desc)` — pagination
- `audit_logs(action)`, `audit_logs(entity)` — filters
- `whatsapp_logs(sent_at desc)` — log feed
- `whatsapp_logs(student_id)` — resend / per-student lookup
- `payments(student_id)` — fee aggregation
- `payments(payment_date)` — month buckets
- `attendance(date)`, `attendance(student_id, date)` — per-day & per-student
- `lectures(teacher_id, date)` — teacher dashboard
- `test_results(test_id)`, `test_results(student_id)` — marks pages
- `students(academic_year, status)` — most lists scope on this
Improves cold-cache pagination/filter latency dramatically once tables grow.

### P2. `select("*")` everywhere
Most queries don't need every column. The biggest wins:
- `payments.select("id, student_id, amount, payment_date, payment_mode, academic_year, notes")`
- `attendance.select("id, student_id, date, status")`
- `whatsapp_logs.select("id, student_id, message, type, sent_at")`
- `tests.select("id, name, standard, subject, test_date, max_marks, academic_year")`

### P3. Default 1000-row cap unhandled
`payments-all`, `attendance-all`, `test-results` (no filter) will silently truncate at 1000. For a long-running classes app this is a real bug. Add explicit `.range()` or scope by `academic_year` consistently and flag the dashboard "Top Pending" with a subtle "(of N…)" if cap reached.

### P4. `chartData` revenue series filters payments client-side
Better: 6 month-bucketed SQL queries via a single `payments.select("amount, payment_date").gte(...).lte(...)`. Or compute via a Postgres view. Defer unless you have >5k payments.

---

## ✅ Already shipped (no work)
- Audit log spoofing — `log_audit_event` + `log_audit_event_anon` RPCs in place; `audit_logs` insert policy dropped.
- Bulk-remind sequential queue with progress toast.
- AlertDialog for over-payment in fees PaymentForm.
- Copy-from-yesterday 14-day lookback.
- Resend re-validation.
- Login `validateSearch` for redirect-back.
- Fragment-key bug (B1) — actually still present, will fix.

---

## Question before implementing

1. **DB indexes (P1)** — OK to add as one migration? They're zero-risk additions but technically a schema change.
2. **`window.confirm` → `AlertDialog` everywhere (B7/B8/B9/B13)** — agree? Default yes.
3. **Recharts lazy-load (B11)** — agree? Default yes.
4. **Per-route `errorComponent` on all 10 routes (U1)** — agree? Default yes.
5. **Payment edit/delete UI (S4)** — should I add it now? It's a real gap (typo'd payments are unfixable) but adds ~80 lines.

---

## Files touched (estimate)

**Edited (~14)**
- `src/routes/_authenticated/fees.tsx` — XSS fix (S1/S2), edit/delete payment (S4 if approved), `inr()`, perf
- `src/routes/_authenticated/whatsapp-logs.tsx` — fragment key, Broadcast queue, AlertDialog
- `src/routes/_authenticated/teachers.tsx` — AlertDialog, batch upsert, `inr()`
- `src/routes/_authenticated/tests.tsx` — AlertDialog, pass_mark from app_settings, batch upsert, empty state
- `src/routes/_authenticated/attendance.tsx` — batch upsert
- `src/routes/_authenticated/students.tsx` — drop `as any`, AlertDialog, zod schema, `inr()`, perf
- `src/routes/_authenticated/dashboard.tsx` — `useMemo`, lazy recharts, `inr()`
- `src/routes/_authenticated/reports.tsx` — drop `as any`, lazy recharts, `inr()`
- `src/routes/_authenticated/audit.tsx` — search escaping, "Export all filtered" button, align entities
- `src/routes/_authenticated/users.tsx` — beforeLoad guard
- `src/routes/login.tsx` — beforeLoad redirect when authenticated
- `src/lib/auth-context.tsx` — filter onAuthStateChange events
- `src/components/AdminGuard.tsx` — convert to defensive wrapper; routes use beforeLoad
- `src/utils/users.functions.ts` — stamp user_email in audit inserts

**New / migration**
- `supabase/migrations/<ts>_indexes_and_lecture_unique.sql` — indexes + partial unique on lectures

**Out of scope (deferred)**
- Landing-page route splitting (U10).
- Teacher attendance class-scoping (S5).
- Pre-computed Postgres views (P4).
- Leaked-password protection (S6) — must be enabled in Supabase dashboard manually.