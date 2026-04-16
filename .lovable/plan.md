

# Yashshree Classes — Full Rebuild Plan

## Summary
Rebuild the app into two distinct parts: a **public marketing website** (landing page) and a **compact admin panel** with top navigation (no sidebar). Includes a full color theme update, merged Students & Fees module, and all requested UI/UX improvements.

---

## Part 1: Public Website

**New route file:** `src/routes/index.tsx` (public landing page, NOT behind auth)

Sections:
- **Header**: Logo + "Yashshree Coaching Classes", nav links (Home, Courses, Features, Contact), "Admin Login" button linking to `/login`
- **Hero**: Dark blue (#1E2A5A) background, "Admission Open 2026-27", class highlights (8-10 SSC/CBSE, 11-12 Commerce, 11-12 Science), student illustration on right, yellow accents
- **Courses**: 3 cards — SSC/CBSE (8-10), Commerce (11-12 Morning & Evening), Science (11-12)
- **Features**: Grid of highlights — experienced teachers, limited admissions, personal guidance, best results, board exam prep
- **Contact**: Address (Kamte Plaza, Shivane, Pune-23), mobiles (9405402865 / 9850740805), Call button, WhatsApp button
- **Footer**: Branding, address, mobile numbers

**Design**: Professional coaching website look, dark blue + yellow theme from pamphlet.

---

## Part 2: Admin Panel Restructure

### Layout Changes
- **Delete** `src/components/AppSidebar.tsx` (sidebar removed)
- **Create** `src/components/AdminTopNav.tsx` — horizontal top navigation bar
  - Dark Blue (#1E2A5A) background
  - Logo / "Yashshree Classes" on left
  - Tabs: Dashboard | Students & Fees | Attendance | Teachers | Reports
  - Active tab: Yellow (#FFD700) underline
  - Right side: Academic Year dropdown, user email, Logout button
- **Rewrite** `src/routes/_authenticated.tsx` — use top nav instead of sidebar, remove SidebarProvider

### Route Changes
- **Merge** Students + Fees into `src/routes/_authenticated/students-fees.tsx` (split-screen layout)
- **Delete** `src/routes/_authenticated/fees.tsx` (merged)
- **Keep** attendance, teachers, reports, whatsapp-logs routes (whatsapp-logs accessible from within students-fees)
- **Move** current `src/routes/index.tsx` → becomes public landing page
- **Admin dashboard** stays at `/_authenticated/` route

### Color Theme Update (`src/styles.css`)
- Primary: Dark Blue (#1E2A5A)
- Accent/buttons: Yellow (#FFD700)
- Secondary: Purple (#7B1FA2)
- Background: Light grey
- Cards: White with soft shadows

### Dashboard (`/_authenticated/index.tsx`)
- Compact stat cards: Total Students, Fees Collected, Pending Fees, Today Attendance
- Revenue chart (keep existing Recharts)
- Top 10 pending fees list with quick reminder buttons
- No wasted space

### Students & Fees Module (`/_authenticated/students-fees.tsx`) — Core
**Split-screen layout:**
- **Left panel (40%)**: Student list with inline filters (class, medium, search), "Pending Fees Only" toggle (default ON), table with Name, Class, Medium, Total Fees, Remaining Fees, color-coded (red=pending, green=paid), sorted by highest pending first
- **Right panel (60%)**: Selected student details — info card, fees summary (Total/Paid/Remaining in BIG RED), Add Payment button (yellow), WhatsApp Reminder button (green), payment history (latest first), edit/delete actions

### Attendance (`/_authenticated/attendance.tsx`)
- Keep existing fast toggle UI
- Minor styling updates to match new theme

### Teachers (`/_authenticated/teachers.tsx`)
- Keep existing functionality, update styling

### Reports (`/_authenticated/reports.tsx`)
- Keep existing tabs, update styling

### WhatsApp Integration
- Keep existing wa.me link approach
- Accessible from Students & Fees panel per-student and bulk

---

## Part 3: UI/UX Enhancements

### Animations (CSS + Tailwind)
- Page transitions: fade/slide in
- Button hover: subtle scale
- Card hover: shadow lift
- Table row: highlight on hover

### Mobile Responsive
- Top nav collapses to hamburger menu
- Split-screen stacks vertically on mobile
- Tables horizontally scrollable

### Forms
- Two-column layout, compact inputs, labels on top

### Login Page
- Update styling to match new dark blue + yellow theme

---

## Files to Create/Modify

| Action | File |
|--------|------|
| Create | `src/routes/index.tsx` (public landing page) |
| Create | `src/components/AdminTopNav.tsx` |
| Create | `src/routes/_authenticated/students-fees.tsx` |
| Rewrite | `src/routes/_authenticated.tsx` (top nav layout) |
| Rewrite | `src/routes/_authenticated/index.tsx` (dashboard) |
| Rewrite | `src/routes/_authenticated/attendance.tsx` (theme) |
| Rewrite | `src/routes/_authenticated/teachers.tsx` (theme) |
| Rewrite | `src/routes/_authenticated/reports.tsx` (theme) |
| Rewrite | `src/routes/login.tsx` (theme) |
| Rewrite | `src/styles.css` (new color theme) |
| Rewrite | `src/routes/__root.tsx` (update meta) |
| Delete | `src/components/AppSidebar.tsx` |
| Delete | `src/routes/_authenticated/fees.tsx` |
| Delete | `src/routes/_authenticated/students.tsx` (replaced by students-fees) |

No database changes needed — existing tables are sufficient.

