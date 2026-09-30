import crypto from "crypto";
import { NextResponse, type NextRequest } from "next/server";

const USER_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
/**
 * Persistent admin session: the cookie lasts a year and is NOT time-expired during use.
 * It ends only on explicit logout (or if ADMIN_SESSION_SECRET / the password changes).
 */
const ADMIN_TTL_MS = 365 * 24 * 60 * 60 * 1000;

export const ADMIN_COOKIE = "naz_admin_session";
/** Custom header required on admin writes. Browsers cannot set it cross-site without a CORS preflight. */
export const ADMIN_REQUEST_HEADER = "x-naz-admin";
const LEGACY_HEADER = "x-admin-token";

export const ADMIN_SESSION_INVALID = { error: "Admin session invalid or expired", code: "ADMIN_SESSION_INVALID" } as const;

/* ------------------------------------------------------------------ *
 * ADMIN AUTH IS DISABLED (development / prototype mode)
 *
 * The admin panel is intentionally 100% unlocked: no password, no token,
 * no session, no expiry. Every admin endpoint accepts every request.
 *
 * TO RESTORE SECURITY LATER: set ADMIN_AUTH_ENABLED=1 in .env and restart.
 * All the password/session/CSRF machinery below is kept intact and will
 * start enforcing again immediately — nothing needs to be rewritten.
 * ------------------------------------------------------------------ */
export const ADMIN_AUTH_ENABLED = process.env.ADMIN_AUTH_ENABLED === "1";

/**
 * Keep an admin-readable copy of each new password in users.password_plain so the
 * Users tab can display it. Hashes are one-way, so this is the only way to show one.
 *
 * Set STORE_PLAINTEXT_PASSWORDS=0 in .env to stop capturing them (logins keep working;
 * the column simply stays empty for new accounts).
 */
export const STORE_PLAINTEXT_PASSWORDS = process.env.STORE_PLAINTEXT_PASSWORDS !== "0";
export const ADMIN_CSRF_INVALID = { error: "Missing admin request header", code: "ADMIN_CSRF_INVALID" } as const;

export function getAdminPassword() {
  return process.env.ADMIN_ACCESS_CODE || "9770327";
}

function adminSecret() {
  return process.env.ADMIN_SESSION_SECRET || `naz-admin::${getAdminPassword()}`;
}

function userSecret() {
  return (
    process.env.USER_SESSION_SECRET ||
    `naz-user::${process.env.DATABASE_URL || "local"}::${adminSecret()}`
  );
}

function hmac(secret: string, payload: string) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/* ---------------- Admin sessions (stateless, HMAC-signed, server clock only) ---------------- */

export function issueAdminToken() {
  const expiresAt = Date.now() + ADMIN_TTL_MS;
  return { token: `${expiresAt}.${hmac(adminSecret(), `admin:${expiresAt}`)}`, expiresAt };
}

/** Expiry (ms) if the signature is valid and unexpired, else 0. Verified with the SERVER clock. */
export function adminTokenExpiry(token: string | null | undefined): number {
  if (!token) return 0;
  const parts = token.split(".");
  if (parts.length !== 2) return 0;
  const [expStr, sig] = parts;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp <= 0 || Date.now() > exp) return 0;
  if (!sig) return 0;
  // Current format signs "admin:<exp>"; the previous format signed "<exp>" (kept so
  // sessions created by an earlier build keep working until they expire).
  const valid =
    safeEqual(hmac(adminSecret(), `admin:${exp}`), sig) ||
    safeEqual(hmac(adminSecret(), String(exp)), sig);
  return valid ? exp : 0;
}

export function verifyAdminToken(token: string | null | undefined): boolean {
  return adminTokenExpiry(token) > 0;
}

/**
 * Detect HTTPS behind a proxy/CDN so the session cookie can be marked Secure.
 * Different platforms advertise TLS differently, so several signals are checked.
 * Set FORCE_SECURE_COOKIES=1 to force it on in production.
 */
function isHttps(req: NextRequest | Request) {
  if (process.env.FORCE_SECURE_COOKIES === "1") return true;
  const h = (n: string) => (req.headers.get(n) || "").trim().toLowerCase();

  // If the browser already holds this cookie it was issued over HTTPS with Secure.
  // Re-issuing it without Secure would make the browser drop/replace it mid-session
  // (GET requests send no Origin header), which looked like a random logout.
  const hasSession = Boolean((req as NextRequest).cookies?.get?.(ADMIN_COOKIE)?.value);
  const insecureOrigin = h("origin").startsWith("http://") || h("x-forwarded-proto").split(",")[0].trim() === "http";
  if (hasSession && !insecureOrigin) return true;

  // Origin is sent by the browser on same-origin POST/fetch and reflects the scheme the
  // user is actually on — more reliable than proxy headers, which some platforms set to
  // "http" for the internal hop even when the public connection is HTTPS.
  const origin = h("origin");
  if (origin.startsWith("https://")) return true;
  if (origin.startsWith("http://")) return false;

  const xfp = h("x-forwarded-proto");
  if (xfp) return xfp.split(",")[0].trim() === "https";
  if (/proto=https/.test(h("forwarded"))) return true;
  if (h("x-forwarded-ssl") === "on" || h("front-end-https") === "on") return true;
  if (h("x-forwarded-scheme") === "https" || h("x-url-scheme") === "https") return true;
  if (h("referer").startsWith("https://")) return true;

  try {
    return new URL(req.url).protocol === "https:";
  } catch {
    return false;
  }
}

/** Set the session cookie: HttpOnly, Secure on HTTPS, SameSite=Lax, Path=/, explicit Max-Age. */
export function setAdminCookie(res: NextResponse, token: string, req: NextRequest | Request) {
  res.cookies.set({
    name: ADMIN_COOKIE,
    value: token,
    httpOnly: true,
    secure: isHttps(req),
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(ADMIN_TTL_MS / 1000),
  });
  return res;
}

export function clearAdminCookie(res: NextResponse, req: NextRequest | Request) {
  res.cookies.set({
    name: ADMIN_COOKIE,
    value: "",
    httpOnly: true,
    secure: isHttps(req),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const debugOn = () => process.env.ADMIN_AUTH_DEBUG === "1";

function logAuth(req: NextRequest | Request, info: Record<string, unknown>) {
  // Never logs cookies, tokens, secrets or passwords — only presence/outcome.
  if (!debugOn() && info.result === "ok") return;
  const url = (() => { try { return new URL(req.url).pathname; } catch { return "?"; } })();
  console.log(`[admin-auth] ${JSON.stringify({ rid: crypto.randomUUID().slice(0, 8), path: url, method: (req as Request).method, ...info })}`);
}

export type AdminGate =
  | { ok: false; response: NextResponse }
  | { ok: true; seal: <T extends NextResponse>(res: T) => T };

/**
 * Single entry point for admin authorization.
 *  - 401 → no / invalid / expired session (authentication)
 *  - 403 → session valid but the admin request header is missing (CSRF protection)
 * On success `seal(res)` refreshes the cookie when needed (sliding expiry) and upgrades
 * legacy header-based sessions to a cookie without forcing a re-login.
 */
export function guardAdmin(req: NextRequest): AdminGate {
  // Unlocked mode: always authorised, nothing to verify, nothing to expire.
  if (!ADMIN_AUTH_ENABLED) {
    return { ok: true, seal: (res) => res };
  }

  const cookieToken = req.cookies?.get?.(ADMIN_COOKIE)?.value || "";
  const legacyToken = req.headers.get(LEGACY_HEADER) || "";
  const usingCookie = Boolean(cookieToken);
  const token = cookieToken || legacyToken;
  const exp = adminTokenExpiry(token);

  if (!exp) {
    logAuth(req, {
      result: "unauthenticated",
      sessionPresent: Boolean(token),
      source: usingCookie ? "cookie" : legacyToken ? "legacy-header" : "none",
      expired: Boolean(token),
      status: 401,
    });
    return { ok: false, response: NextResponse.json(ADMIN_SESSION_INVALID, { status: 401 }) };
  }

  const method = (req as Request).method || "GET";
  if (!SAFE_METHODS.has(method) && req.headers.get(ADMIN_REQUEST_HEADER) !== "1") {
    logAuth(req, { result: "csrf-header-missing", sessionPresent: true, status: 403 });
    return { ok: false, response: NextResponse.json(ADMIN_CSRF_INVALID, { status: 403 }) };
  }

  // The cookie is long-lived, so it is only (re)issued when there isn't one yet —
  // e.g. upgrading a legacy header session. No periodic rewriting = no cookie churn.
  const needsRefresh = !usingCookie;
  logAuth(req, { result: "ok", source: usingCookie ? "cookie" : "legacy-header", renewed: needsRefresh, status: 200 });

  return {
    ok: true,
    seal: (res) => {
      if (needsRefresh) setAdminCookie(res, issueAdminToken().token, req);
      return res;
    },
  };
}

/** Back-compat boolean check (no cookie refresh). */
export function isAdminRequest(req: NextRequest | Request): boolean {
  if (!ADMIN_AUTH_ENABLED) return true;
  const cookie = (req as NextRequest).cookies?.get?.(ADMIN_COOKIE)?.value || "";
  return verifyAdminToken(cookie || req.headers.get(LEGACY_HEADER));
}

/* ---------------- User sessions ---------------- */

export function issueUserToken(userId: number) {
  const exp = Date.now() + USER_TTL_MS;
  const payload = `${userId}.${exp}`;
  return `${payload}.${hmac(userSecret(), `user:${payload}`)}`;
}

/** Returns the authenticated user id from the Authorization header, or null. */
export function getAuthenticatedUserId(req: NextRequest | Request): number | null {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [uid, expStr, sig] = parts;
  const userId = Number(uid);
  const exp = Number(expStr);
  if (!Number.isInteger(userId) || userId <= 0 || !exp || Date.now() > exp) return null;
  if (!safeEqual(hmac(userSecret(), `user:${uid}.${expStr}`), sig)) return null;
  return userId;
}

/* ---------------- Password hashing ---------------- */

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

/** Verifies scrypt hashes; also accepts legacy plain-text rows (upgraded on login). */
export function verifyPassword(password: string, stored: string) {
  if (!stored) return false;
  if (stored.startsWith("scrypt$")) {
    const [, salt, hash] = stored.split("$");
    const test = crypto.scryptSync(password, salt, 64).toString("hex");
    return safeEqual(test, hash);
  }
  return safeEqual(stored, password);
}
