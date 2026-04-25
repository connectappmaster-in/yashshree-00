-- Replace the permissive teacher SELECT policy with one that denies teacher
-- direct reads of the base table. Teachers must use public.students_safe.
DROP POLICY IF EXISTS "Teachers read students via safe view" ON public.students;

-- No teacher SELECT policy on the base table => teachers cannot read it directly.
-- Admins are unaffected (their ALL policy remains).
-- The students_safe view remains accessible to teachers because security_invoker
-- means the view runs as the calling user — but since teachers have no SELECT
-- policy on students, the view will also return nothing for teachers.
--
-- Therefore: switch the view to security_definer so it bypasses caller RLS and
-- exposes the safe (mobile-free) projection to authenticated teachers.
CREATE OR REPLACE VIEW public.students_safe
WITH (security_invoker = off) AS
SELECT
  id, name, class, medium, subjects, admission_date, total_fees, discount,
  batch, fee_due_day, lecture_days, board, academic_year, created_at, status
FROM public.students;

-- Lock view access: only authenticated users (admins + teachers) can read it.
REVOKE ALL ON public.students_safe FROM PUBLIC, anon;
GRANT SELECT ON public.students_safe TO authenticated;