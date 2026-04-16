import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { loginFn, logoutFn } from "./auth.functions";

interface AuthState {
  isAuthenticated: boolean;
  username: string | null;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({
  children,
  initialAuth,
}: {
  children: ReactNode;
  initialAuth: { isAuthenticated: boolean; username: string | null };
}) {
  const [auth, setAuth] = useState(initialAuth);

  const login = useCallback(async (username: string, password: string) => {
    const result = await loginFn({ data: { username, password } });
    if (result.success) {
      setAuth({ isAuthenticated: true, username });
    }
    return result;
  }, []);

  const logout = useCallback(async () => {
    await logoutFn();
    setAuth({ isAuthenticated: false, username: null });
  }, []);

  return (
    <AuthContext.Provider value={{ ...auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
