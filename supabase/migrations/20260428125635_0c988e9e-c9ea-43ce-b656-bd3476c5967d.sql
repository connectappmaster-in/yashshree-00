-- Lock down SECURITY DEFINER helpers so they cannot be invoked directly via the
-- public API (PostgREST). They continue to work when referenced from RLS
-- policies because policies execute with the policy owner's privileges.

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_user_teacher_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_user_teacher_subject() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.teacher_can_mark_student(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_students_safe() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

-- Audit logging: keep RPC access for the intended callers only.
REVOKE EXECUTE ON FUNCTION public.log_audit_event(text, text, text, jsonb) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.log_audit_event(text, text, text, jsonb) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.log_audit_event_anon(text, text, text, jsonb, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.log_audit_event_anon(text, text, text, jsonb, text) TO anon, authenticated;