import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, watchProgress, watchlist, favorites } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import { guardAdmin, hashPassword, STORE_PLAINTEXT_PASSWORDS } from "@/lib/serverAuth";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

function shape(u: typeof users.$inferSelect) {
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    email: u.email,
    // Empty when the account predates plaintext capture, or when capture is disabled.
    // Hashes cannot be reversed, so the admin sets a new password instead.
    password: u.passwordPlain || "",
    hasPassword: Boolean(u.passwordHash),
    phone: u.phone || "",
    role: u.role,
    isPremium: u.isPremium,
    plan: u.plan,
    isBlocked: u.isBlocked,
    createdAt: u.createdAt,
  };
}

/** GET — full user list + summary counters */
export async function GET(request: NextRequest) {
  const gate = guardAdmin(request);
  if (!gate.ok) return gate.response;
  try {
    await ensureSeeded();
    const all = await db.select().from(users).orderBy(desc(users.createdAt), desc(users.id));

    // "Today" is measured in the admin's own timezone offset (minutes, as sent by the browser)
    const offsetMin = Number(new URL(request.url).searchParams.get("tzOffset"));
    const off = Number.isFinite(offsetMin) ? offsetMin : 0;
    const localDay = (d: Date) => new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
    const today = localDay(new Date());

    const list = all.map(shape);
    return gate.seal(
      NextResponse.json({
        users: list,
        stats: {
          total: list.length,
          today: all.filter((u) => localDay(u.createdAt) === today).length,
          premium: list.filter((u) => u.isPremium).length,
          free: list.filter((u) => !u.isPremium).length,
          blocked: list.filter((u) => u.isBlocked).length,
        },
        plaintextCapture: STORE_PLAINTEXT_PASSWORDS,
      })
    );
  } catch (error) {
    console.error("[admin/users] GET error:", error);
    return NextResponse.json({ error: "Failed to load users" }, { status: 500 });
  }
}

/** PATCH — { id, action: 'premium'|'free'|'block'|'unblock'|'set_password', password? } */
export async function PATCH(request: NextRequest) {
  const gate = guardAdmin(request);
  if (!gate.ok) return gate.response;
  try {
    await ensureSeeded();
    const body = await request.json().catch(() => ({}));
    const id = Number(body.id);
    const action = String(body.action || "");
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }

    const [target] = await db.select().from(users).where(eq(users.id, id));
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

    let patch: Partial<typeof users.$inferInsert>;
    switch (action) {
      case "premium":
        patch = { isPremium: true, plan: "premium" };
        break;
      case "free":
        patch = { isPremium: false, plan: "free" };
        break;
      case "block":
        patch = { isBlocked: true };
        break;
      case "unblock":
        patch = { isBlocked: false };
        break;
      case "set_password": {
        const pw = String(body.password || "");
        if (pw.length < 4) {
          return NextResponse.json({ error: "Password must be at least 4 characters" }, { status: 400 });
        }
        patch = { passwordHash: hashPassword(pw), passwordPlain: STORE_PLAINTEXT_PASSWORDS ? pw : "" };
        break;
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const [updated] = await db.update(users).set(patch).where(eq(users.id, id)).returning();
    return gate.seal(NextResponse.json({ user: shape(updated) }));
  } catch (error) {
    console.error("[admin/users] PATCH error:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

/** DELETE ?id= — removes the account and its personal rows */
export async function DELETE(request: NextRequest) {
  const gate = guardAdmin(request);
  if (!gate.ok) return gate.response;
  try {
    await ensureSeeded();
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }
    const [target] = await db.select().from(users).where(eq(users.id, id));
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Clean up data owned by this account so nothing is orphaned
    await db.delete(watchProgress).where(eq(watchProgress.userId, id));
    await db.delete(watchlist).where(eq(watchlist.clientKey, `user-${id}`));
    await db.delete(favorites).where(eq(favorites.clientKey, `user-${id}`));
    await db.delete(users).where(eq(users.id, id));

    return gate.seal(NextResponse.json({ deleted: true, id }));
  } catch (error) {
    console.error("[admin/users] DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
