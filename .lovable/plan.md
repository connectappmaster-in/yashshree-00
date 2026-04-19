

# Audit Status Check + Remaining Fixes Plan

## What's already fixed (from prior turns)

Based on current code review:

✅ **#1** WhatsApp Logs nav link — added in `AdminTopNav.tsx`
✅ **#3** Attendance silent overwrite — fixed (only persists toggled IDs)
✅ **#4** Dashboard "Present Today" year filter — added `.eq("academic_year", year)`
✅ **#8** Cascade deletes — migration applied
✅ **#12** `beforeLoad` auth guard — moved out of `useEffect`
✅ **#13 partial** `teacher_attendance.academic_year` column added
✅ **#14** Reports tab filter isolation — separate `attClass` state
✅ **#19** Excel/PDF totals row — `appendTotalsRow` helper added
✅ **#20** PDF ₹ glyph — sanitized to "Rs." in PDF
✅ **#11** Mobile validation — 10-digit numeric validation added

## Still remaining (29 items)

### Critical (4)
- **#2** Salary calc — fixed-salary teachers ignore month/attendance
- **#5** Pending Fees AY filter mismatch (payments from prior AY excluded)
- **#6** Reports collection vs pending scope mismatch (monthly vs all-time)
- **#7** Tests `selectedTestId` invalidation key mismatch

### High (4)
- **#9** `deriveAcademicYear` fallback fragility in admission form
- **#10** Fees "Send Bulk" only opens first WhatsApp tab
- **#13 rest** Year filter not applied to teacher_attendance queries
- **#15** Dashboard reminder wording — "this month" vs next due cycle

### Medium UX (14)
- **#16** Empty-state for filtered Test Reports
- **#17** Student detail panel scroll
- **#18** Overpay confirmation
- **#21** Dark mode input border visibility
- **#22** Mobile nav consistency (year dropdown)
- **#23** Students table sortable columns
- **#24** Tests — clear mark deletes record
- **#25** Attendance "Save needed" hint after All Present/Absent
- **#26** Global Ctrl+K command palette
- **#27** Bulk WhatsApp attendance from Reports
- **#28** Quick active/inactive toggle for students
- **#29** Print-friendly payment receipt
- **#39** `parseFloat` + NaN guards
- **#40** Empty mobile guard for WhatsApp link

### Polish (7)
- **#30** Favicon / manifest
- **#31** `defaultErrorComponent` + 404 page on root
- **#32** Loading skeletons
- **#33** Optimistic updates (attendance, payments)
- **#34** Keyboard shortcuts (`/`, Ctrl+K)
- **#35** Date-range presets on Reports
- **#36/37/38** Audit trail, roles, full DB backup (larger features — defer)

---

## Implementation plan (recommended batches)

I'll group by dependency and risk:

### Batch A — Critical data fixes (do first)
Fix #2, #5, #6, #7, #13(rest), #9, #15.
Files: `reports.tsx`, `dashboard.tsx`, `fees.tsx`, `tests.tsx`, `teachers.tsx`, `students.tsx`.
No DB migration needed.

### Batch B — High-value UX fixes
Fix #10, #18, #24, #25, #28, #39, #40.
Files: `fees.tsx`, `tests.tsx`, `students.tsx`, `attendance.tsx`.

### Batch C — Polish & robustness
Fix #16, #17, #21, #22, #23, #29, #30, #31, #32, #35.
Files: `tests.tsx`, `students.tsx`, `styles.css`, `AdminTopNav.tsx`, `__root.tsx`, `router.tsx`, `index.html`, `reports.tsx`.

### Batch D — Larger features (optional, ask before)
- #26 Ctrl+K command palette (~new component)
- #27 Bulk WhatsApp attendance
- #33 Optimistic updates (per-mutation refactor)
- #34 Keyboard shortcuts
- #36/37/38 Audit log, roles table, backup export

---

## Key design decisions (need confirmation on a few)

For **#5 pending fees**: should pending = (this-AY total fees) − (all-time payments for that student) **or** (this-AY total fees) − (this-AY payments only)? Industry standard for coaching is **per-AY scope** (current behavior), but UI should label it clearly as "Pending for AY {year}".

For **#2 salary**: should fixed-salary teachers be pro-rated by attendance days, or always show full monthly fixed? Most coaching classes show full fixed salary regardless — recommend just **labeling clearly** rather than pro-rating.

For **#27 bulk WhatsApp**: since `wa.me` only opens one tab, real bulk requires a backend (Twilio/Meta API). Recommend deferring or queuing one-by-one with a "Next" button.

---

**My recommendation**: Run Batch A + B + C in one go (~12 files, no migrations, all safe edits). Defer Batch D items individually.

