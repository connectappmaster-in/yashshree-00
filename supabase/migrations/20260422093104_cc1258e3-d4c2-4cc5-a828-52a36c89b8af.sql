-- 1. Drop the insecure insert policy that allows arbitrary audit forging
DROP POLICY IF EXISTS "Authenticated insert audit_logs" ON public.audit_logs;

-- 2. Create a SECURITY DEFINER function that stamps user_id + user_email server-side
CREATE OR REPLACE FUNCTION public.log_audit_event(
  _action text,
  _entity text,
  _entity_id text DEFAULT NULL,
  _details jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text;
  _new_id uuid;
BEGIN
  -- Require an authenticated session
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Look up the real email server-side (cannot be spoofed by client)
  SELECT email INTO _email FROM auth.users WHERE id = _uid;

  INSERT INTO public.audit_logs (user_id, user_email, action, entity, entity_id, details)
  VALUES (_uid, _email, _action, _entity, _entity_id, COALESCE(_details, '{}'::jsonb))
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;

-- 3. Allow authenticated users to call the function; the function itself is the gate
REVOKE ALL ON FUNCTION public.log_audit_event(text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_audit_event(text, text, text, jsonb) TO authenticated;

-- 4. Variant for unauthenticated audit (e.g. failed-login attempts) — only stamps what is given,
-- never accepts a user_id, and is rate-limit-friendly because it goes through one function.
CREATE OR REPLACE FUNCTION public.log_audit_event_anon(
  _action text,
  _entity text,
  _entity_id text DEFAULT NULL,
  _details jsonb DEFAULT '{}'::jsonb,
  _attempted_email text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_id uuid;
BEGIN
  -- Only allow a small whitelist of actions for anonymous logging
  IF _action NOT IN ('login_failed') THEN
    RAISE EXCEPTION 'Action % not permitted for anonymous audit', _action;
  END IF;

  INSERT INTO public.audit_logs (user_id, user_email, action, entity, entity_id, details)
  VALUES (NULL, _attempted_email, _action, _entity, _entity_id, COALESCE(_details, '{}'::jsonb))
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_audit_event_anon(text, text, text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_audit_event_anon(text, text, text, jsonb, text) TO anon, authenticated;