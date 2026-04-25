import { useAuth } from "@/lib/auth-context";

/**
 * Defensive client-side hide. Real enforcement is RLS + per-route `beforeLoad`
 * guards. This just ensures admin UI shells never render for non-admins even
 * if a route forgets to add `beforeLoad`.
 */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isReady, isAdmin } = useAuth();
  if (!isReady) return null;
  if (!isAdmin) return null;
  return <>{children}</>;
}
