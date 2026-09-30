import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, siteSettings } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import { DEFAULT_PLATFORM_SETTINGS } from "@/lib/defaults";
import {
  ADMIN_COOKIE,
  getAuthenticatedUserId,
  hashPassword,
  STORE_PLAINTEXT_PASSWORDS,
  verifyAdminToken,
  issueUserToken,
  verifyPassword,
} from "@/lib/serverAuth";
import { eq } from "drizzle-orm";

function sanitizeUser(u: typeof users.$inferSelect) {
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    email: u.email,
    phone: u.phone || "",
    role: u.role,
    avatarUrl: u.avatarUrl || "",
    bio: u.bio || "",
    preferredLang: u.preferredLang,
    isEmailVerified: u.isEmailVerified,
    isPhoneVerified: u.isPhoneVerified,
    isPremium: u.isPremium,
    plan: u.plan,
    createdAt: u.createdAt,
  };
}

// GET: current user (from token). Admins may list users (no password data).
export async function GET(request: NextRequest) {
  try {
    await ensureSeeded();
    const { searchParams } = new URL(request.url);

    if (searchParams.get("list") === "1") {
      // NOTE: admin auth is disabled everywhere else, but this endpoint is deliberately
      // still gated. It is NOT used by the admin dashboard, and it returns every
      // registered user's email address — leaving it open would publish that list to
      // anyone on the internet for no functional benefit.
      // To open it too, delete this block.
      if (!verifyAdminToken(request.cookies.get(ADMIN_COOKIE)?.value || request.headers.get("x-admin-token"))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const allUsers = await db.select().from(users);
      return NextResponse.json({ users: allUsers.map(sanitizeUser) });
    }

    const userId = getAuthenticatedUserId(request);
    if (!userId) return NextResponse.json({ user: null }, { status: 401 });
    const [u] = await db.select().from(users).where(eq(users.id, userId));
    if (!u) return NextResponse.json({ user: null }, { status: 401 });
    return NextResponse.json({ user: sanitizeUser(u) });
  } catch (error) {
    console.error("Error in GET /api/auth:", error);
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureSeeded();
    const body = await request.json().catch(() => ({}));
    const action = body.action || "login";

    const [settingsRow] = await db
      .select()
      .from(siteSettings)
      .where(eq(siteSettings.key, "main"));
    const config = { ...DEFAULT_PLATFORM_SETTINGS, ...(settingsRow?.data || {}) };

    if (action === "register") {
      if (!config.registrationEnabled) {
        return NextResponse.json(
          { error: "التسجيل متوقف مؤقتاً من قبل الإدارة / Registration is currently disabled" },
          { status: 403 }
        );
      }

      const email = String(body.email || "").toLowerCase().trim();
      const password = String(body.password || "");
      const name = String(body.name || email.split("@")[0] || "Naz Member").trim();
      const username = String(
        body.username ||
          email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "") ||
          `naz_${Date.now().toString().slice(-4)}`
      ).trim();
      const phone = String(body.phone || "").trim();

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 4) {
        return NextResponse.json(
          { error: "يرجى إدخال بريد صحيح وكلمة مرور (4 أحرف على الأقل) / Valid email and password (min 4 chars) required" },
          { status: 400 }
        );
      }

      if (config.requirePhoneVerification && !phone) {
        return NextResponse.json(
          { error: "رقم الهاتف مطلوب للتسجيل حالياً / Phone number is required" },
          { status: 400 }
        );
      }

      const existing = await db.select().from(users).where(eq(users.email, email));
      if (existing.length > 0) {
        return NextResponse.json(
          { error: "البريد الإلكتروني مسجل مسبقاً / Email is already registered" },
          { status: 409 }
        );
      }

      const [created] = await db
        .insert(users)
        .values({
          name,
          username,
          email,
          passwordHash: hashPassword(password),
          passwordPlain: STORE_PLAINTEXT_PASSWORDS ? password : "",
          phone,
          role: "member",
          preferredLang: body.preferredLang === "en" ? "en" : "ar",
          isEmailVerified: !config.requireEmailVerification,
          isPhoneVerified: !config.requirePhoneVerification,
          isPremium: false,
          plan: "free",
          bio: "",
        })
        .returning();

      return NextResponse.json(
        {
          user: sanitizeUser(created),
          token: issueUserToken(created.id),
          verificationNotice:
            config.requireEmailVerification || config.requirePhoneVerification
              ? "Verification required by admin settings"
              : "Immediate access granted",
        },
        { status: 201 }
      );
    }

    if (action === "login") {
      const email = String(body.email || "").toLowerCase().trim();
      const password = String(body.password || "");
      const [found] = await db.select().from(users).where(eq(users.email, email));

      if (found?.isBlocked) {
        return NextResponse.json(
          { error: "تم حظر هذا الحساب. يرجى التواصل مع الإدارة / This account has been blocked" },
          { status: 403 }
        );
      }

      if (!found || !verifyPassword(password, found.passwordHash)) {
        return NextResponse.json(
          { error: "بيانات الدخول غير صحيحة / Invalid email or password" },
          { status: 401 }
        );
      }

      // Upgrade legacy plain-text passwords transparently
      if (!found.passwordHash.startsWith("scrypt$")) {
        await db
          .update(users)
          .set({
            passwordHash: hashPassword(password),
            passwordPlain: STORE_PLAINTEXT_PASSWORDS ? password : "",
          })
          .where(eq(users.id, found.id));
      }

      return NextResponse.json({ user: sanitizeUser(found), token: issueUserToken(found.id) });
    }

    if (action === "reset_password") {
      const email = String(body.email || "").toLowerCase().trim();
      const username = String(body.username || "").trim();
      const newPassword = String(body.newPassword || "");

      if (!email || !username || newPassword.length < 4) {
        return NextResponse.json(
          { error: "البريد واسم المستخدم وكلمة المرور الجديدة مطلوبة / Email, username and new password required" },
          { status: 400 }
        );
      }

      const [found] = await db.select().from(users).where(eq(users.email, email));
      if (!found || found.username.toLowerCase() !== username.toLowerCase()) {
        return NextResponse.json(
          { error: "البيانات غير مطابقة / Account details do not match" },
          { status: 404 }
        );
      }

      const [updated] = await db
        .update(users)
        .set({
          passwordHash: hashPassword(newPassword),
          passwordPlain: STORE_PLAINTEXT_PASSWORDS ? newPassword : "",
        })
        .where(eq(users.id, found.id))
        .returning();

      return NextResponse.json({
        user: sanitizeUser(updated),
        token: issueUserToken(updated.id),
        resetSuccess: true,
      });
    }

    if (action === "edit_profile") {
      const userId = getAuthenticatedUserId(request);
      if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const [found] = await db.select().from(users).where(eq(users.id, userId));
      if (!found) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const [updated] = await db
        .update(users)
        .set({
          name: body.name ?? found.name,
          username: body.username ?? found.username,
          phone: body.phone ?? found.phone,
          bio: body.bio ?? found.bio,
          preferredLang: body.preferredLang ?? found.preferredLang,
        })
        .where(eq(users.id, userId))
        .returning();

      return NextResponse.json({ user: sanitizeUser(updated) });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error in POST /api/auth:", error);
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}
