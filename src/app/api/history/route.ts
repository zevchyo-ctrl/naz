import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { watchProgress, movies, series, episodes } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import { getAuthenticatedUserId } from "@/lib/serverAuth";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

const COMPLETE_RATIO = 0.95;

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

// GET — the authenticated user's own history, enriched with titles/posters
export async function GET(request: NextRequest) {
  const authenticatedUserId = getAuthenticatedUserId(request);
  if (!authenticatedUserId) return unauthorized();
  try {
    await ensureSeeded();
    const rows = await db
      .select()
      .from(watchProgress)
      .where(eq(watchProgress.userId, authenticatedUserId))
      .orderBy(desc(watchProgress.updatedAt))
      .limit(500);

    const movieIds = [...new Set(rows.filter((r) => r.mediaType === "movie").map((r) => r.contentId))];
    const seriesIds = [...new Set(rows.filter((r) => r.mediaType === "series").map((r) => r.contentId))];
    const epIds = [...new Set(rows.filter((r) => r.episodeId > 0).map((r) => r.episodeId))];

    const [mRows, sRows, eRows] = await Promise.all([
      movieIds.length ? db.select().from(movies).where(inArray(movies.id, movieIds)) : [],
      seriesIds.length ? db.select().from(series).where(inArray(series.id, seriesIds)) : [],
      epIds.length ? db.select().from(episodes).where(inArray(episodes.id, epIds)) : [],
    ]);
    const mMap = new Map(mRows.map((m) => [m.id, m]));
    const sMap = new Map(sRows.map((s) => [s.id, s]));
    const eMap = new Map(eRows.map((e) => [e.id, e]));

    const items = rows
      .map((r) => {
        const parent = r.mediaType === "movie" ? mMap.get(r.contentId) : sMap.get(r.contentId);
        if (!parent) return null; // content was deleted
        const ep = r.episodeId ? eMap.get(r.episodeId) : undefined;
        return {
          id: r.id,
          mediaType: r.mediaType,
          contentId: r.contentId,
          episodeId: r.episodeId,
          seasonNumber: ep?.seasonNumber ?? r.seasonNumber,
          episodeNumber: ep?.episodeNumber ?? r.episodeNumber,
          episodeTitleAr: ep?.titleAr || "",
          episodeTitleEn: ep?.titleEn || "",
          currentTime: r.currentTime,
          duration: r.duration,
          completed: r.completed,
          updatedAt: r.updatedAt,
          titleAr: parent.titleAr,
          titleEn: parent.titleEn,
          posterUrl: parent.posterUrl,
          backdropUrl: ep?.thumbnailUrl || parent.backdropUrl,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ items });
  } catch (error) {
    console.error("GET /api/history error:", error);
    return NextResponse.json({ error: "Failed to load history" }, { status: 500 });
  }
}

// POST — upsert progress for the authenticated user
export async function POST(request: NextRequest) {
  const authenticatedUserId = getAuthenticatedUserId(request);
  if (!authenticatedUserId) return unauthorized();
  try {
    await ensureSeeded();
    const body = await request.json().catch(() => ({}));
    const mediaType = body.mediaType === "series" ? "series" : body.mediaType === "movie" ? "movie" : null;
    const contentId = Number(body.contentId);
    const episodeId = mediaType === "series" ? Number(body.episodeId) || 0 : 0;
    const currentTime = Math.max(0, Number(body.currentTime) || 0);
    const duration = Math.max(0, Number(body.duration) || 0);

    if (!mediaType || !Number.isInteger(contentId) || contentId <= 0 || !isFinite(currentTime)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Verify the content exists (and the episode belongs to the series)
    let seasonNumber = 0;
    let episodeNumber = 0;
    if (mediaType === "movie") {
      const [m] = await db.select({ id: movies.id }).from(movies).where(eq(movies.id, contentId));
      if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });
    } else {
      if (episodeId <= 0) return NextResponse.json({ error: "episodeId required" }, { status: 400 });
      const [e] = await db
        .select()
        .from(episodes)
        .where(and(eq(episodes.id, episodeId), eq(episodes.seriesId, contentId)));
      if (!e) return NextResponse.json({ error: "Not found" }, { status: 404 });
      seasonNumber = e.seasonNumber;
      episodeNumber = e.episodeNumber;
    }

    const reachedEnd =
      body.completed === true || (duration > 0 && currentTime >= duration * COMPLETE_RATIO);

    const [row] = await db
      .insert(watchProgress)
      .values({
        userId: authenticatedUserId,
        mediaType,
        contentId,
        episodeId,
        seasonNumber,
        episodeNumber,
        currentTime,
        duration,
        completed: reachedEnd,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [watchProgress.userId, watchProgress.mediaType, watchProgress.contentId, watchProgress.episodeId],
        set: {
          currentTime,
          duration: duration > 0 ? duration : sql`${watchProgress.duration}`,
          // once watched, it stays marked as watched
          completed: reachedEnd ? true : sql`${watchProgress.completed}`,
          seasonNumber,
          episodeNumber,
          updatedAt: new Date(),
        },
      })
      .returning();

    return NextResponse.json({ progress: row });
  } catch (error) {
    console.error("POST /api/history error:", error);
    return NextResponse.json({ error: "Failed to save progress" }, { status: 500 });
  }
}

// DELETE — clear the authenticated user's history (all, or one row via ?id=)
export async function DELETE(request: NextRequest) {
  const authenticatedUserId = getAuthenticatedUserId(request);
  if (!authenticatedUserId) return unauthorized();
  try {
    await ensureSeeded();
    const id = Number(new URL(request.url).searchParams.get("id"));
    const where = id
      ? and(eq(watchProgress.userId, authenticatedUserId), eq(watchProgress.id, id))
      : eq(watchProgress.userId, authenticatedUserId);
    const deleted = await db.delete(watchProgress).where(where).returning({ id: watchProgress.id });
    return NextResponse.json({ deleted: deleted.length });
  } catch (error) {
    console.error("DELETE /api/history error:", error);
    return NextResponse.json({ error: "Failed to clear history" }, { status: 500 });
  }
}
