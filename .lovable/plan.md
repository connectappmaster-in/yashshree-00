# Update Subjects, Boards, and add 11/12 Stream

Standardize subject names, expand boards, and split 11/12 subjects into separate **Science** and **Commerce** streams (not combined).

## New canonical lists

**Boards** (4): `SSC`, `CBSE`, `ICSE`, `IB`

**Subjects for 5th–10th** (standardized names):
- Marathi, Hindi, Sanskrit, English, Mathematics, Science, Social Science

**Subjects for 11th & 12th — Science stream**:
- Physics, Chemistry, Mathematics, Biology, English, Information Technology, Marathi, Hindi

**Subjects for 11th & 12th — Commerce stream**:
- Accountancy, Economics, Secretarial Practice, Organisation of Commerce, Mathematics, English, Information Technology, Geography, Marathi, Hindi

### Naming standardization (applied everywhere)
- `Maths` → `Mathematics`
- `Account` → `Accountancy`
- `IT` → `Information Technology`
- `SP` → `Secretarial Practice`
- `OC` → `Organisation of Commerce`
- `Sasnkrit` (typo in spec) → `Sanskrit`

## Database change (1 migration)

Add a `stream` column to `students` to keep 11/12 Science vs Commerce separate:

```sql
ALTER TABLE public.students
  ADD COLUMN stream text NOT NULL DEFAULT 'none';
-- values: 'science' | 'commerce' | 'none' (for 5th–10th)
```

Free-text default keeps existing rows valid (`'none'`). No RLS change needed (inherits existing policies).

## Code changes

### 1. New shared catalog — `src/lib/catalog.ts`
Single source of truth so `students.tsx`, `reports.tsx`, `teachers.tsx` all import the same lists:
- `BOARDS`, `Board`, `MEDIUMS_BY_BOARD`, `ALL_MEDIUMS`
- `CLASS_OPTIONS`
- `Stream` type (`'science' | 'commerce' | 'none'`)
- `getSubjectsFor(class, stream)` → returns the right list (5–10 ignores stream; 11/12 returns Science or Commerce list)

### 2. `src/routes/_authenticated/students.tsx`
- Replace local `BOARDS`, `MEDIUMS_BY_BOARD`, `SUBJECTS_BY_CLASS` with imports from `catalog.ts`.
- Add `stream` to form state; default `'none'`.
- When class changes to `11th`/`12th`, show a **Stream** select (Science / Commerce) and auto-clear `subjects`.
- Hide the Stream select for 5th–10th and force `stream: 'none'`.
- Use `getSubjectsFor(form.class, form.stream)` for the subject checklist.
- Persist `stream` on insert/update.
- `MEDIUMS_BY_BOARD` defaults: `ICSE: ['English']`, `IB: ['English']`.

### 3. `src/routes/_authenticated/reports.tsx`
- Import `BOARDS`, `MEDIUMS_BY_BOARD`, `ALL_MEDIUMS` from `catalog.ts`.
- Add an optional **Stream** filter (All / Science / Commerce / None) in the same row as the board/medium filters — useful for 11/12 reporting.

### 4. `src/routes/_authenticated/teachers.tsx`
- Import `CLASS_OPTIONS` from `catalog.ts` (drop local re-declaration).

### 5. `src/integrations/supabase/types.ts`
Auto-regenerated after the migration — no manual edit.

## Out of scope

- Existing student rows keep their old free-text subject values (e.g. `"Maths"`, `"Business Studies"`). They remain readable. If you also want a one-time data normalization pass (rename existing values in the DB to the new standard names, and infer `stream` from existing 11/12 subjects), say so and I'll add it as a separate data update step.
- `tests.subject` and `teachers.subject` are free-text — new entries will pick from the standardized list, old entries unchanged.

## Verification

After implementation:
- New student form for 11th/12th shows a Stream select; subjects update accordingly and stay separate.
- 5th–10th forms show the 7-subject standardized list, no stream picker.
- Board dropdown shows all 4 boards in students form and reports filter.
- All subject names use full standard names project-wide.
- Build passes.
