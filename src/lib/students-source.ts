import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the correct Supabase table/view to read student rows from
 * based on the caller's role.
 *
 * - Admins read the base `students` table (includes `mobile`).
 * - Teachers read the `students_safe` view (excludes `mobile`).
 *
 * Background: the `students.mobile` column is PII. Teachers do not need
 * phone numbers in the app, so we hide them at the database layer via
 * a SECURITY DEFINER function wrapped in a `students_safe` view.
 *
 * The view is not in the generated Database types, so we use a small
 * `as never` cast on the table name. Returned rows are typed as the
 * union of common columns (no `mobile`).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTable = any;

export function studentsReadFrom(isAdmin: boolean) {
  if (isAdmin) return supabase.from("students");
  return (supabase.from as AnyTable)("students_safe") as ReturnType<
    typeof supabase.from<"students">
  >;
}
