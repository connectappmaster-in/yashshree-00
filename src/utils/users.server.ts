// Server-only helpers for user management. Never imported in client code.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function assertAdmin(userId: string): Promise<{ email: string | null }> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error("Failed to verify role");
  if (!data) throw new Error("Forbidden: admin role required");
  // Look up the actor's email so audit rows have a usable "user" column.
  // Failure here must NOT block the action — fall back to null.
  try {
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId);
    return { email: u.user?.email ?? null };
  } catch {
    return { email: null };
  }
}

export async function listAuthUsers() {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
  if (error) throw error;
  return data.users;
}

export async function getRolesMap() {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id, role, teacher_id");
  if (error) throw error;
  const map = new Map<string, { role: string; teacher_id: string | null }>();
  for (const r of data ?? []) {
    map.set(r.user_id, { role: r.role, teacher_id: r.teacher_id });
  }
  return map;
}

export async function getTeachersMap() {
  const { data, error } = await supabaseAdmin.from("teachers").select("id, name, subject");
  if (error) throw error;
  const map = new Map<string, { name: string; subject: string }>();
  for (const t of data ?? []) {
    map.set(t.id, { name: t.name, subject: t.subject });
  }
  return map;
}
