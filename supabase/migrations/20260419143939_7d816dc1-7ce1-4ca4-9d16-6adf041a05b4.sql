-- Add academic_year columns
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS academic_year text NOT NULL DEFAULT '2025-26';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS academic_year text NOT NULL DEFAULT '2025-26';
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS academic_year text NOT NULL DEFAULT '2025-26';
ALTER TABLE public.lectures ADD COLUMN IF NOT EXISTS academic_year text NOT NULL DEFAULT '2025-26';

-- Backfill (safety, in case defaults didn't apply)
UPDATE public.students SET academic_year = '2025-26' WHERE academic_year IS NULL;
UPDATE public.payments SET academic_year = '2025-26' WHERE academic_year IS NULL;
UPDATE public.attendance SET academic_year = '2025-26' WHERE academic_year IS NULL;
UPDATE public.lectures SET academic_year = '2025-26' WHERE academic_year IS NULL;

-- Teacher payment type
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS payment_type text NOT NULL DEFAULT 'per_lecture';
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS fixed_salary numeric NOT NULL DEFAULT 0;

-- Teacher attendance table
CREATE TABLE IF NOT EXISTS public.teacher_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'present',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, date)
);
ALTER TABLE public.teacher_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users full access on teacher_attendance"
  ON public.teacher_attendance FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tests table
CREATE TABLE IF NOT EXISTS public.tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  standard text NOT NULL,
  subject text NOT NULL,
  test_date date NOT NULL DEFAULT CURRENT_DATE,
  max_marks numeric NOT NULL DEFAULT 100,
  academic_year text NOT NULL DEFAULT '2025-26',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users full access on tests"
  ON public.tests FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Test results table
CREATE TABLE IF NOT EXISTS public.test_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL,
  student_id uuid NOT NULL,
  marks_obtained numeric NOT NULL DEFAULT 0,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (test_id, student_id)
);
ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users full access on test_results"
  ON public.test_results FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- App settings table (theme, preferences)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users full access on app_settings"
  ON public.app_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_students_academic_year ON public.students(academic_year);
CREATE INDEX IF NOT EXISTS idx_payments_academic_year ON public.payments(academic_year);
CREATE INDEX IF NOT EXISTS idx_attendance_academic_year ON public.attendance(academic_year);
CREATE INDEX IF NOT EXISTS idx_tests_standard_year ON public.tests(standard, academic_year);
CREATE INDEX IF NOT EXISTS idx_test_results_test ON public.test_results(test_id);
CREATE INDEX IF NOT EXISTS idx_teacher_attendance_date ON public.teacher_attendance(date);