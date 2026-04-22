import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

/**
 * Client-side admin guard. RLS is the real enforcement; this just keeps
 * teachers from seeing the admin UI shell. Waits for isReady so we don't
 * false-redirect during the initial role load.
 */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isReady, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isReady) return;
    if (!isAdmin) {
      toast.error("This section is admin-only.");
      router.navigate({ to: "/dashboard" });
    }
  }, [isReady, isAdmin, router]);

  if (!isReady) return null;
  if (!isAdmin) return null;
  return <>{children}</>;
}
