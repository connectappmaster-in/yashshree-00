import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertAdmin, listAuthUsers, getRolesMap, getTeachersMap } from "./users.server";

export type ManagedUser = {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  role: "admin" | "teacher" | null;
  teacher_id: string | null;
  teacher_name: string | null;
};

export const listUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const [users, roles, teachers] = await Promise.all([
      listAuthUsers(),
      getRolesMap(),
      getTeachersMap(),
    ]);
    const result: ManagedUser[] = users.map((u) => {
      const r = roles.get(u.id);
      const t = r?.teacher_id ? teachers.get(r.teacher_id) : null;
      const meta = (u.user_metadata ?? {}) as { full_name?: string };
      return {
        id: u.id,
        email: u.email ?? "",
        full_name: meta.full_name?.trim() || null,
        created_at: u.created_at,
        role: (r?.role as "admin" | "teacher" | undefined) ?? null,
        teacher_id: r?.teacher_id ?? null,
        teacher_name: t?.name ?? null,
      };
    });
    result.sort((a, b) => a.email.localeCompare(b.email));
    return { users: result };
  });

const createUserSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(72),
  full_name: z.string().trim().min(1, "Full name required").max(100),
  role: z.enum(["admin", "teacher"]),
  teacher_id: z.string().uuid().nullable().optional(),
});

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createUserSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { email: actorEmail } = await assertAdmin(context.userId);

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error || !created.user) throw new Error(error?.message || "Failed to create user");

    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
      user_id: created.user.id,
      role: data.role,
      teacher_id: data.role === "teacher" ? data.teacher_id ?? null : null,
    });
    if (roleError) {
      // rollback auth user
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error(roleError.message);
    }

    await supabaseAdmin.from("audit_logs").insert({
      user_id: context.userId,
      user_email: actorEmail,
      action: "user_created",
      entity: "user",
      entity_id: created.user.id,
      details: { email: data.email, full_name: data.full_name, role: data.role, teacher_id: data.teacher_id ?? null } as never,
    });

    return { id: created.user.id };
  });

const updateUserSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().trim().email().max(255).optional(),
  password: z.string().min(6).max(72).optional().nullable(),
  full_name: z.string().trim().min(1).max(100).optional(),
  role: z.enum(["admin", "teacher"]).optional(),
  teacher_id: z.string().uuid().nullable().optional(),
});

export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateUserSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { email: actorEmail } = await assertAdmin(context.userId);

    // Self-protection: cannot demote self away from admin
    if (data.userId === context.userId && data.role && data.role !== "admin") {
      throw new Error("You cannot remove your own admin role.");
    }

    const updates: { email?: string; password?: string; user_metadata?: { full_name: string } } = {};
    if (data.email) updates.email = data.email;
    if (data.password) updates.password = data.password;
    if (data.full_name) updates.user_metadata = { full_name: data.full_name };
    if (Object.keys(updates).length > 0) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, updates);
      if (error) throw new Error(error.message);
    }

    if (data.role) {
      // Replace role row (one role per user)
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
      const { error } = await supabaseAdmin.from("user_roles").insert({
        user_id: data.userId,
        role: data.role,
        teacher_id: data.role === "teacher" ? data.teacher_id ?? null : null,
      });
      if (error) throw new Error(error.message);
    } else if (data.teacher_id !== undefined) {
      // Just relink teacher
      const { error } = await supabaseAdmin
        .from("user_roles")
        .update({ teacher_id: data.teacher_id })
        .eq("user_id", data.userId)
        .eq("role", "teacher");
      if (error) throw new Error(error.message);
    }

    await supabaseAdmin.from("audit_logs").insert({
      user_id: context.userId,
      user_email: actorEmail,
      action: "user_updated",
      entity: "user",
      entity_id: data.userId,
      details: { email: data.email, full_name: data.full_name, role: data.role, teacher_id: data.teacher_id ?? null, password_changed: !!data.password } as never,
    });

    return { success: true };
  });

const deleteUserSchema = z.object({ userId: z.string().uuid() });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => deleteUserSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { email: actorEmail } = await assertAdmin(context.userId);
    if (data.userId === context.userId) {
      throw new Error("You cannot delete your own account.");
    }
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_logs").insert({
      user_id: context.userId,
      user_email: actorEmail,
      action: "user_deleted",
      entity: "user",
      entity_id: data.userId,
      details: {} as never,
    });
    return { success: true };
  });
