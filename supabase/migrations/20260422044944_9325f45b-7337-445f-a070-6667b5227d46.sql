INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role
FROM auth.users u
WHERE u.email = 'admin@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id
  );