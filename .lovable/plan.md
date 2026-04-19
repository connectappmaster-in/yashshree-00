

# Fresh Deep Audit — Yashshree Classes App (Round 2)

I re-audited every route, nav, context, and form. Most of the original 40 issues are fixed. Here are **new bugs and improvements still remaining**, grouped by severity.

---

## 🔴 Critical bugs (data correctness)

1. **Reports → Pending Fees ignores Academic Year.** `pendingData` filters `students.status === "active"` but doesn't filter by `s.academic_year === year`. Switching AY in the navbar has no effect on this tab — it shows pending across **all students of all years**, even though the AY badge says otherwise. Fix: `students.filter((s) => s.academic_year === year && s.status === "active")`.

2. **`students.tsx` payments query uses AY filter, breaks remaining-fees math.** Line 60-66: `payments` is filtered `.eq("academic_year", year)` but `studentSummary.paid` sums only those payments. A student who paid in AY 2024-25 but is still active in 2025-26 will show **inflated remaining**. The Fees and Dashboard pages already use `payments-all` correctly — Students page is the outlier.

3. **`students.tsx` PaymentForm (line 565-609) uses unsafe `Number(amount)`.** No `safeNum` guard, no `> 0` validation, no overpay confirmation. This is the second copy of `PaymentForm` (Fees page has the safe one). Two copies = bug surface — Students-page payments can record `NaN` or 0.

4. **Attendance: existing-attendance query missing AY filter.** Line 39-45: `existingAttendance` for a date queries the table without `.eq("academic_year", year)`. If two students from different AYs share the same date, you see mixed records — and `getStatus` may pick the wrong one. Add AY filter.

5. **Reports → Salary uses `presentDays > 0` for fixed teachers.** This means a teacher marked present for **even 1 day** gets full month salary, while one with 0 marked days gets ₹0. Industry expectation: fixed salary is just monthly (label clearly), or pro-rated by `present / workingDays`. Current logic is misleading either way — **show "Fixed (X/Y days present)"** label so admin understands.

6. **Login page redirect race.** `useEffect` runs after render → if user is already logged in, the login UI flashes for ~100ms before redirect. Fix: use `beforeLoad` like the docs show, or render a blank shell until `isReady`.

7. **`AcademicYearProvider` SSR mismatch risk on default value.** Default is hardcoded `"2025-26"` (line 14), but `ACADEMIC_YEARS[0]` is `"2026-27"`. The dropdown lists 2026-27 first but the initial state isn't it. New users in 2026-27 see wrong default until they change it.

---

## 🟠 High-priority logic / UX issues

8. **Students page `studentSummary` uses `Number()` not `safeNum`.** Line 110-111: `Number(p.amount)` and `Number(s.total_fees)` silently produce NaN if the DB ever has empty values. Inconsistent with Fees page.

9. **`tests.tsx` `MarksEntryTable` "Save" silently caps marks at max** (line 207: `Math.min(max, ...)`) — no warning to admin. If they enter 110/100 by typo, it saves as 100 with no notice.

10. **`teachers.tsx` `LectureForm` (line 334+) has no validation** — empty subject silently passes `.trim()` then inserts. Also no warning if logging duplicate lectures (same teacher + date + subject).

11. **`reports.tsx` Collection tab — no "all months" or year-to-date option.** Only one month at a time. For year-end reporting, admin must screenshot 12 separate exports.

12. **Reports → Attendance per-student uses `subDays`/`subMonths` from today** (line 130-137) but `attRows` uses `monthStart`/`monthEnd`. The on-screen table and the WhatsApp message report **different periods** for the same student.

13. **Landing page (`/`) uses hash-anchor nav** (`#home`, `#courses`, `#contact`). The TanStack docs explicitly flag this as bad SEO/SSR. Each section deserves its own route or the metadata should reflect it's a single-page site.

14. **Index route renders during SSR but Header has `<Link to="/login">`** — works, but no route preloading hints. Minor.

15. **`whatsapp-logs` page has no SSR-safe `ssr: false`** like the rest of `_authenticated`. Inherits parent's `ssr: false`, OK — but `students(name, mobile)` join relies on FK that doesn't exist in schema (no FK between `whatsapp_logs.student_id` and `students.id` in the visible schema). Will silently return null for student name.

16. **No "All Present/All Absent" undo.** Once clicked, only Save Attendance writes — no way to revert without reloading the page.

17. **Teachers page Lecture dialog** — `BATCHES` is defined but unused (line 26). `LectureForm` hardcodes `["Morning", "Evening"]` inline.

---

## 🟡 Medium UX

18. **No empty-state for filtered Students table** — shows "No students found" with no hint that filters are active.

19. **No keyboard shortcuts** anywhere — no `/` to focus search, no `Esc` to close dialogs (Radix handles Esc automatically actually, OK).

20. **No bulk operations for Students** — cannot deactivate multiple, cannot bulk export selected.

21. **No date-range picker for Reports** — only month picker. Industry standard is from-to date range.

22. **No "duplicate student" check** — same name + mobile can be added twice without warning.

23. **No print-friendly Student profile** — admin must screenshot.

24. **No favicon** — generic browser icon shows in tab.

25. **No `<meta>` theme-color** — mobile address bar isn't branded.

26. **Mobile: top nav scrolls horizontally** but doesn't show scroll hint. Also the Year dropdown is hidden on `< sm` (`hidden sm:block`) but DOES appear in mobile menu — **inconsistent** between md and sm breakpoints.

27. **Dashboard "Top Pending" `sendReminder` doesn't toast on success** — only on error. User has no confirmation.

28. **Reports page `sendWhatsapp` uses `subDays(7)` for "Weekly" but message says "last 7 days"** — calendar-week vs rolling-7-days ambiguity.

29. **No global error boundary inside `_authenticated`** — only the router-level `defaultErrorComponent`. If Supabase query throws inside a tab, whole page crashes.

30. **`tests.tsx` `deleteTestMut.onSuccess` invalidates `["test-results"]`** (broad key) — that key doesn't exist anymore (it's `["test-results", "by-test", id]`). This invalidation is a no-op; the only thing saving it is `setSelectedTestId(null)`.

---

## 🟢 Polish / industry-standards

31. **No PWA manifest** — admin can't install to home screen.
32. **No offline indicator** — silently fails on poor connectivity.
33. **No CSV import for students / payments** — onboarding requires manual entry.
34. **No audit trail** — who changed what, when (HIGH for fees).
35. **No role separation** — anyone with login = full admin.
36. **No 2FA / password reset flow visible** — defers to Supabase defaults.
37. **No backup/restore export of full DB** for the admin.
38. **No SMS fallback when WhatsApp fails** — single channel.
39. **No analytics events** (page views, top actions) for product insight.
40. **Reports `<input type="month">`** is unstyled raw input — inconsistent with shadcn Select/Input components used elsewhere.

---

## Linking & Navigation Audit

| Link | Status |
|---|---|
| `/` Landing → `/login` | ✅ |
| `/login` → `/dashboard` | ✅ via useEffect (slight flash, see #6) |
| `/dashboard` "View All" → `/fees` | ✅ |
| Nav: Dashboard, Students, Fees, Attendance, Tests, Teachers, Reports, **WhatsApp** | ✅ all reachable |
| Landing page hash anchors `#home #courses #features #contact` | ⚠️ in-page only, see #13 |
| 404 fallback | ✅ has `notFoundComponent` |
| Router error boundary | ✅ `defaultErrorComponent` |

---

## Recommended fix batches

### Batch E — Critical correctness (do first, ~5 files)
Fix #1, #2, #3, #4, #5 (label only), #6, #7. Files: `reports.tsx`, `students.tsx`, `attendance.tsx`, `login.tsx`, `academic-year-context.tsx`, `_authenticated.tsx`.

### Batch F — High-value UX (4 files)
Fix #8, #9, #10, #12, #15, #17, #27, #28, #30. Files: `students.tsx`, `tests.tsx`, `teachers.tsx`, `dashboard.tsx`, `reports.tsx`.

### Batch G — Polish & robustness (~6 files + favicon)
Fix #18, #21 (date-range), #22 (duplicate check), #24 (favicon), #25 (theme-color), #26, #29 (error boundary in layout), #40. Files: layout, landing meta, students form.

### Batch H — Larger features (defer until asked)
- #31 PWA manifest
- #33 CSV import
- #34/35 Audit trail + roles
- #36 Auth hardening (2FA)
- #37 Full DB backup
- #38 SMS fallback (needs backend)

---

## Decisions needed before Batch E

**For #5 fixed-salary teachers:** prefer (a) "show full salary, label as Fixed Monthly", (b) "pro-rate by present/working days", or (c) "only count if >50% attendance"?

**For #7 default AY:** should it default to (a) `ACADEMIC_YEARS[0]` (latest), (b) auto-derive from today via `deriveAcademicYear(new Date())`, or (c) keep "2025-26" explicit?

**My recommendation:** Run **Batch E + F** in one go (10 files, no DB migration, all safe). Defer G/H to separate turns. For #5 use (a) with label, for #7 use (b) auto-derive — most natural for users.

