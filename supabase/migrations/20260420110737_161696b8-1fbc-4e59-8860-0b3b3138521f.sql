-- Add board column to students
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS board text NOT NULL DEFAULT 'SSC';

-- Backfill: rows whose medium is CBSE → board=CBSE, medium=English
UPDATE public.students
SET board = 'CBSE', medium = 'English'
WHERE medium ILIKE 'CBSE';

-- Normalize SSC mediums
UPDATE public.students
SET board = 'SSC', medium = 'Marathi'
WHERE medium ILIKE 'Hindi' OR medium ILIKE 'SSC';

UPDATE public.students
SET board = 'SSC'
WHERE medium IN ('Marathi', 'Semi English', 'English') AND board <> 'CBSE';
