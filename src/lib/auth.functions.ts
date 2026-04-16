import { createServerFn } from "@tanstack/react-start";
import { useSession, updateSession, clearSession } from "@tanstack/react-start/server";

const sessionConfig = {
  password: process.env.SESSION_SECRET || "yashshree-fallback-secret-key-minimum-32-chars",
  name: "yashshree-session",
  maxAge: 60 * 60 * 24 * 7,
};

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "yashshree2024";

export const loginFn = createServerFn({ method: "POST" })
  .inputValidator((data: { username: string; password: string }) => data)
  .handler(async ({ data }) => {
    if (data.username === ADMIN_USERNAME && data.password === ADMIN_PASSWORD) {
      await updateSession(sessionConfig, { isAuthenticated: true, username: ADMIN_USERNAME });
      return { success: true };
    }
    return { success: false, error: "Invalid credentials" };
  });

export const logoutFn = createServerFn({ method: "POST" }).handler(async () => {
  await clearSession(sessionConfig);
  return { success: true };
});

export const getAuthFn = createServerFn({ method: "GET" }).handler(async () => {
  const session = await useSession<{ isAuthenticated?: boolean; username?: string }>(sessionConfig);
  return {
    isAuthenticated: session.data.isAuthenticated === true,
    username: session.data.username || null,
  };
});
