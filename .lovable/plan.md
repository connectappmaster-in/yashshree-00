

# Deep Audit Round 3 — Yashshree Classes

After thorough review, most prior issues are fixed. Here's what **still needs work**, grouped by severity. No code changes yet — approve and I'll implement.

---

## 🔴 Critical bugs (real impact)

1. **Reports → Students/Pending count mismatch.** `students` query has no `.eq("status", "active")`, so the **Students** tab shows inactive students mixed with active. But the **Pending Fees** tab filters `status === "active"`. Inconsistent — admin sees different totals on the same page.

2. **Reports → Salary tab counts lectures across all batches but not for inactive teachers.** No issue per se, but `workingDays` is global (any teacher present) so a teacher who joined mid-month gets `presentDays/workingDays` like `8/22` even if only 8 working days existed for them. Misleading.

3. **Students.tsx form fallback `Number(form.total_fees)` (line 500).** Display-only, but if user types `abc`, "Final" shows `NaN`. Should use `safeNum`.

4. **`MarksEntryTable` initial state stale across test switches.** When you switch from Test A to Test B, the local `marks` state from Test A persists (only cleared on save). Switching tests → entering marks → switching back can corrupt entries. Reset `marks` on `test.id` change via `useEffect`.

5. **Attendance "All Present/Absent" only fills currently-filtered students**, but if user changes filter after, the previous bulk values stay in pending state (now applied to wrong cohort). Minor but confusing.

6. **WhatsApp Logs page is not AY-scoped.** Logs across all years show together — can grow unbounded. No date-default (last 30 days), no pagination. Will lag once 1000+ logs exist.

---

## 🟠 High-priority logic / UX

7. **Reports → Collection tab uses AY-filtered `payments` query**, but `monthPayments` filter restricts further by month. If a payment was logged with the wrong AY (cross-year), it won't appear. Should use `allPayments` and filter only by month.

8. **Reports `reportMonth` is shared across Collection / Attendance / Salary tabs** but the actual fetched `lectures`/`teacherAtt` queries depend on it. Switching the month picker on one tab silently re-renders others. OK behavior but no visual hint.

9. **Reports `<input type="month">` (lines 268, 310, 357) is unstyled raw HTML** — inconsistent with shadcn UI used elsewhere.

10. **Landing page (`/`) still uses hash-anchor nav** (`#home`, `#courses`, `#features`, `#contact`). Per TanStack docs this kills SEO/SSR. Each major section should be its own route OR explicitly accept hash-only nav.

11. **`whatsapp-logs.tsx` `dateFrom` filter compares `log.sent_at < dateFrom`** as strings. `sent_at` is an ISO timestamp like `2025-04-20T10:30:00Z`, `dateFrom` is `2025-04-20`. String compare works because ISO sorts lexicographically — but **only if the user types YYYY-MM-DD**, which they do via the date input. OK but fragile; explicit Date conversion is safer.

12. **AdminTopNav: nav items overflow horizontally on tablet (md, ~768-1024px)**. With 8 items + icons, they truncate or scroll. Mobile menu kicks in at `md:hidden` but **between 768-1024px the bar is cramped**.

13. **No scroll-restoration on route change.** TanStack supports `scrollRestoration: true` in router config — not enabled. After scrolling far in Students list and clicking a student, then back, you lose position.

14. **No route preloading.** `defaultPreload: "intent"` not set on router. Hovering a nav link doesn't prefetch.

15. **Students table has no sortable columns.** Sorted only by name.

16. **Tests page has no filter chip showing active filter** — just "No tests yet" if filter yields zero, but it's actually filtered, not empty.

---

## 🟡 Medium UX

17. **No empty-state hints when filters are active** (Students, Fees, Tests, Attendance, Reports).

18. **No duplicate-student check** (same name+mobile can be added twice silently).

19. **No favicon, no `<link rel="manifest">`, no theme-color meta.** Browser tab shows generic icon; mobile address bar not branded.

20. **No global error boundary inside `_authenticated`.** Only router-level `defaultErrorComponent` (and even that is missing — `__root.tsx` has no `defaultErrorComponent`!). If a Supabase query throws inside a tab, the whole app crashes to a generic screen.

21. **No date-range picker on Reports** — only month-by-month. Year-end reporting needs from-to.

22. **Mobile nav (< sm)** hides "Yashshree Classes" brand text *and* the Year dropdown is only inside hamburger. The user clicked menu → sees year. But on mid-mobile (`sm` 640+), Year dropdown shows in topbar but hamburger menu also shows it = **duplicate dropdown** between 640-768px.

23. **No print-friendly Student profile / fee statement.**

24. **No CSV import** for bulk student onboarding.

25. **`AcademicYearProvider` initial state mismatches `localStorage` after mount.** First render uses derived AY, then `useEffect` may swap to stored value → flash of wrong AY badge. Minor (SSR is off for `_authenticated`), but visible.

26. **Reports Salary card shows `0/0 days` for fixed teachers when no attendance recorded** — confusing. Should hide or say "No attendance logged".

27. **`teachers.tsx` `BATCHES` constant unused** (line 26) — dead code, `LectureForm` hardcodes `["Morning", "Evening"]` inline.

---

## 🟢 Polish / industry-standards (defer-eligible)

28. **No PWA manifest** for install-to-home-screen.
29. **No offline indicator.**
30. **No audit trail** (who changed what, when) — high value for fees deletion.
31. **No role separation.** Single admin; any login = full admin. Should add `user_roles` table with `has_role()` security definer + RLS.
32. **No 2FA / password reset link visible.**
33. **No full DB backup/restore export.**
34. **No analytics events.**
35. **No Ctrl+K command palette** (industry-standard for admin apps).
36. **No optimistic updates** on attendance / payment — feels laggy on slow networks.

---

## Linking & Navigation Audit

| Link / Flow | Status |
|---|---|
| `/` Landing → `/login` (Admin Login button) | ✅ |
| `/login` → `/dashboard` after successful login | ✅ (no flash, blank shell rendered) |
| `/login` ← `/` (no back link from login) | ⚠️ minor |
| Navbar: Dashboard, Students, Fees, Attendance, Tests, Teachers, Reports, WhatsApp Logs | ✅ all reachable |
| Dashboard "View All" → `/fees` | ✅ |
| Dashboard sendReminder → wa.me + log + toast | ✅ |
| 404 fallback (`/random-url`) | ✅ via `notFoundComponent` in `__root.tsx` |
| Router-level `defaultErrorComponent` | ❌ **missing** |
| `_authenticated` `beforeLoad` auth check | ✅ |
| `_authenticated` per-route error boundary | ❌ none |
| Landing hash anchors `#home/#courses/#features/#contact` | ⚠️ in-page only (#10) |
| Logout → returns to `/login` | ✅ via auth context |

---

## Recommended fix batches

### Batch G — Critical correctness + structure (~4 files)
Fix #1, #3, #4, #6 (default last-30-days), #7, #20 (add `defaultErrorComponent`).
Files: `reports.tsx`, `students.tsx`, `tests.tsx`, `whatsapp-logs.tsx`, `router.tsx`.

### Batch H — UX & navigation polish (~5 files)
Fix #9 (replace raw month inputs with shadcn Input), #12 (collapse nav at lg not md), #13+14 (router scroll + preload), #17 (empty-state hints), #19 (favicon + theme-color), #22 (mobile nav dedup), #26 (hide 0/0 days), #27 (remove dead code).
Files: `router.tsx`, `__root.tsx`, `index.html`, `AdminTopNav.tsx`, `reports.tsx`, `teachers.tsx`, `students.tsx`, `fees.tsx`, `attendance.tsx`.

### Batch I — Larger features (defer — ask before)
- #10 Landing hash → routes split (services, about, contact)
- #15 Sortable Students table
- #18 Duplicate-student check
- #21 Date-range picker on Reports
- #23 Print-friendly profile
- #24 CSV import
- #28 PWA manifest
- #30/31 Audit trail + roles (RLS overhaul)
- #35 Ctrl+K palette
- #36 Optimistic updates

---

## Decisions needed before Batch G

**For #6 WhatsApp Logs:** default view should be (a) last 30 days, (b) last 7 days, (c) all-time but paginated 50/page, or (d) AY-scoped via studentMap join?

**For #12 nav breakpoint:** collapse to hamburger at (a) `lg:` (1024px — current `md:` is too tight) or (b) keep `md:` but reduce icon+text to icon-only between md-lg?

**My recommendation:** Run **Batch G + H in one go** (~9 files, no DB migration). For #6 use (a) last-30-days default; for #12 use (a) `lg:` breakpoint. Defer Batch I — ask one feature at a time.

