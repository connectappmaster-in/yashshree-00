

# Yashshree Classes — Implementation Plan

## Summary
Build the complete coaching institute management app from scratch: database tables, admin auth, sidebar layout, and all 7 modules (Dashboard, Students, Fees, Attendance, Teachers, Reports, WhatsApp Logs).

---

## Phase 1: Database Setup (Supabase Migration)

Create all 6 tables with RLS policies allowing full access to authenticated users (single admin):

- **students** — id (uuid PK), name (text), mobile (text), class (text), medium (text), subjects (text[]), admission_date (date), total_fees (numeric), discount (numeric default 0), batch (text), lecture_days (text[]), fee_due_day (int), status (text default 'active'), created_at
- **payments** — id, student_id (FK cascade), amount (numeric), payment_date (date), payment_mode (text), notes (text), created_at
- **attendance** — id, student_id (FK cascade), date (date), status (text), created_at, unique(student_id, date)
- **teachers** — id, name, subject, per_lecture_fee (numeric), created_at
- **lectures** — id, teacher_id (FK cascade), date, subject, batch, created_at
- **whatsapp_logs** — id, student_id (FK cascade), message, sent_at (timestamptz), type (text)

RLS: Enable on all tables. Since this is a single-admin app with hardcoded credentials, policies will allow all operations for authenticated users.

## Phase 2: Authentication

- **Server function** to validate admin credentials (hardcoded server-side: admin/yashshree2024)
- **Auth context** via router context — stores `isAuthenticated` in React state (session cookie or state-based)
- **Login page** at `/login` — simple form with username + password
- **Protected layout route** `_authenticated.tsx` — redirects to `/login` if not authenticated

## Phase 3: App Layout

- **Sidebar** using shadcn Sidebar component with navigation links: Dashboard, Students, Fees, Attendance, Teachers, Reports, WhatsApp Logs
- **Header** with SidebarTrigger + "Yashshree Classes" branding
- Mobile-responsive with collapsible sidebar

## Phase 4: Pages (all under `_authenticated`)

### Dashboard (`_authenticated/index.tsx`)
- 4 summary cards (Total Students, Fees Collected, Pending Fees, Today's Attendance)
- Monthly revenue bar chart using Recharts (last 6 months)
- Quick action buttons

### Students (`_authenticated/students.tsx`)
- Data table with search + filter by class/medium
- Add/Edit dialog: all fields including subjects multi-select, lecture days multi-select
- Final fees = total_fees - discount (auto-calculated)
- Delete with AlertDialog confirmation

### Fees (`_authenticated/fees.tsx`)
- Table showing each student's fee status (total, paid via SUM of payments, remaining, overdue status)
- Expandable/dialog view for payment history per student
- Add payment form (amount, date, mode)
- "Send Reminder" button → opens `wa.me/91{mobile}?text=...` + logs to whatsapp_logs
- "Bulk Reminder" button for all pending students

### Attendance (`_authenticated/attendance.tsx`)
- Date picker + class/batch filters
- Checkbox grid for marking present/absent
- Bulk save
- Per-student attendance percentage view

### Teachers (`_authenticated/teachers.tsx`)
- CRUD for teachers
- Log lectures with date/subject/batch
- Monthly salary calculation (count lectures × per_lecture_fee)
- Payout summary table

### Reports (`_authenticated/reports.tsx`)
- Tabs: Student List, Pending Fees, Monthly Collection, Teacher Salary
- Filter by class + medium
- Export to CSV functionality

### WhatsApp Logs (`_authenticated/whatsapp-logs.tsx`)
- Table of all sent reminders with student name, message, date, type
- Filter by date range

## Phase 5: Shared Components

- `AppSidebar` — navigation sidebar
- `StudentForm` — reusable add/edit student form
- `PaymentForm` — add payment dialog
- `AttendanceGrid` — checkbox grid for bulk attendance

## Technical Details

- **Data fetching**: TanStack Query with Supabase client for all CRUD operations
- **Forms**: react-hook-form + zod validation
- **Charts**: Recharts (already installed)
- **Date handling**: date-fns (already installed)
- **Toasts**: sonner for notifications
- **No new dependencies needed** — everything required is already installed
- WhatsApp links use `window.open()` with `wa.me` URLs, no API integration

