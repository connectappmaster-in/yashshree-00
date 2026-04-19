-- Add academic_year to teacher_attendance
ALTER TABLE public.teacher_attendance
  ADD COLUMN IF NOT EXISTS academic_year text NOT NULL DEFAULT '2025-26';

-- Add unique constraints needed for upsert onConflict
CREATE UNIQUE INDEX IF NOT EXISTS attendance_student_date_unique ON public.attendance (student_id, date);
CREATE UNIQUE INDEX IF NOT EXISTS teacher_attendance_teacher_date_unique ON public.teacher_attendance (teacher_id, date);
CREATE UNIQUE INDEX IF NOT EXISTS test_results_test_student_unique ON public.test_results (test_id, student_id);

-- Add foreign keys with cascade so deleting a student/teacher/test removes related data cleanly
ALTER TABLE public.attendance
  DROP CONSTRAINT IF EXISTS attendance_student_id_fkey,
  ADD CONSTRAINT attendance_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_student_id_fkey,
  ADD CONSTRAINT payments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

ALTER TABLE public.whatsapp_logs
  DROP CONSTRAINT IF EXISTS whatsapp_logs_student_id_fkey,
  ADD CONSTRAINT whatsapp_logs_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

ALTER TABLE public.lectures
  DROP CONSTRAINT IF EXISTS lectures_teacher_id_fkey,
  ADD CONSTRAINT lectures_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE CASCADE;

ALTER TABLE public.teacher_attendance
  DROP CONSTRAINT IF EXISTS teacher_attendance_teacher_id_fkey,
  ADD CONSTRAINT teacher_attendance_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE CASCADE;

ALTER TABLE public.test_results
  DROP CONSTRAINT IF EXISTS test_results_test_id_fkey,
  DROP CONSTRAINT IF EXISTS test_results_student_id_fkey,
  ADD CONSTRAINT test_results_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.tests(id) ON DELETE CASCADE,
  ADD CONSTRAINT test_results_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;