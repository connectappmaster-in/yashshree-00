

# Plan — Bug fixes & hardening: completion sweep

Most of the previously approved plan is already shipped. This pass closes the remaining gaps and adds fresh issues spotted while reviewing the live code.

---

## Status of the previous plan

### ✅ Already done (no work needed)
- **Top nav**: `xl` breakpoint, shadcn `Select` for AY, `min-w-0` instead of `overflow-x-auto`, settings dropdown.
- **Users page**: full-name field, sortable Name column, error+Retry, isReady gating, inline "Assign role".
- **`users.functions.ts` / `users.server.ts`**: `full_name` plumbed into `user_metadata`.
- **Audit migration**: backfill admin role for `admin@gmail.com`.
- **Audit page**: typed (no `as any`), server-side pagination, action/entity/date-range filters, export logging.
- **Audit coverage** for: `login_failed`, `logout`, `status_changed` (students), `attendance_copied`, `test_marks_saved`, `whatsapp_sent/broadcast`.
- **Route guards**: `AdminGuard` wraps fees, reports, whatsapp-logs, teachers, audit, users.
- **Auth context**: `active` flag race-protection on initial-session effect.
- **Supabase client**: `persistSession`, `autoRefreshToken`, `detectSessionInUrl` set with SSR-safe guards.
- **Router**: `defaultErrorComponent` with Retry; root has `notFoundComponent`.
- **React Query defaults**: `retry: 1`, `staleTime: 30s`, `refetchOnWindowFocus: false` (set in `__root.tsx`).
- **Test marks**: warns before capping over-max entries (`min/max` on input).

### ❌ Still missing from the previous plan
1. **Login redirect-back** — `login.tsx` ignores `?redirect=`, always sends to `/dashboard`.
2. **Per-row WhatsApp result share** in `tests.tsx` — not implemented.
3. **CSV export audit** in `students.tsx`, `fees.tsx`, `whatsapp-logs.tsx` — these don't currently have CSV exports at all (Reports + Audit do, and they log).  Add a "Export CSV" action to each (filtered list) with `logAudit("export", …)`.
4. **Per-route `errorComponent`** on every `_authenticated/*` file — currently only the global `defaultErrorComponent` catches.
5. **Currency centralisation** — `inr()` exists in `format.ts` but ~10 sites still build `₹${n.toLocaleString(...)}` by hand.
6. **Phone validation** — student form takes any text for `mobile`; only `sanitizeMobile` runs at WhatsApp send time. Add zod regex on save.
7. **Numeric guards** — payments amount, fees, discount accept negatives. Add `nonnegative()` + reasonable max.
8. **Empty states** — Tests, Attendance history, WhatsApp logs use plain text, not the consistent empty-state card with icon.
9. **Loading skeletons** — Students/Teachers/WhatsApp-logs tables still show "Loading…" text rather than `loading-skeleton`.
10. **aria-label** on icon-only buttons in fees/teachers/tests/whatsapp-logs send/edit/delete buttons.
11. **AY filter on whatsapp_logs query** — currently fetches all logs, not filtered by AY (acceptable for logs, but the join to students should still respect AY for the broadcast composer).
12. **Recharts dynamic import** — `dashboard.tsx` and `reports.tsx` still statically import recharts.
13. **`useMemo` on dashboard derived data** — class distribution / MoM delta currently recompute every render.
14. **Copy-from-yesterday weekend handling** — `attendance.tsx` strictly uses `subDays(1)`, doesn't fall back to last day with records.
15. **Resend (whatsapp-logs)** — no re-validation that student still exists & is active.
16. **Bulk remind rate-limit** — currently 600 ms stagger but uses `setTimeout` inside a loop without queue cleanup; works but worth tightening.

---

## New bugs / improvements found this pass

### A. Auth & data
- **A1. `fetchRole` SSR crash potential** — `fetchRole` calls `supabase.auth` inside `useEffect`, fine, but the order `.order("role", { ascending: true })` + `limit(1)` to pick admin over teacher breaks if a user has only `teacher` (works) or only `admin` (works) — but if both exist, alphabetical "admin" < "teacher" only because of string sort, not by intent. Replace with explicit two-pass: prefer `admin` first, else `teacher`.
- **A2. Login auto-redirect race** — `login.tsx` calls `navigate({to:"/dashboard"})` both inside the post-submit handler AND the auth-state `useEffect`, causing a double-navigate. Drop the in-handler navigate; rely on the effect (which already runs once `isAuthenticated` flips).
- **A3. `logout()` audit insert uses raw client** — bypasses the `logAudit` helper, duplicating logic. Switch to `logAudit("logout","auth",null,{})` (the helper already captures user before clear).
- **A4. `audit.tsx` action filter list** — `ALL_ACTIONS` is derived from `ACTION_COLORS` which omits `lecture_logged`. Add `lecture_logged` color + ensure list completeness from `AuditAction` union (single source of truth).

### B. Database / RLS
- **B1. `audit_logs` is missing UPDATE/DELETE policies** — by design (immutable), but Supabase linter will flag "RLS enabled but no policy for X". Document with a comment, or add explicit "deny all" placeholder policy to silence linter.
- **B2. `whatsapp_logs` insert is admin-only**, but `tests.tsx` now wants per-row WhatsApp send (teachers will need this if they share results). Decision needed (Q1 below).
- **B3. `attendance` teacher INSERT/UPDATE policy is wide-open** (`with_check: has_role(...,'teacher')`) — any teacher can mark attendance for any class. Acceptable v1 since teachers are trusted, but worth narrowing later.
- **B4. `audit_logs` has no index on `created_at` / `action` / `entity`** — pagination + filters will slow once rows grow. Add indexes.

### C. UX / consistency
- **C1. Empty-state component** — extract a tiny `<EmptyState icon=… title=… hint=… />` into `src/components/EmptyState.tsx` and reuse across Tests, Attendance history, WhatsApp logs, Audit, Students search-no-results.
- **C2. `inr()` adoption** — replace manual `₹${x.toLocaleString("en-IN")}` in dashboard.tsx, fees.tsx, students.tsx, teachers.tsx with `inr(x)`. Single helper means one future change for ₹↔INR.
- **C3. `format(date, "dd MMM yyyy")` everywhere** — already mostly consistent; only `calendar.tsx` (shadcn internal) uses `toLocaleDateString` and that's fine.
- **C4. Confirm-dialogs** — `students.tsx` and `fees.tsx` use `window.confirm(...)` for "amount exceeds remaining". Replace with shadcn `AlertDialog` for theme consistency.
- **C5. Bulk remind UX** — switch the 600 ms-loop to a sequential async queue with progress toast, and stop using `setTimeout` (which can fire after navigation away, opening blank tabs).

### D. Performance
- **D1. Dynamic recharts** — `const Recharts = lazy(() => import("recharts"))` inside dashboard + reports pages cuts ~70KB off initial bundle.
- **D2. `useMemo` for derived dashboard data** — wrap class distribution, MoM delta, top-pending list.
- **D3. Audit/Whatsapp-logs `select("*")`** — fetch only needed columns to shrink payload.

### E. Misc
- **E1. `app_settings` pass-mark threshold** — read once on tests page (`select value where key='pass_mark'`, default 35) and use everywhere instead of hard-coded 35.
- **E2. WhatsApp resend** — `whatsapp-logs.tsx` Resend should re-fetch the student row, check `status==='active'` and `mobile` is valid, before opening deep link. Toast "Student inactive" otherwise.
- **E3. Copy-from-yesterday fallback** — query the last attendance row before `date` ordered desc, not strictly `subDays(1)`. If none in the last 14 days, toast "Nothing to copy".

---

## Questions before implementing

I have one decision and two minor preferences to confirm.

1. **Per-row WhatsApp send for teachers in Tests page** — should teachers be allowed to send WhatsApp result messages (which inserts into `whatsapp_logs`)? If yes, I'll add a "Teachers insert whatsapp_logs" RLS policy. If no, the button stays admin-only (hidden for teachers).
2. **Recharts dynamic import** — OK to do this, or keep static for simpler dev experience? Default: do it.
3. **Replace `window.confirm` with `AlertDialog`** for amount-exceeds-remaining dialogs — I'll do it unless you want to keep native confirms for speed.

---

## Files touched

**Edited**
- `src/lib/audit.ts` — add `lecture_logged` to coverage check (no union change needed).
- `src/lib/auth-context.tsx` — fix `fetchRole` priority, route `logout` through `logAudit`.
- `src/lib/format.ts` — alias `formatINR = inr` (so future search-replace uses one name).
- `src/routes/login.tsx` — `validateSearch` for `redirect`, drop double-navigate, redirect-back after success.
- `src/routes/_authenticated/audit.tsx` — add `lecture_logged` color; align `ALL_ACTIONS` with union.
- `src/routes/_authenticated/dashboard.tsx` — `useMemo` for derived data; lazy recharts; `inr()` adoption.
- `src/routes/_authenticated/fees.tsx` — bulk-remind queue refactor; `AlertDialog` for over-pay; `inr()`; CSV export with audit; `aria-label` on icon buttons.
- `src/routes/_authenticated/students.tsx` — phone zod regex; non-negative numeric guards; CSV export with audit; `AlertDialog` for over-pay; `inr()`; loading skeleton; aria-labels.
- `src/routes/_authenticated/tests.tsx` — read pass% from `app_settings`; per-row WhatsApp button (subject to Q1); empty state.
- `src/routes/_authenticated/attendance.tsx` — Copy-from-yesterday fallback (look back up to 14 days); empty state in History.
- `src/routes/_authenticated/whatsapp-logs.tsx` — Resend re-validates student; empty state; loading skeleton; CSV export with audit.
- `src/routes/_authenticated/teachers.tsx` — `inr()`; aria-labels; loading skeleton.
- `src/routes/_authenticated/reports.tsx` — lazy recharts.
- All `_authenticated/*` route files — add per-route `errorComponent` (small reusable component).
- `src/components/EmptyState.tsx` — **NEW** small shared component.
- `src/components/RouteError.tsx` — **NEW** shared per-route error UI.

**Migrations** (one)
- Add indexes: `audit_logs(created_at desc)`, `audit_logs(action)`, `audit_logs(entity)`, `whatsapp_logs(sent_at desc)`, `payments(payment_date desc)`, `attendance(date)`.
- Conditional on Q1: add `whatsapp_logs` teacher INSERT policy.

## Out of scope
- No layout redesigns.
- No new pages.
- App-settings UI for pass% threshold (just reading the value).
- Narrowing teacher attendance INSERT to "own classes only" (deferred — needs schema for class↔teacher mapping).

