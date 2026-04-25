-- ─────────────────────────────────────────────────────────────
-- 1. teacher_classes mapping table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.teacher_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  class text NOT NULL,
  batch text NOT NULL,
  academic_year text NOT NULL DEFAULT '2025-26',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT teacher_classes_unique UNIQUE (teacher_id, class, batch, academic_year)
);

-- Helpful indexes for the RLS predicate
CREATE INDEX IF NOT EXISTS idx_teacher_classes_teacher ON public.teacher_classes (teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_classes_lookup ON public.teacher_classes (teacher_id, class, batch, academic_year);

ALTER TABLE public.teacher_classes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access teacher_classes" ON public.teacher_classes;
CREATE POLICY "Admins full access teacher_classes"
  ON public.teacher_classes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Teachers view own teacher_classes" ON public.teacher_classes;
CREATE POLICY "Teachers view own teacher_classes"
  ON public.teacher_classes
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'teacher'::public.app_role)
    AND teacher_id = public.current_user_teacher_id()
  );

-- ─────────────────────────────────────────────────────────────
-- 2. SECURITY DEFINER helper: can the calling teacher mark this student?
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.teacher_can_mark_student(_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.students s
    JOIN public.teacher_classes tc
      ON tc.class = s.class
     AND tc.batch = s.batch
     AND tc.academic_year = s.academic_year
    WHERE s.id = _student_id
      AND tc.teacher_id = public.current_user_teacher_id()
  );
$$;

-- ─────────────────────────────────────────────────────────────
-- 3. Tighten attendance teacher policies
-- ─────────────────────────────────────────────────────────────
-- Replace the open INSERT / UPDATE policies; SELECT stays open
-- so teachers can still see history for their own marking workflow.
DROP POLICY IF EXISTS "Teachers insert attendance" ON public.attendance;
CREATE POLICY "Teachers insert attendance own classes"
  ON public.attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'teacher'::public.app_role)
    AND public.teacher_can_mark_student(student_id)
  );

DROP POLICY IF EXISTS "Teachers update attendance" ON public.attendance;
CREATE POLICY "Teachers update attendance own classes"
  ON public.attendance
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'teacher'::public.app_role)
    AND public.teacher_can_mark_student(student_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'teacher'::public.app_role)
    AND public.teacher_can_mark_student(student_id)
  );
