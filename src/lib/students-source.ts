import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the correct Supabase source for reading student rows.
 *
 * - Admins read the base `students` table (includes `mobile`).
 * - Teachers read the `students_safe` view (excludes `mobile`, hidden via
 *   a SECURITY DEFINER function at the database layer).
 *
 * Mutations (insert/update/delete) must always use `supabase.from("students")`
 * directly — the view is read-only and admin-only writes are enforced by RLS.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function studentsReadFrom(isAdmin: boolean): any {
  if (isAdmin) return supabase.from("students");
  return (supabase as any).from("students_safe");
}
