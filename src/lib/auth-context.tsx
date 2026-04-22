import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import type { User } from "@supabase/supabase-js";

export type AppRole = "admin" | "teacher";

// Install a one-time fetch interceptor on the client so server-fn requests
// (which go to /_serverFn/...) automatically include the Supabase JWT.
if (typeof window !== "undefined" && !(window as unknown as { __sbFetchPatched?: boolean }).__sbFetchPatched) {
  (window as unknown as { __sbFetchPatched?: boolean }).__sbFetchPatched = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    try {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;
      if (url && url.includes("/_serverFn/")) {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (token) {
          const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
          if (!headers.has("authorization")) {
            headers.set("authorization", `Bearer ${token}`);
          }
          return originalFetch(input, { ...init, headers });
        }
      }
    } catch {
      // fall through to original fetch
    }
    return originalFetch(input, init);
  };
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  isReady: boolean;
  role: AppRole | null;
  teacherId: string | null;
  isAdmin: boolean;
  isTeacher: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

async function fetchRole(userId: string): Promise<{ role: AppRole | null; teacherId: string | null }> {
  // Explicit two-pass: prefer admin first, then teacher. Avoids relying on alphabetical sort intent.
  const { data: rows, error } = await supabase
    .from("user_roles")
    .select("role, teacher_id")
    .eq("user_id", userId);
  if (error || !rows || rows.length === 0) return { role: null, teacherId: null };
  const adminRow = rows.find((r) => r.role === "admin");
  if (adminRow) return { role: "admin", teacherId: adminRow.teacher_id ?? null };
  const teacherRow = rows.find((r) => r.role === "teacher");
  if (teacherRow) return { role: "teacher", teacherId: teacherRow.teacher_id ?? null };
  return { role: null, teacherId: null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [role, setRole] = useState<AppRole | null>(null);
  const [teacherId, setTeacherId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!active) return;
      setUser(session?.user ?? null);
      if (session?.user) {
        const r = await fetchRole(session.user.id);
        if (!active) return;
        setRole(r.role);
        setTeacherId(r.teacherId);
      }
      setIsReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        const r = await fetchRole(session.user.id);
        setRole(r.role);
        setTeacherId(r.teacherId);
      } else {
        setRole(null);
        setTeacherId(null);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { success: false as const, error: error.message };
    }
    return { success: true as const };
  }, []);

  const logout = useCallback(async () => {
    // Route through the shared helper so audit logic stays in one place
    await logAudit("logout", "auth", null, {});
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
    setTeacherId(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!user,
        user,
        isReady,
        role,
        teacherId,
        isAdmin: role === "admin",
        isTeacher: role === "teacher",
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
