## Goal

Five focused improvements across fees, students, reports, and database security — all on top of the existing `stream` column and `src/lib/catalog.ts` catalog.

---

### 1. Richer fee-reminder WhatsApp messages + logs (`fees.tsx`)

Update both single and bulk reminder builders so the message and the `whatsapp_logs` row reflect the standardized class/stream and use the student's actual pending fees + due-date.

- New helper `buildReminderMessage(s)` (local to `fees.tsx`) producing:
  > `Hello {name}, your pending fees for Yashshree Classes ({class}{ • Stream Science|Commerce if 11/12}) is ₹{remaining}. Please pay before {nextDueLabel(fee_due_day)}. Thank you.`
- Guard against negative/zero remaining (`Math.max(0, s.remaining)`); skip students whose `remaining <= 0` (already filtered).
- `whatsapp_logs.insert` payload stays the same (only `student_id`, `message`, `type`), but the `message` now contains the new info. Audit log details extended with `class`, `stream`, `due_day`, `remaining`.

### 2. Stream filter on Students page (`students.tsx`)

- Add `filterStream` state (`"all" | "science" | "commerce"`).
- Render the `<Select>` only when `filterClass` is `"11th"`, `"12th"`, or `"all"`. When `filterClass` is 5–10, hide the stream select and force `filterStream = "all"`.
- Filter logic: when `filterStream !== "all"`, keep only students where `isHigherSecondary(s.class) && s.stream === filterStream`.
- Include in the "Clear filters" reset and in the empty-state copy.
- Add stream column hint to the right-hand detail panel header (e.g. `… • 11th Science • CBSE …`).

### 3. Stream-aware Reports (`reports.tsx`)

- Add `filterStream` state used by the **Students** and **Pending Fees** tabs (top-level filter — same control rendered inside both tab headers OR moved into a shared filter row above the tabs; we'll inline-render in each of those two tabs to keep scope tight).
- Add `attStream` for the **Attendance** tab, mirroring the existing `attClass` selector.
- All three filters: only render the dropdown if the relevant class filter is `"all"`, `"11th"`, or `"12th"`; otherwise hide & treat as `"all"`.
- Apply `s.stream === filterStream` in `filteredStudents`, `pendingData` (currently from `activeStudents`), and `attRows`.
- Extend the Students export header/rows with a `Stream` column (value `s.stream === 'none' ? '' : capitalize(s.stream)`); same for Pending Fees and Attendance exports for completeness.

### 4. Subject ↔ class/stream validation (`students.tsx` `StudentForm`)

In the `mutationFn`, before the insert/update payload:

```ts
const allowed = new Set(getSubjectsFor(form.class, form.stream));
const invalid = form.subjects.filter((s) => !allowed.has(s));
if (form.subjects.length === 0) throw new Error("Select at least one subject");
if (invalid.length) throw new Error(`Subjects not valid for ${form.class}${showStream ? ` ${form.stream}` : ""}: ${invalid.join(", ")}`);
if (isHigherSecondary(form.class) && form.stream === "none") throw new Error("Select a stream for 11th/12th");
```

(Class/stream changes already clear `subjects: []`, so existing edits stay consistent.) Also disable the Submit button when `form.subjects.length === 0` for clearer UX.

### 5. Supabase security linter — fix SECURITY DEFINER + leaked-password warnings

Linter currently reports 11 warnings. Plan:

**A. SECURITY DEFINER functions exposed to `anon`/`authenticated` (warnings 1–10)**

For each function below, `REVOKE EXECUTE … FROM PUBLIC, anon, authenticated` so only the role that actually needs to call it via SQL can. Most are only invoked from RLS policies / other definer functions, where executor permissions are not required.

| Function | Caller | Action |
|---|---|---|
| `public.has_role(uuid, app_role)` | RLS policies (definer context) | Revoke from `anon, authenticated, public` |
| `public.current_user_teacher_id()` | RLS policies | Revoke from `anon, authenticated, public` |
| `public.current_user_teacher_subject()` | RLS policies | Revoke from `anon, authenticated, public` |
| `public.teacher_can_mark_student(uuid)` | RLS policies | Revoke from `anon, authenticated, public` |
| `public.get_students_safe()` | Not used by client (we read the `students_safe` view directly) | Revoke from `anon, authenticated, public` |
| `public.log_audit_event(...)` | Called from app via `rpc()` by signed-in users | Keep `EXECUTE` for `authenticated`; revoke from `anon, public` |
| `public.log_audit_event_anon(...)` | Called from login screen pre-auth | Keep `EXECUTE` for `anon, authenticated`; revoke from `public` |
| `public.rls_auto_enable()` | Event trigger only | Revoke from `anon, authenticated, public` |

Migration: a single SQL file with the `REVOKE` / scoped `GRANT` statements above. RLS policies and triggers continue to work because they run with the function owner's privileges.

**B. Leaked-password protection (linter warnings 11)**

This is an Auth setting, not SQL. The migration cannot toggle it; we will:
- Document the one-click action in chat ("Auth → Providers → Email → enable *Leaked password protection*"),
- Provide the dashboard link in `<lov-actions>`.

**C. Re-run linter** after the migration to confirm warnings 1–10 disappear; warning 11 will remain only until the user toggles the auth setting.

---

### Files touched

- `src/routes/_authenticated/fees.tsx` — reminder builder, audit details
- `src/routes/_authenticated/students.tsx` — stream filter + form validation
- `src/routes/_authenticated/reports.tsx` — stream filter on Students/Pending/Attendance tabs + export columns
- `supabase/migrations/<timestamp>_lock_down_definer_execute.sql` — REVOKE/GRANT statements

No schema changes, no data migrations, no new dependencies.

### Out of scope (not requested)

- Backfilling `subjects` for existing rows that no longer match the new catalog (rows remain editable; validation triggers only on save).
- Changing the bulk-reminder cadence / popup behaviour.
