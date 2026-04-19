

# Yashshree Classes — Major Feature Expansion

## Summary
Big expansion: split Students/Fees, add Test Reports module, attendance reporting with WhatsApp delivery, teacher attendance, theme toggle, academic year filtering, and PDF/Excel exports.

---

## 1. Database Changes (Migration)

**New columns:**
- `students.standard` — keep existing `class` but add 5th, 6th, 7th to allowed values (UI-level, no constraint change needed since `class` is text)
- `students.academic_year` text default `'2025-26'`
- `payments.academic_year` text default `'2025-26'`
- `attendance.academic_year` text default `'2025-26'`
- `lectures.academic_year` text default `'2025-26'`

**New tables:**
- `teacher_attendance` (id, teacher_id, date unique with teacher_id, status, created_at)
- `teachers.payment_type` text default `'per_lecture'` ('per_lecture' | 'fixed'), `teachers.fixed_salary` numeric default 0
- `tests` (id, name, standard, subject, test_date, max_marks, academic_year, created_at)
- `test_results` (id, test_id, student_id unique with test_id, marks_obtained, remarks, created_at)
- `app_settings` (id, key unique, value jsonb) — for theme/preferences

**Data backfill:** Set all existing students/payments/attendance/lectures to `academic_year = '2025-26'`.

---

## 2. Class Options Update
Update CLASSES constant everywhere from `["8th","9th","10th","11th","12th"]` to `["5th","6th","7th","8th","9th","10th","11th","12th"]` in: students-fees, attendance, reports, dashboard, tests pages.

---

## 3. Top Navigation Restructure

New nav order:
**Dashboard | Students | Fees | Attendance | Test Reports | Teachers | Reports**

- Academic Year dropdown (working): `2025-26`, `2026-27` — filters all queries via context
- Theme toggle button (sun/moon icon) — toggles light/dark mode via `next-themes` style class on `<html>`

---

## 4. Route Restructure

**Split** `students-fees.tsx` into:
- `src/routes/_authenticated/students.tsx` — full student management with detail view containing tabs: Info, Fees, Attendance, Tests & Progress
- `src/routes/_authenticated/fees.tsx` — fees-focused view (payment entry, pending list, collection)

**New:**
- `src/routes/_authenticated/tests.tsx` — Test Reports module (weekly tests per standard, mark entry, progress)

**Update:**
- `src/routes/_authenticated/teachers.tsx` — add Attendance tab + payment type (Fixed / Per Lecture)
- `src/routes/_authenticated/attendance.tsx` — already exists, add academic year filter
- `src/routes/_authenticated/reports.tsx` — add Attendance report tab + send-to-WhatsApp + PDF/Excel exports

---

## 5. Academic Year Context

Create `src/lib/academic-year-context.tsx` — Provider holding selected year, persisted to localStorage. All data queries filter by selected year. Wrap layout with provider.

---

## 6. Student Detail View (in Students page)

Tabs in right panel:
- **Info** — basic details + edit
- **Fees** — payment summary + history + add payment
- **Attendance** — calendar/list of student's attendance with monthly %
- **Tests & Progress** — test scores, line chart of progress over time

---

## 7. Test Reports Module

- Left: list of tests (filter by standard, academic year)
- Right: Add test form (name, standard, subject, date, max marks) + mark entry table for all students of that standard
- Per-student progress view inside Students detail tab

---

## 8. Teacher Attendance & Payment

In Teachers page:
- Add tab/section for daily teacher attendance (mark present/absent like student attendance)
- Edit teacher form: payment type radio (Fixed / Per Lecture) → conditional input
- Salary calculation: if fixed → fixed_salary; else → lectures × per_lecture_fee

---

## 9. Reports Tab Additions

New tabs:
- **Attendance Report** — date range, per student or class, with present/absent days and %
- Existing tabs: Students, Pending, Collection, Salary

**WhatsApp Send:** Button on attendance report row → opens dialog with frequency (Weekly / Monthly / Quarterly / Yearly), generates summary text, opens `wa.me/<mobile>?text=<msg>` and logs to `whatsapp_logs`.

**Export buttons on every report:** CSV (existing), **Excel (.xlsx)** via `xlsx` library, **PDF** via `jspdf` + `jspdf-autotable`.

---

## 10. Theme Toggle

- Add `ThemeProvider` (simple, no extra deps — toggle `dark` class on `<html>`, persist to localStorage)
- Sun/Moon button in top nav
- `styles.css` already has `.dark` variants — verify and refine

---

## Files to Create/Modify

| Action | File |
|--------|------|
| Migration | Add columns, new tables (teacher_attendance, tests, test_results, app_settings) + backfill |
| Create | `src/lib/academic-year-context.tsx` |
| Create | `src/lib/theme-context.tsx` |
| Create | `src/routes/_authenticated/students.tsx` (split, with tabs) |
| Create | `src/routes/_authenticated/fees.tsx` (split) |
| Create | `src/routes/_authenticated/tests.tsx` (new module) |
| Delete | `src/routes/_authenticated/students-fees.tsx` |
| Modify | `src/components/AdminTopNav.tsx` (new menu order, theme button, working year dropdown) |
| Modify | `src/routes/_authenticated.tsx` (wrap with providers) |
| Modify | `src/routes/_authenticated/teachers.tsx` (attendance + payment type) |
| Modify | `src/routes/_authenticated/attendance.tsx` (year filter, add 5th-7th) |
| Modify | `src/routes/_authenticated/reports.tsx` (attendance tab, PDF/Excel exports, WhatsApp send) |
| Modify | `src/routes/_authenticated/dashboard.tsx` (year filter) |
| Modify | `src/styles.css` (verify dark theme tokens) |

**Dependencies to add:** `xlsx`, `jspdf`, `jspdf-autotable`

---

## Notes
- All mutations invalidate React Query keys including academic year for live updates
- New student admissions default to year selected in dropdown
- Date-based auto-assignment: admissions before April 2026 → `2025-26`; April 2026 onwards → `2026-27`
- Theme persists across sessions via localStorage
- WhatsApp messages use existing `wa.me` link approach (no Twilio needed)

