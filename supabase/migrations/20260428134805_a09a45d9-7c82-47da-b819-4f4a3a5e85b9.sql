GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_students_safe() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_teacher_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_teacher_subject() TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_can_mark_student(uuid) TO authenticated;