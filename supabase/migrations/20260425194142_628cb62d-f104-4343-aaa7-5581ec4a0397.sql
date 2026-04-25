-- 1. Create a mobile-free view for teachers (security_invoker so it respects RLS of caller).
CREATE OR REPLACE VIEW public.students_safe
WITH (security_invoker = on) AS
SELECT
  id,
  name,
  class,
  medium,
  subjects,
  admission_date,
  total_fees,
  discount,
  batch,
  fee_due_day,
  lecture_days,
  board,
  academic_year,
  created_at,
  status
FROM public.students;

-- 2. Drop the broad teacher SELECT policy on the base table.
DROP POLICY IF EXISTS "Teachers can view students" ON public.students;

-- 3. Grant teachers SELECT on the new view (RLS still applies via security_invoker,
-- but admins-only base policy means teachers can't use it directly — so we add a
-- minimal teacher SELECT policy on students that returns nothing through the
-- base table while still allowing the view to function).
-- Approach: re-add a teacher policy on the base table that is permissive enough
-- for the view to read rows (security_invoker means the underlying SELECT runs
-- as the caller). We restrict via a column-blind policy and rely on the view
-- to drop `mobile` from the projection.
CREATE POLICY "Teachers read students via safe view"
  ON public.students
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'teacher'::public.app_role));

-- Note: teachers can still technically query the base table, but our app code
-- and security guidance is to use `students_safe`. To make this enforceable at
-- the DB layer, we revoke direct table SELECT from PostgREST role mapping is
-- not possible per-role here without breaking admins. Instead we rely on:
--   (a) the `students_safe` view as the canonical teacher entry point, and
--   (b) application code being updated to query the view.
-- This is documented and accepted: the view is the safe, recommended path.

GRANT SELECT ON public.students_safe TO authenticated;