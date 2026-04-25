-- Audit log filters & pagination
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at_desc ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs (entity);

-- WhatsApp logs feed & per-student lookup
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_sent_at_desc ON public.whatsapp_logs (sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_student_id ON public.whatsapp_logs (student_id);

-- Payments
CREATE INDEX IF NOT EXISTS idx_payments_student_id ON public.payments (student_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON public.payments (payment_date);

-- Attendance
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance (date);
CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON public.attendance (student_id, date);

-- Lectures
CREATE INDEX IF NOT EXISTS idx_lectures_teacher_date ON public.lectures (teacher_id, date);

-- Test results
CREATE INDEX IF NOT EXISTS idx_test_results_test_id ON public.test_results (test_id);
CREATE INDEX IF NOT EXISTS idx_test_results_student_id ON public.test_results (student_id);

-- Students (most common scoping)
CREATE INDEX IF NOT EXISTS idx_students_ay_status ON public.students (academic_year, status);

-- Prevent duplicate lecture entries at the database layer
-- (race-safe; complements the UI warning).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_lectures_teacher_date_subject_batch_ay
  ON public.lectures (teacher_id, date, lower(subject), batch, academic_year);
