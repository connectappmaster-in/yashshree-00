import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/**
 * Shared `beforeLoad` guards for routes. Run on the client (parent
 * `_authenticated` route disables SSR), so they can use the persisted
 * Supabase session in localStorage.
 *
 * Replaces the old client-side `<AdminGuard>` wrapper which only hid
 * the UI after first render — `beforeLoad` blocks navigation entirely
 * so non-admins never see a flash of admin content.
 */

type Role = "admin" | "teacher" | null;

// Tiny in-memory cache so back/forward and rapid nav between admin
// routes don't re-query `user_roles` on every transition. Invalidated
// on sign-in/out via the auth state listener below.
let cached: { userId: string; role: Role; at: number } | null = null;
const TTL_MS = 60_000;

if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
      cached = null;
    }
  });
}

async function getRole(userId: string): Promise<Role> {
  if (cached && cached.userId === userId && Date.now() - cached.at < TTL_MS) {
    return cached.role;
  }
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error || !data || data.length === 0) {
    cached = { userId, role: null, at: Date.now() };
    return null;
  }
  const role: Role = data.some((r) => r.role === "admin")
    ? "admin"
    : data.some((r) => r.role === "teacher")
      ? "teacher"
      : null;
  cached = { userId, role, at: Date.now() };
  return role;
}

/**
 * Block navigation to an admin-only route. Redirects to `/login` if the
 * user has no session, or to `/dashboard` if they're signed in but not
 * an admin (teachers shouldn't see admin pages even briefly).
 */
export async function requireAdmin() {
  if (typeof window === "undefined") return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    throw redirect({ to: "/login" });
  }
  const role = await getRole(session.user.id);
  if (role !== "admin") {
    throw redirect({ to: "/dashboard" });
  }
}
