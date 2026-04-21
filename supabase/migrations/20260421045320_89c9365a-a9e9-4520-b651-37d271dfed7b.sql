-- 1. Roles enum + user_roles table
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'teacher');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  teacher_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_teacher_id ON public.user_roles(teacher_id);

-- 2. Security-definer helper functions (avoid recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.current_user_teacher_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT teacher_id FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'teacher'
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_user_teacher_subject()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.subject FROM public.teachers t
  JOIN public.user_roles ur ON ur.teacher_id = t.id
  WHERE ur.user_id = auth.uid() AND ur.role = 'teacher'
  LIMIT 1
$$;

-- 3. Seed first admin (current logged-in user)
INSERT INTO public.user_roles (user_id, role)
VALUES ('1e4280a6-1b3f-4c9e-9e7a-3e5b6d7c8a9f'::uuid, 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Also seed any existing auth user as admin if the hardcoded UUID doesn't match
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE email = 'prakashpanchal@yashshree.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 4. Drop old blanket policies and recreate with RBAC

-- user_roles policies
DROP POLICY IF EXISTS "Admins manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users see own role" ON public.user_roles;

CREATE POLICY "Admins manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users see own role"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- students: admins all, teachers SELECT only
DROP POLICY IF EXISTS "Authenticated users full access on students" ON public.students;

CREATE POLICY "Admins full access students"
ON public.students FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Teachers can view students"
ON public.students FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'teacher'));

-- attendance: admins all, teachers SELECT/INSERT/UPDATE
DROP POLICY IF EXISTS "Authenticated users full access on attendance" ON public.attendance;

CREATE POLICY "Admins full access attendance"
ON public.attendance FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Teachers view attendance"
ON public.attendance FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'teacher'));

CREATE POLICY "Teachers insert attendance"
ON public.attendance FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'teacher'));

CREATE POLICY "Teachers update attendance"
ON public.attendance FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'teacher'))
WITH CHECK (public.has_role(auth.uid(), 'teacher'));

-- tests: admins all, teachers SELECT only their subject
DROP POLICY IF EXISTS "Authenticated users full access on tests" ON public.tests;

CREATE POLICY "Admins full access tests"
ON public.tests FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Teachers view own subject tests"
ON public.tests FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'teacher')
  AND lower(subject) = lower(coalesce(public.current_user_teacher_subject(), ''))
);

-- test_results: admins all, teachers can manage results for their subject
DROP POLICY IF EXISTS "Authenticated users full access on test_results" ON public.test_results;

CREATE POLICY "Admins full access test_results"
ON public.test_results FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Teachers view test_results own subject"
ON public.test_results FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'teacher')
  AND EXISTS (
    SELECT 1 FROM public.tests t
    WHERE t.id = test_results.test_id
    AND lower(t.subject) = lower(coalesce(public.current_user_teacher_subject(), ''))
  )
);

CREATE POLICY "Teachers insert test_results own subject"
ON public.test_results FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'teacher')
  AND EXISTS (
    SELECT 1 FROM public.tests t
    WHERE t.id = test_results.test_id
    AND lower(t.subject) = lower(coalesce(public.current_user_teacher_subject(), ''))
  )
);

CREATE POLICY "Teachers update test_results own subject"
ON public.test_results FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'teacher')
  AND EXISTS (
    SELECT 1 FROM public.tests t
    WHERE t.id = test_results.test_id
    AND lower(t.subject) = lower(coalesce(public.current_user_teacher_subject(), ''))
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'teacher')
  AND EXISTS (
    SELECT 1 FROM public.tests t
    WHERE t.id = test_results.test_id
    AND lower(t.subject) = lower(coalesce(public.current_user_teacher_subject(), ''))
  )
);

-- lectures: admins all, teachers see own
DROP POLICY IF EXISTS "Authenticated users full access on lectures" ON public.lectures;

CREATE POLICY "Admins full access lectures"
ON public.lectures FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Teachers view own lectures"
ON public.lectures FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'teacher')
  AND teacher_id = public.current_user_teacher_id()
);

-- teacher_attendance: admins all, teachers see own
DROP POLICY IF EXISTS "Authenticated users full access on teacher_attendance" ON public.teacher_attendance;

CREATE POLICY "Admins full access teacher_attendance"
ON public.teacher_attendance FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Teachers view own teacher_attendance"
ON public.teacher_attendance FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'teacher')
  AND teacher_id = public.current_user_teacher_id()
);

-- teachers: admins all, teachers see own row
DROP POLICY IF EXISTS "Authenticated users full access on teachers" ON public.teachers;

CREATE POLICY "Admins full access teachers"
ON public.teachers FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Teachers view own teacher row"
ON public.teachers FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'teacher')
  AND id = public.current_user_teacher_id()
);

-- payments: admin only
DROP POLICY IF EXISTS "Authenticated users full access on payments" ON public.payments;

CREATE POLICY "Admins full access payments"
ON public.payments FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- whatsapp_logs: admin only
DROP POLICY IF EXISTS "Authenticated users full access on whatsapp_logs" ON public.whatsapp_logs;

CREATE POLICY "Admins full access whatsapp_logs"
ON public.whatsapp_logs FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- app_settings: admin only
DROP POLICY IF EXISTS "Authenticated users full access on app_settings" ON public.app_settings;

CREATE POLICY "Admins full access app_settings"
ON public.app_settings FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));