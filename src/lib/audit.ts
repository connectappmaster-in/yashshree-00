import { supabase } from "@/integrations/supabase/client";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "login"
  | "login_failed"
  | "logout"
  | "payment_recorded"
  | "attendance_marked"
  | "attendance_copied"
  | "status_changed"
  | "test_marks_saved"
  | "lecture_logged"
  | "whatsapp_sent"
  | "whatsapp_broadcast"
  | "user_created"
  | "user_updated"
  | "user_deleted"
  | "export";

export type AuditEntity =
  | "student"
  | "payment"
  | "attendance"
  | "test"
  | "test_result"
  | "teacher"
  | "lecture"
  | "teacher_attendance"
  | "user"
  | "whatsapp"
  | "auth"
  | "report";

export interface AuditDetails {
  [k: string]: unknown;
}

/**
 * Best-effort audit log writer. Failures are swallowed — audit must never break the user flow.
 * RLS allows any authenticated user to insert their own row.
 * Also accepts an optional `userOverride` so we can log failed logins (no session yet)
 * while still attaching the attempted email.
 */
export async function logAudit(
  action: AuditAction,
  entity: AuditEntity,
  entity_id: string | null,
  details: AuditDetails = {},
  userOverride?: { id?: string | null; email?: string | null },
): Promise<void> {
  try {
    let userId = userOverride?.id ?? null;
    let userEmail = userOverride?.email ?? null;
    if (!userOverride) {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id ?? null;
      userEmail = user?.email ?? null;
    }
    await supabase.from("audit_logs").insert({
      user_id: userId,
      user_email: userEmail,
      action,
      entity,
      entity_id,
      details: details as never,
    });
  } catch {
    // ignore — never block UX on audit failure
  }
}
