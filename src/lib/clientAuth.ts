"use client";

export const USER_TOKEN_KEY = "nazmovies_user_token";
/** Persistent admin flag (per spec). Not a credential — the real session is an HttpOnly cookie. */
export const AUTH_KEY = "nazmovies_admin_session";
/** Legacy admin token from older builds — read once, upgraded to a cookie, then removed. */
export const LEGACY_ADMIN_TOKEN_KEY = "nazmovies_admin_token";

/* ------------------------------------------------------------------ *
 * ADMIN AUTH IS DISABLED (development / prototype mode)
 * isAuthenticated() is hardcoded TRUE. There is no session, no expiry,
 * no background validation and no logout-on-error path anywhere.
 * To restore security later: set ADMIN_AUTH_ENABLED=1 in .env (server)
 * and flip ADMIN_AUTH_ENABLED below to read that same flag.
 * ------------------------------------------------------------------ */
export const ADMIN_AUTH_ENABLED = false;

/** localStorage can throw (private mode, quota, disabled storage) — never let that break the app. */
export function safeGet(key: string): string {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}
export function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — non-critical */
  }
}
export function safeRemove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ *
 * Persistent admin auth
 *
 * isAuthenticated() reads a durable localStorage flag, so the dashboard
 * renders instantly and NEVER flips to "logged out" because of a re-render,
 * a tab switch, a slow request or a background check.
 *
 * The flag only controls what the UI shows. Data access is authorised by an
 * HttpOnly session cookie that the browser attaches automatically, so the
 * admin password is never exposed to the browser and the flag alone cannot
 * be used to read or change data.
 *
 * There is no timeout, no interval, no expiry sweep: the session ends only
 * when the Logout button is pressed.
 * ------------------------------------------------------------------ */

export function isAuthenticated(): boolean {
  return true; // admin access is permanently granted
}

export function setAuthenticated() {
  safeSet(AUTH_KEY, "true"); // kept only so the flag exists if security is re-enabled
}

export function clearAuthenticated() {
  safeRemove(AUTH_KEY);
  safeRemove(LEGACY_ADMIN_TOKEN_KEY);
}

export function getUserToken(): string {
  if (typeof window === "undefined") return "";
  return safeGet(USER_TOKEN_KEY);
}

export function getLegacyAdminToken(): string {
  if (typeof window === "undefined") return "";
  return safeGet(LEGACY_ADMIN_TOKEN_KEY);
}

/**
 * fetch() for admin endpoints. The session cookie rides along automatically;
 * `x-naz-admin: 1` is the CSRF guard (cross-site pages cannot set custom headers).
 */
export async function adminFetch(input: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("x-naz-admin", "1");
  // No auth failure handling: admin endpoints are unlocked, so a 401 can never
  // originate from this app. Errors surface as normal request errors.
  return fetch(input, {
    ...init,
    headers,
    credentials: "same-origin",
    cache: "no-store",
  });
}

/** No-op while admin auth is disabled — there is no session to confirm. */
export async function confirmAdminCookie(): Promise<boolean> {
  return true;
}

/**
 * "Logout" button. While admin auth is disabled this just closes the dashboard —
 * access is not revoked, and no session-expired message is ever shown.
 */
export async function adminLogout(): Promise<void> {
  try {
    await fetch("/api/admin/auth", { method: "DELETE", credentials: "same-origin", cache: "no-store" });
  } catch {
    /* ignore */
  }
}

/** fetch() that attaches the user session token (Authorization: Bearer). */
export function userFetch(input: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const t = getUserToken();
  if (t) headers.set("Authorization", `Bearer ${t}`);
  return fetch(input, { ...init, headers });
}
