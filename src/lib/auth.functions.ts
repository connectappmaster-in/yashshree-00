import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "yashshree2024";
const SESSION_COOKIE = "yashshree-auth";
const SESSION_TOKEN = "authenticated-admin-session";

export const loginFn = createServerFn({ method: "POST" })
  .inputValidator((data: { username: string; password: string }) => data)
  .handler(async ({ data }) => {
    if (data.username === ADMIN_USERNAME && data.password === ADMIN_PASSWORD) {
      setCookie(SESSION_COOKIE, SESSION_TOKEN, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });
      return { success: true as const };
    }
    return { success: false as const, error: "Invalid credentials" };
  });

export const logoutFn = createServerFn({ method: "POST" }).handler(async () => {
  deleteCookie(SESSION_COOKIE);
  return { success: true };
});

export const getAuthFn = createServerFn({ method: "GET" }).handler(async () => {
  const token = getCookie(SESSION_COOKIE);
  return {
    isAuthenticated: token === SESSION_TOKEN,
    username: token === SESSION_TOKEN ? ADMIN_USERNAME : null,
  };
});
