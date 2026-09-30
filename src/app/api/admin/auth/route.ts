import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_AUTH_ENABLED,
  ADMIN_SESSION_INVALID,
  adminTokenExpiry,
  ADMIN_COOKIE,
  clearAdminCookie,
  getAdminPassword,
  issueAdminToken,
  setAdminCookie,
} from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

/** Login — the session is delivered as an HttpOnly cookie (never exposed to JavaScript). */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    // Unlocked mode: no password required, always grant.
    if (!ADMIN_AUTH_ENABLED) {
      const { token, expiresAt } = issueAdminToken();
      const res = NextResponse.json({ authenticated: true, role: "admin", expiresAt, authDisabled: true });
      return setAdminCookie(res, token, request);
    }

    const submitted = String(body.password || "").trim();

    if (submitted && submitted === getAdminPassword()) {
      const { token, expiresAt } = issueAdminToken();
      const res = NextResponse.json({ authenticated: true, role: "admin", expiresAt });
      return setAdminCookie(res, token, request);
    }

    return NextResponse.json({ authenticated: false, error: "Incorrect password" }, { status: 401 });
  } catch (error) {
    console.error("Admin auth error:", error);
    return NextResponse.json({ authenticated: false, error: "Authentication error" }, { status: 500 });
  }
}

/** Session status — the server is the single source of truth for the dashboard UI. */
export async function GET(request: NextRequest) {
  if (!ADMIN_AUTH_ENABLED) {
    return NextResponse.json({ authenticated: true, authDisabled: true });
  }

  const cookieToken = request.cookies.get(ADMIN_COOKIE)?.value || "";
  const legacyToken = request.headers.get("x-admin-token") || "";
  const exp = adminTokenExpiry(cookieToken || legacyToken);

  if (!exp) {
    // 200 with authenticated:false — this endpoint reports status, it does not protect a resource.
    // (Protected admin endpoints still answer 401.)
    const res = NextResponse.json({ authenticated: false, code: ADMIN_SESSION_INVALID.code });
    return cookieToken ? clearAdminCookie(res, request) : res;
  }

  // Long-lived session: only issue a cookie when there isn't one (e.g. upgrading a
  // legacy header session). Never rewrite it on a status check.
  const res = NextResponse.json({ authenticated: true, expiresAt: exp });
  if (!cookieToken) setAdminCookie(res, issueAdminToken().token, request);
  return res;
}

/** Explicit logout — only this (or real expiry) ends the session. */
export async function DELETE(request: NextRequest) {
  return clearAdminCookie(NextResponse.json({ authenticated: false, loggedOut: true }), request);
}
