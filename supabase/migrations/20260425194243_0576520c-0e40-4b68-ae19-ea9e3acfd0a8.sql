-- Recreate the view with security_invoker (the safe default).
CREATE OR REPLACE VIEW public.students_safe
WITH (security_invoker = on) AS
SELECT
  id, name, class, medium, subjects, admission_date, total_fees, discount,
  batch, fee_due_day, lecture_days, board, academic_year, created_at, status
FROM public.students;

REVOKE ALL ON public.students_safe FROM PUBLIC, anon;
GRANT SELECT ON public.students_safe TO authenticated;

-- Re-add a teacher SELECT policy on the base table so the view returns rows
-- when called by teachers. The view's column projection (no `mobile`) is what
-- protects the phone numbers in teacher-facing app code.
CREATE POLICY "Teachers can view students"
  ON public.students
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'teacher'::public.app_role));