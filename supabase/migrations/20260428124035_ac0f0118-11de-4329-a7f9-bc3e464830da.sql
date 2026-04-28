ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS stream text NOT NULL DEFAULT 'none';