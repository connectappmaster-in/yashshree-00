

# Plan — Add Board field with cascading Medium

## Logic
- **Board options:** `CBSE`, `SSC`
- **Medium options (depends on Board):**
  - CBSE → `English` only
  - SSC → `Marathi`, `Semi English`, `English`

## DB change
Add `board` column to `students` table:
```sql
ALTER TABLE students ADD COLUMN board text NOT NULL DEFAULT 'SSC';
```
Backfill existing rows: any student whose current `medium` is `CBSE` → `board='CBSE', medium='English'`; everyone else → `board='SSC'` and map old mediums (`Hindi`/`SSC` → `Marathi` as safest default; `English` stays `English`; `Marathi` stays `Marathi`).

Regenerate `src/integrations/supabase/types.ts`.

## Code changes

### 1. `src/routes/_authenticated/students.tsx` (StudentForm)
- Replace `MEDIUMS` constant with:
  ```ts
  const BOARDS = ["CBSE", "SSC"] as const;
  const MEDIUMS_BY_BOARD = {
    CBSE: ["English"],
    SSC: ["Marathi", "Semi English", "English"],
  };
  ```
- Add `board` to form state (default `"SSC"`).
- Add **Board** Select between Class and Medium.
- When board changes → reset `medium` to first allowed value for that board.
- Medium Select renders `MEDIUMS_BY_BOARD[form.board]`.
- Persist `board` in insert/update payload.

### 2. Students list filter (top of page)
- Add a **Board** filter Select (`All / CBSE / SSC`).
- Keep Medium filter but make its options reflect ALL mediums (`Marathi`, `Semi English`, `English`) — or make it cascade off the Board filter too. **Recommended: cascade** — when Board=All show all mediums; when Board=CBSE show only English; when Board=SSC show SSC mediums.
- Show `s.board` next to `s.medium` in row display: `{s.class} • {s.board} • {s.medium}`.
- Update "Clear filters" to reset board too.

### 3. `src/routes/_authenticated/reports.tsx`
- Same `BOARDS` + `MEDIUMS_BY_BOARD` constants.
- Add Board filter alongside Class/Medium filters in Students tab.
- Apply board filter in `filteredStudents`.
- Add `Board` column to CSV export and table.

### 4. `src/routes/_authenticated/fees.tsx`
- Display `{s.class} • {s.board} {s.medium}` in row.
- (No board filter needed unless desired — keep minimal.)

### 5. Student detail header in `students.tsx` (line 239)
- Show: `{mobile} • {class} • {board} {medium} • {batch} Batch`.

## Files touched
- supabase migration (new file)
- `src/integrations/supabase/types.ts` (regenerated)
- `src/routes/_authenticated/students.tsx`
- `src/routes/_authenticated/reports.tsx`
- `src/routes/_authenticated/fees.tsx`

No changes to attendance/tests/teachers — they don't reference medium meaningfully beyond display.

## Note on existing data
Old rows with `medium='Hindi'` will be backfilled to `board='SSC', medium='Marathi'` (closest match). User should review after migration runs. I'll add a one-time toast or just trust the backfill.

