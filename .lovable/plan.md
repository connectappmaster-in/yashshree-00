

# Plan — User Management with RBAC + App-wide Improvements

This is a large, multi-batch plan. To keep it safe and reviewable I'll execute in **3 sequential batches**. Each batch is self-contained and you can stop after any one.

---

## 🅰 Batch A — RBAC Foundation + User Management (security-critical)

### Database (one migration)

1. **Roles enum + tables** (no FK to `auth.users` per Supabase guidance):
   ```sql
   create type public.app_role as enum ('admin', 'teacher');

   create table public.user_roles (
     id uuid primary key default gen_random_uuid(),
     user_id uuid not null,
     role app_role not null,
     teacher_id uuid,                 -- links to teachers.id when role='teacher'
     created_at timestamptz default now(),
     unique (user_id, role)
   );
   alter table public.user_roles enable row level security;
   ```

2. **Security-definer helpers** (prevent recursive RLS):
   - `has_role(_user_id uuid, _role app_role) returns boolean`
   - `current_user_teacher_id() returns uuid`

3. **Tighten RLS** on every existing table — replace blanket "authenticated full access":
   - **Admins**: full ALL via `has_role(auth.uid(),'admin')`
   - **Teachers** can:
     - SELECT `students` (active roster, read-only)
     - SELECT `tests`, SELECT/INSERT/UPDATE `test_results` for tests where `subject` matches their teacher's subject (enforced via subquery)
     - SELECT/INSERT/UPDATE `attendance` (mark student attendance)
     - SELECT `lectures` and `teacher_attendance` filtered to their own `teacher_id`
   - **Teachers cannot** access `payments`, `whatsapp_logs`, `app_settings`, `teachers` (full table — only own row exposed via filter), or other teachers' lectures.

4. **`user_roles` policies**: SELECT — admin all, teacher own row; INSERT/UPDATE/DELETE — admin only.

5. **Auto-create user_role for new teachers** (optional trigger): when admin creates a teacher row, no auto user is made — admin must invite via Users page (intentional, because email/password is per-person).

6. **Seed first admin**: insert `('admin', <current logged-in user id>)` so the existing user keeps access.

### Server functions (`src/utils/users.functions.ts`)

Admin-only CRUD using `supabaseAdmin` + double-check via `has_role` server-side:

| Function | Action |
|---|---|
| `listUsers()` | Returns auth users joined with role + linked teacher name |
| `createUser({email,password,role,teacher_id?})` | `supabaseAdmin.auth.admin.createUser({email_confirm:true})` + insert role |
| `updateUser({userId,email?,password?,role?,teacher_id?})` | Update auth + role row |
| `deleteUser({userId})` | Delete auth user + cascade role; block deleting self |

All protected by `requireSupabaseAuth` middleware + inline admin check.

### Client

- **`src/lib/auth-context.tsx`** — fetch role on session load, expose `role`, `teacherId`, `isAdmin`, `isTeacher`.
- **`src/routes/_authenticated.tsx`** — pass role into router context for `beforeLoad` guards.
- **New route `src/routes/_authenticated/users.tsx`** (admin-only):
  - Table: Email · Role badge · Linked teacher · Created · Actions
  - Add/Edit dialog: email, password (optional on edit), role select, teacher dropdown if role=teacher
  - Block self-deletion / self-demotion
- **`src/components/AdminTopNav.tsx`** — filter `navItems` by role:
  | Item | Admin | Teacher |
  |---|---|---|
  | Dashboard | ✅ | ✅ (teacher view) |
  | Students | ✅ | ✅ read-only |
  | Fees | ✅ | ❌ |
  | Attendance | ✅ | ✅ |
  | Test Reports | ✅ | ✅ (own subject) |
  | Teachers | ✅ | ❌ |
  | Reports | ✅ | ❌ |
  | WhatsApp | ✅ | ❌ |
  | **Users** (new) | ✅ | ❌ |
- **Per-route `beforeLoad` guards** on `fees`, `teachers`, `reports`, `whatsapp-logs`, `users` → redirect teachers to `/dashboard`.

---

## 🅱 Batch B — Admin Section Improvements (UX + logic)

### 1. Dashboard (`dashboard.tsx`) — full-page, clickable widgets
- Stat cards become **clickable** → navigate to relevant page (Total Students→/students, Collected→/fees, Pending→/fees?pending=1, Present Today→/attendance).
- Add new widgets:
  - **Today's Birthdays** (if we add `dob` later — for now: "Newest Admissions" last 7 days)
  - **This Month Collection vs Last Month** (delta %)
  - **Class-wise Student Distribution** (pie/donut)
  - **Top 5 Pending Fees** (already exists — keep)
  - **Upcoming Tests** (next 7 days)
  - **Attendance % This Month** (overall)
- Use `xl:grid-cols-4` for stats, `xl:grid-cols-3` for widget row → uses full-width on 1504px.
- **Teacher dashboard** (when `isTeacher`):
  - "My Lectures This Month" count + list
  - "My Attendance %" 
  - "Tests pending marks entry" (their subject only)

### 2. Students (`students.tsx`) — cleaner, sorted, compact
- **Sort students by class ascending** (5th → 12th) then by name. Add `sortByClass` helper using a numeric class-rank map.
- **Layout rework**: replace 35/65 split with a **toggleable detail drawer** on the right (or modal on mobile). Default view = full-width compact table with columns: Name · Class · Board · Medium · Batch · Fees Status · Actions. Click row → opens side drawer (Sheet component) with tabs.
- **Active/Inactive toggle filter** at top.
- **Quick-action toolbar**: bulk mark inactive, bulk export selected.
- Keep existing form, but reorder fields: Name → Mobile → Class → Board → Medium → Batch → Subjects → Fees → Discount → Due day → Lecture days.

### 3. Fees (`fees.tsx`) — admin-only, better placement
- **Route guard**: redirect teachers to /dashboard.
- Add **Class breakdown card** (collected per class).
- Add **Payment mode breakdown** (Cash/UPI/Bank chips with totals).
- **Recent payments feed** (last 10) on right side panel.
- Move "Bulk Remind" into an **overflow menu** with "Export pending list".
- Add **date range filter** for payments shown.

### 4. Attendance (`attendance.tsx`) — improved UX
- **Two-tab layout**: "Mark Today" | "History".
- Mark tab: keep current grid but add **Present/Absent toggle buttons per row** (clearer than checkbox), color-coded rows (green=present, red=absent).
- Add **Subject/Lecture selector** so attendance is logged per lecture (requires schema change: `attendance.lecture_id` nullable; backfill null = "general day").
- History tab: monthly calendar heatmap per class, click a date → see roster.
- Keep "All Present / All Absent" but add **"Copy from yesterday"** quick action.
- Show **per-student streak** (consecutive present days) badge.

### 5. Tests (`tests.tsx`) — improved
- **Three-column layout** at xl: Test list (left) · Test details + marks (center) · Statistics (right: highest, lowest, average, pass %).
- Add **Test Type** (Weekly/Monthly/Term) selector + filter.
- After saving marks: show **rank table** (1st, 2nd, 3rd with badges).
- Add **WhatsApp result share** button per student row in marks table.
- Test list shows **completion %** (how many students have marks entered).

### 6. Teachers (`teachers.tsx`) — auto-link with users
- When admin creates a teacher login in Users page with role=teacher and links to a teacher row → that teacher row is the link. (Already covered in Batch A.)
- **Reverse**: when admin adds a teacher from Teachers page, show **"Create login"** button → opens Users dialog pre-filled with teacher_id, role=teacher, asks for email + password.
- Add **Lecture log calendar view** (month grid) per teacher.
- Add **Salary slip print** button.

### 7. Reports (`reports.tsx`) — better placement
- Move tab list to left **sidebar** at lg+ (vertical tabs) for more horizontal space.
- Add **comparative widgets** at top of each tab (current vs previous period delta).
- Add **chart** alongside each table (collection trend, attendance trend, salary trend).
- Add **"Email/WhatsApp this report"** action per tab.

### 8. WhatsApp (`whatsapp-logs.tsx`) — improved
- Add filters: **type** (reminder/attendance/test/announcement), **student search**.
- Show **message preview on hover** (full message in tooltip / expandable row).
- Add **"Resend"** button per log.
- Add **stats cards**: Total sent · This month · By type breakdown.
- Add **broadcast composer** at top: select students by class/board → compose → send.

---

## 🅲 Batch C — Teacher-specific views & polish

### Teacher Dashboard
Custom `dashboard.tsx` branch when `isTeacher`:
- "My Profile" card (linked teacher info)
- "My Today's Lectures"
- "Pending marks entry" (tests for my subject without results)
- "My Attendance %" this month

### Teacher Students view
Read-only — hide Add/Edit/Delete buttons, hide Fees tab in student detail drawer.

### Teacher Tests view
- Filter to `subject = my_teacher.subject` only.
- Hide Add Test / Delete Test buttons (admin only).
- Marks entry: full access for own subject's tests.

### Teacher Attendance
- Same grid as admin but only show classes that have lectures by this teacher (optional v1).

### Polish
- Toast on every role-blocked navigation: "This section is admin-only."
- Login page: show role on success toast ("Welcome admin / teacher").
- Add `Users` link to admin profile dropdown.

---

## Files touched (full list)

**New**
- `supabase/migrations/<ts>_rbac_user_roles.sql`
- `src/routes/_authenticated/users.tsx`
- `src/utils/users.functions.ts`
- `src/utils/users.server.ts`

**Edited**
- `src/integrations/supabase/types.ts` (regenerated)
- `src/lib/auth-context.tsx`
- `src/routes/_authenticated.tsx`
- `src/components/AdminTopNav.tsx`
- `src/routes/_authenticated/dashboard.tsx`
- `src/routes/_authenticated/students.tsx`
- `src/routes/_authenticated/fees.tsx`
- `src/routes/_authenticated/attendance.tsx`
- `src/routes/_authenticated/tests.tsx`
- `src/routes/_authenticated/teachers.tsx`
- `src/routes/_authenticated/reports.tsx`
- `src/routes/_authenticated/whatsapp-logs.tsx`

**Migration (additional, optional in Batch B)**
- `attendance.lecture_id uuid null` for per-lecture tracking (only if you want it; otherwise skip).

---

## Decisions taken (tell me to change)

1. **Two roles**: admin, teacher (no staff/front-desk for v1).
2. **First admin** = your currently logged-in user (`prakashpanchal@yashshree.com`).
3. **Email confirm** skipped — admin sets password, user logs in immediately.
4. **Self-protection**: admin cannot delete or demote themselves.
5. **Teacher subject scope**: enforced by matching `tests.subject = teachers.subject` for the linked teacher (text match, case-insensitive).
6. **Attendance `lecture_id`**: deferred to keep Batch B safe — current "daily attendance" behavior unchanged unless you ask for per-lecture.

---

## Execution order (suggested)

I recommend: **Run Batch A first** (foundation, security, ~5 files + migration), then review login as admin/teacher in preview. Then **Batch B** (large UX rework, ~8 files). Then **Batch C** (teacher-specific polish, ~3 files).

Confirm and I'll start with Batch A.

