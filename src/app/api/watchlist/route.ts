import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { watchlist, favorites } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import { and, eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    await ensureSeeded();
    const { searchParams } = new URL(request.url);
    const clientKey = searchParams.get("clientKey") || "guest-default";

    const items = await db
      .select()
      .from(watchlist)
      .where(eq(watchlist.clientKey, clientKey));

    const favs = await db
      .select()
      .from(favorites)
      .where(eq(favorites.clientKey, clientKey));

    return NextResponse.json({ watchlist: items, favorites: favs });
  } catch (error) {
    console.error("Error fetching watchlist:", error);
    return NextResponse.json(
      { error: "Failed to fetch watchlist" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureSeeded();
    const body = await request.json();
    const clientKey = body.clientKey || "guest-default";
    const mediaType = body.mediaType || "movie";
    const mediaId = Number(body.mediaId);
    const listType = body.listType || "watchlist"; // 'watchlist' | 'favorites'

    const table = listType === "favorites" ? favorites : watchlist;

    const existing = await db
      .select()
      .from(table)
      .where(
        and(
          eq(table.clientKey, clientKey),
          eq(table.mediaType, mediaType),
          eq(table.mediaId, mediaId)
        )
      );

    if (existing.length > 0) {
      await db.delete(table).where(eq(table.id, existing[0].id));
      return NextResponse.json({ removed: true, item: existing[0] });
    }

    const [created] = await db
      .insert(table)
      .values({ clientKey, mediaType, mediaId })
      .returning();

    return NextResponse.json({ added: true, item: created }, { status: 201 });
  } catch (error) {
    console.error("Error updating watchlist:", error);
    return NextResponse.json(
      { error: "Failed to update watchlist" },
      { status: 500 }
    );
  }
}
