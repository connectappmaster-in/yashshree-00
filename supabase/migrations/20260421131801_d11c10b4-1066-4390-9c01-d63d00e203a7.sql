-- Create audit_logs table for activity tracking
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  user_email TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view everything
CREATE POLICY "Admins view audit_logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Any authenticated user can insert their own log row
CREATE POLICY "Authenticated insert audit_logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- Useful indexes
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs (entity, entity_id);
CREATE INDEX idx_audit_logs_user ON public.audit_logs (user_id);