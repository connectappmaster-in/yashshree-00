-- Lock down SECURITY DEFINER function execution
-- Revoke from PUBLIC/anon, grant only to roles that actually need them.

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_students_safe() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_teacher_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_teacher_subject() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.teacher_can_mark_student(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_audit_event(text, text, text, jsonb) FROM PUBLIC, anon;

-- Anonymous audit logger is intentionally callable by anon for failed-login tracking;
-- ensure authenticated can also call it (login flow may not yet have session).
GRANT EXECUTE ON FUNCTION public.log_audit_event_anon(text, text, text, jsonb, text) TO anon, authenticated;

-- Ensure authenticated retains access to the helper functions used by app code / RLS
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_students_safe() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_teacher_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_teacher_subject() TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_can_mark_student(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_audit_event(text, text, text, jsonb) TO authenticated;

-- Belt-and-braces: explicitly revoke direct write access on audit_logs from
-- the anon/authenticated roles. RLS already denies (no INSERT/UPDATE/DELETE
-- policy exists), but a hard REVOKE makes intent unmistakable. Writes must go
-- through log_audit_event / log_audit_event_anon SECURITY DEFINER RPCs.
REVOKE INSERT, UPDATE, DELETE ON public.audit_logs FROM anon, authenticated, PUBLIC;