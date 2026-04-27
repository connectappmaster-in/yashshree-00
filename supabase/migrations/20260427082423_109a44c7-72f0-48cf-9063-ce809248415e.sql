-- Revoke from PUBLIC (which includes anon) and re-grant only to authenticated.
-- These functions are internal helpers; signed-out users have no business calling them.

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.current_user_teacher_id() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.current_user_teacher_id() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.current_user_teacher_subject() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.current_user_teacher_subject() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.log_audit_event(text, text, text, jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.log_audit_event(text, text, text, jsonb) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_students_safe() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_students_safe() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.teacher_can_mark_student(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.teacher_can_mark_student(uuid) TO authenticated;