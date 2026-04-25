-- 1. Remove the teacher's direct SELECT on the base students table.
-- After this, teachers cannot read the students table directly at all.
DROP POLICY IF EXISTS "Teachers can view students" ON public.students;

-- 2. SECURITY DEFINER function returning mobile-free student rows for teachers,
-- and full rows for admins (mobile column always NULL in the function output
-- so the API surface is identical and safe by construction).
CREATE OR REPLACE FUNCTION public.get_students_safe()
RETURNS TABLE (
  id uuid,
  name text,
  class text,
  medium text,
  subjects text[],
  admission_date date,
  total_fees numeric,
  discount numeric,
  batch text,
  fee_due_day integer,
  lecture_days text[],
  board text,
  academic_year text,
  created_at timestamptz,
  status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id, s.name, s.class, s.medium, s.subjects, s.admission_date,
    s.total_fees, s.discount, s.batch, s.fee_due_day, s.lecture_days,
    s.board, s.academic_year, s.created_at, s.status
  FROM public.students s
  WHERE
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'teacher'::public.app_role);
$$;

REVOKE ALL ON FUNCTION public.get_students_safe() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_students_safe() TO authenticated;

-- 3. Wrap the function in a security_invoker view so app code can use
-- supabase.from('students_safe').select(...) ergonomically.
CREATE OR REPLACE VIEW public.students_safe
WITH (security_invoker = on) AS
SELECT * FROM public.get_students_safe();

REVOKE ALL ON public.students_safe FROM PUBLIC, anon;
GRANT SELECT ON public.students_safe TO authenticated;