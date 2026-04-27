-- 1) Tighten teacher SELECT on attendance: only rows for students in their assigned classes
DROP POLICY IF EXISTS "Teachers view attendance" ON public.attendance;

CREATE POLICY "Teachers view attendance own classes"
ON public.attendance
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'teacher'::public.app_role)
  AND public.teacher_can_mark_student(student_id)
);

-- 2) Revoke EXECUTE from anon on definer helpers that are NOT meant for anon use
-- (keeps log_audit_event_anon callable since it's the whitelisted anon path for failed-login logging)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_user_teacher_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_user_teacher_subject() FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_audit_event(text, text, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_students_safe() FROM anon;
REVOKE EXECUTE ON FUNCTION public.teacher_can_mark_student(uuid) FROM anon;