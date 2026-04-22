

# Plan — Bug fixes, hardening & extended improvements

Builds on the previously drafted plan and adds a deeper sweep of bugs and industry-standard improvements found across the app.

---

## 1. Top nav — scrollbar + AY select

- `AdminTopNav.tsx`: replace `overflow-x-auto` with `min-w-0`, bump desktop breakpoint `lg` → `xl`, mobile menu shows at `lg` and below.
- Replace native `<select>` (academic year) with shadcn `Select` so it matches theme and never renders OS-level scrollbars.
- Settings dropdown content stays `w-44`.

## 2. Users management — visibility, UX & form

- **Migration**: idempotent backfill — insert `admin` role for `admin@gmail.com` (`ON CONFLICT DO NOTHING`).
- `users.tsx`:
  - Gate render on `isReady` to remove blank-flash before redirect.
  - Show error message + Retry button when `usersQuery.error`.
  - Inline **Assign role** action for users with `role: null`.
  - New **Name** column, sortable.
- **Add/Edit dialog**: new required **Full name** input (zod: trim, 1–100 chars) at top.
- `users.functions.ts` + `users.server.ts`: extend schema with `full_name`, write to `user_metadata.full_name` on create + update, return on list.
- `ManagedUser` type updated.

## 3. Audit coverage — fill the gaps

Add `logAudit` calls at:
- `login.tsx` — `login_failed`.
- `auth-context.tsx` `logout()` — `logout`.
- `students.tsx` — `status_changed` for Active/Inactive toggle.
- `attendance.tsx` — `attendance_copied` for "Copy from yesterday".
- `tests.tsx` — per-row WhatsApp result send.
- `fees.tsx`, `students.tsx`, `whatsapp-logs.tsx`, `reports.tsx`, `audit.tsx` — `export` action on every CSV export.
- `teachers.tsx` — `user_created` is already fired by server fn; add a local audit confirming the teacher↔login link.

Extend `AuditAction` union: add `logout`, `login_failed`, `status_changed`, `attendance_copied`. Update `ACTION_COLORS` map in `audit.tsx`.

## 4. Audit page — typed + paginated

- Drop `(supabase.from as any)` casts (types now include `audit_logs`).
- Server-side pagination (50/page) via `.range()`, with Prev/Next + total count from `{ count: "exact" }`.
- Date-range filter (from/to) added to existing search/action/entity filters.
- Log audit-CSV exports.

## 5. Defensive route guards

Wrap with `<AdminGuard>` (URL-paste protection):
- `fees.tsx`, `reports.tsx`, `whatsapp-logs.tsx`, `teachers.tsx`.
- `AdminGuard.tsx`: only run redirect/toast after `isReady` to avoid false negatives during role load.

## 6. Extended bug sweep & industry-standard polish (new)

Found while reviewing the rest of the app:

### Auth & session
- **Auth state listener race**: `auth-context.tsx` calls `setRole` from `onAuthStateChange` without an `active` flag — fast remount can set state on unmounted provider. Add an `active` ref pattern matching the initial-session effect.
- **Login redirect-back**: `login.tsx` does not honour `?redirect=` search param after success. Add zod-validated `validateSearch` and `navigate({ to: search.redirect ?? "/dashboard" })`.
- **Session refresh**: ensure supabase client is created with `autoRefreshToken: true, persistSession: true, detectSessionInUrl: true` (verify in `client.ts`).

### Data layer & React Query
- **Stale data after mutation**: several mutations call `toast` but skip `queryClient.invalidateQueries` (spot-checked in students/teachers/fees flows). Audit mutations and add invalidations for the affected query keys.
- **Default query options**: in `router.tsx` set `defaultOptions.queries.retry: 1`, `staleTime: 30_000`, `refetchOnWindowFocus: false` to cut redundant fetches.
- **1000-row cap**: any list query that may exceed 1000 (audit, payments, attendance) needs explicit `.range()` pagination — apply to audit now; add a TODO for the others.

### Forms & validation
- **Phone numbers**: students table has `mobile text` with no format check. Add zod regex (`^[0-9+\-\s]{7,15}$`) to student create/edit forms.
- **Numeric fields**: payments amount, fees, marks — enforce `nonnegative()` and sane upper bounds; current forms accept negatives.
- **Test marks**: clamp `marks_obtained` to `0…max_marks` on both client and DB-insert path; show validation error instead of silently saving out-of-range marks.

### UX / accessibility
- **Toasts**: standardise `success` vs `error` variants — several places use `toast()` instead of `toast.success/error`.
- **Empty states**: add consistent empty-state cards (icon + message) to Tests, Attendance history, WhatsApp logs, Audit when filters return zero rows.
- **Keyboard**: add `aria-label` to icon-only buttons (WhatsApp send, Edit, Delete, Copy from yesterday).
- **Loading**: replace ad-hoc `Loading…` text with `loading-skeleton` for Students table, Teachers table, Audit table.
- **Date pickers**: ensure all date inputs use `react-day-picker` (Calendar) for consistency; the History tab month-picker should be a proper calendar.

### Money & dates
- **Currency formatting**: centralise via `format.ts` (`formatINR`); some screens still use `₹{amount}` template literals.
- **Date formatting**: standardise `format(date, "dd MMM yyyy")` for display, ISO for storage; spot-fix any place using `toLocaleDateString` (locale-dependent).
- **Academic year filter**: make sure every list query filters by current AY from `academic-year-context`; spot-checked attendance + payments — confirm tests, lectures, teacher_attendance also filter.

### Error boundaries
- Per `tanstack-start` rules, every route with a loader needs `errorComponent` and `notFoundComponent`. Audit route files; add minimal boundaries where missing (`__root.tsx`, all `_authenticated/*`).
- `router.tsx`: set `defaultErrorComponent` with Retry.

### Security & RLS hygiene
- Run `supabase--linter` after migration; resolve any new warnings.
- Confirm `audit_logs` insert policy correctly stamps `user_id = auth.uid()` from the client; the WITH CHECK already enforces it — fine.
- `whatsapp_logs` currently has no insert policy for teachers; only admins can insert. Verify whether teachers should be able to log sends — if yes, add an RLS policy; if no, hide the button for teachers (already done).

### Performance
- **Recharts**: dynamically import heavy charts in `dashboard.tsx` and `reports.tsx` to shrink initial bundle.
- **Image / icon imports**: tree-shake lucide imports already (good); verify no `import * as Icons from "lucide-react"` anywhere.
- **Memoisation**: `dashboard.tsx` recomputes class distribution / MoM delta on every render — wrap in `useMemo` keyed on the underlying queries.

### Misc bugs spotted
- `attendance.tsx` "Copy from yesterday" should ignore weekends/holidays — fall back to the most recent prior date with attendance records, not strictly yesterday.
- `tests.tsx` pass% threshold hard-coded at 35 — move to `app_settings` (already a table) so admins can change it later (out of scope to build the UI; just read with a default).
- `whatsapp-logs.tsx` Resend should re-validate that the student still exists & is active before opening the deep link.
- `fees.tsx` "Bulk remind" should rate-limit to N opens per second to avoid the browser blocking popups.

---

## Files touched

**Edited**
- `src/components/AdminTopNav.tsx`
- `src/components/AdminGuard.tsx`
- `src/lib/audit.ts`
- `src/lib/auth-context.tsx`
- `src/integrations/supabase/client.ts` (verify session opts)
- `src/router.tsx` (default query options + error component)
- `src/routes/__root.tsx` (notFound boundary if missing)
- `src/routes/login.tsx` (redirect-back, failed-login audit)
- `src/routes/_authenticated/users.tsx`
- `src/routes/_authenticated/audit.tsx`
- `src/routes/_authenticated/students.tsx`
- `src/routes/_authenticated/attendance.tsx`
- `src/routes/_authenticated/tests.tsx`
- `src/routes/_authenticated/fees.tsx` (+ AdminGuard)
- `src/routes/_authenticated/reports.tsx` (+ AdminGuard)
- `src/routes/_authenticated/whatsapp-logs.tsx` (+ AdminGuard)
- `src/routes/_authenticated/teachers.tsx` (+ AdminGuard)
- `src/routes/_authenticated/dashboard.tsx` (memoisation, dynamic chart import)
- `src/utils/users.functions.ts`
- `src/utils/users.server.ts`

**Migrations**
- One idempotent migration: backfill `admin` role for `admin@gmail.com`; no schema changes.

## Out of scope
- No layout redesigns.
- No RLS changes (existing policies are correct).
- No new pages.
- App-settings UI for pass% threshold (just read default).

