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
  | "teacher_class_assigned"
  | "teacher_class_unassigned"
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
  | "teacher_classes"
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
    // Anonymous path: only used for login_failed (no session yet).
    // Routed through a SECURITY DEFINER RPC that whitelists permitted anon actions
    // and never accepts a user_id from the client (prevents spoofing).
    if (userOverride && !userOverride.id) {
      await (supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<unknown>)("log_audit_event_anon", {
        _action: action,
        _entity: entity,
        _entity_id: entity_id,
        _details: details,
        _attempted_email: userOverride.email ?? null,
      });
      return;
    }

    // Authenticated path: SECURITY DEFINER RPC stamps user_id + user_email
    // server-side from auth.uid(); client cannot forge identity or actions.
    await (supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<unknown>)("log_audit_event", {
      _action: action,
      _entity: entity,
      _entity_id: entity_id,
      _details: details,
    });
  } catch {
    // ignore — never block UX on audit failure
  }
}
