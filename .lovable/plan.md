# Deep audit — what's still broken after the last sweep

Re-scanned every route, lib, server function, RLS policy, and the latest migrations. Below is what's actually still in the code today (verified by `rg`), grouped by severity, plus the items the previous sweep already shipped.

---

## ✅ Already shipped (confirmed in source)
- `attendance.tsx` syntax error fixed; teacher RLS narrowed via `teacher_classes` + `teacher_can_mark_student()`.
- Payment Edit/Delete with audit + AlertDialog in `fees.tsx`.
- `auth-context.tsx` filters `onAuthStateChange` to skip `TOKEN_REFRESHED`.
- `AdminGuard.tsx` reduced to defensive wrapper.
- `whatsapp-logs.tsx` Fragment-key fix.
- DB indexes + partial unique on `lectures` migration.
- `students_safe` view + `studentsReadFrom` helper.
- XSS fix in print receipt; audit log spoofing closed.

---

## 🔴 P0 — Real bugs still in code

### B1. Sequential `for`-loop upserts (3 places, N round-trips)
- `attendance.tsx:195` — student attendance save
- `teachers.tsx:241` — teacher attendance save
- `tests.tsx:241` — marks save

Replace each with one `.upsert(arr, { onConflict: "..." })` call. Cuts a 50-student save from 50 HTTP requests to 1.

### B2. `whatsapp-logs.tsx` Broadcast still uses `setTimeout`-in-loop (line 272)
If the user navigates away the timers still fire and pop-ups blast the new screen. Refactor to the same sequential `await new Promise(r=>setTimeout(r,700))` queue with progress toast and `AlertDialog` confirm — same pattern already used in `fees.tsx` bulk-remind. Drop the `confirm()` browser dialog on line 266.

### B3. `audit.tsx` search OR clause not escaped (line 85)
A user typing `,`, `(`, `)`, `%`, `_` in the search box breaks `q.or(`user_email.ilike.%${s}%,entity_id.ilike.%${s}%`)` and can throw a 400. Escape PostgREST special chars before building the OR string.

### B4. `users.functions.ts` audit inserts bypass `log_audit_event` & don't stamp `user_email`
`createUser` / `updateUser` / `deleteUser` insert directly into `audit_logs` with `user_email = null`, so the audit page just shows a blank "User" column for every admin action. Look up the actor's email once via `supabaseAdmin.auth.admin.getUserById(context.userId)` and stamp it into the inserts.

### B5. `window.confirm` still used in 3 places
- `teachers.tsx:369` — duplicate lecture
- `tests.tsx:225` — over-cap marks
- `students.tsx:678` — over-pay (extra payment)

Migrate all three to shadcn `AlertDialog` (theme-consistent and keyboard-accessible).

### B6. `as any` casts on `board` (stale)
The Supabase-generated type for `students` already includes `board`. Drop the `(s as any).board` casts in:
- `students.tsx` 4× (lines 145, 158, 264, 290, 506)
- `reports.tsx` 3× (lines 81, 223, 238)

Let TS prove it.

### B7. Admin guards still in `component:` instead of `beforeLoad:`
`fees.tsx`, `audit.tsx`, `whatsapp-logs.tsx`, `teachers.tsx`, `reports.tsx` still wrap with `<AdminGuard>` at render time → flash of "loading…" before content. Move to `beforeLoad: ({ context: { auth } }) => { if (!auth.isAdmin) throw redirect({ to: "/dashboard" }) }`. Keep `<AdminGuard>` only as defensive wrapper inside.

---

## 🟠 P1 — Perf & correctness

### P1. Recharts statically imported on dashboard
`dashboard.tsx` line 23-35 imports recharts at the top. Adds ~70 KB gz to first paint on the most-visited screen. Wrap each chart panel in `React.lazy` + `Suspense` with a skeleton fallback.

### P2. Dashboard derivations recomputed every render
Class distribution, MoM delta, top pending, monthly chart array, attendance %, newest admissions — all recalculated on every `setState` (e.g. the `showCollected` toggle re-runs `studentPending.map` over hundreds of rows). Wrap in `useMemo` keyed on the related queries.

### P3. `select("*")` on every query (~25 places)
Most queries don't need every column. Biggest wins:
- `payments` → `id, student_id, amount, payment_date, payment_mode, academic_year, notes`
- `attendance` → `id, student_id, date, status`
- `whatsapp_logs` → `id, student_id, message, type, sent_at`
- `tests` → `id, name, standard, subject, test_date, max_marks, academic_year`

### P4. Default 1000-row cap unhandled
`payments-all`, `attendance-all`, `test-results` (no filter) silently truncate at 1000 rows on dashboards with growing data. Add explicit `.range()` paging, or scope by `academic_year` consistently — and surface "(showing first 1000)" if hit.

### P5. `bulkPending` builds a throwaway URL just to validate mobile (`fees.tsx:97`)
Calls `buildWhatsappUrl()` then discards it just to test validity. Use `sanitizeMobile(s.mobile)` directly.

---

## 🟡 P2 — UX & polish

### U1. Per-route `errorComponent` missing on 9 of 10 routes
Only `fees.tsx` has `errorComponent: RouteError`. Add to all 10 `_authenticated/*` files (component already exists).

### U2. "Loading…" text instead of skeleton
`students.tsx:249` still shows plain text. Use the existing `loading-skeleton` component for visual consistency.

### U3. Hardcoded pass mark = 50 (`tests.tsx:293`)
Hardcodes `pct >= 50` for green/red. Read from `app_settings` key `pass_mark` with default 35.

### U4. `EmptyState` component exists but only used in audit + whatsapp-logs
Apply to: tests list (no tests / filter mismatch), attendance history (no days), students table (no results), reports tabs.

### U5. `inr()` adoption still incomplete (~10 sites)
Hand-built `₹${n.toLocaleString("en-IN")}` in dashboard.tsx (4×), students.tsx (2×), teachers.tsx (1×). Single global swap to `inr(x)` so a future format change is one file.

### U6. Bulk-remind count visibility (`fees.tsx`)
Button doesn't show how many students will be messaged. Display `Bulk Remind (N)`.

### U7. Audit "Export CSV" exports current page only
Button label says "Export CSV" but only exports the visible 50 rows. Add a second button "Export filtered (all pages)" that re-runs the query without `range()` and respects all current filters.

### U8. `aria-label` on icon-only buttons
Many ghost icon-only buttons in fees/teachers/tests (send/edit/delete/print) lack `aria-label`. Add for keyboard + screen-reader accessibility.

---

## ⏭ Out of scope (deferred / cannot fix here)
- **Leaked-password protection** — single Supabase dashboard toggle, no code/migration can do this.
- Admin "Assigned Classes" mini-editor in Users page — table + RLS is in; UI editor is a separate iteration once the schema is being used.
- Pre-computed Postgres views for chart aggregation (defer until > 5k payments).

---

## Files to touch (~12 edits, no new deps, no new migrations)

**Bug fixes**
- `src/routes/_authenticated/attendance.tsx` — batched upsert (B1)
- `src/routes/_authenticated/teachers.tsx` — batched upsert (B1), AlertDialog (B5), `inr()`, aria-labels
- `src/routes/_authenticated/tests.tsx` — batched upsert (B1), AlertDialog (B5), pass_mark from app_settings (U3), EmptyState (U4)
- `src/routes/_authenticated/whatsapp-logs.tsx` — broadcast queue + AlertDialog (B2)
- `src/routes/_authenticated/audit.tsx` — escape search OR (B3), "Export filtered" (U7)
- `src/utils/users.functions.ts` — stamp `user_email` in audit inserts (B4)
- `src/routes/_authenticated/students.tsx` — drop `as any` (B6), AlertDialog (B5), skeleton (U2), EmptyState (U4), `inr()` (U5)
- `src/routes/_authenticated/reports.tsx` — drop `as any` (B6), EmptyState (U4)
- `src/routes/_authenticated/fees.tsx` — `beforeLoad` admin guard (B7), `sanitizeMobile` (P5), bulk-remind count (U6), aria-labels (U8)
- `src/routes/_authenticated/audit.tsx`, `whatsapp-logs.tsx`, `teachers.tsx`, `reports.tsx` — `beforeLoad` admin guard (B7)

**Perf**
- `src/routes/_authenticated/dashboard.tsx` — lazy recharts (P1), `useMemo` everywhere (P2), scoped column selects (P3), `inr()`, range/cap handling (P4)
- All routes with `select("*")` — scoped column selects (P3)

**Polish**
- All 10 `_authenticated/*` files — add `errorComponent: RouteError` (U1)

After this sweep the only remaining warning is **Leaked Password Protection** (manual Supabase dashboard toggle).