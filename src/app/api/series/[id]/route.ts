import { NextRequest, NextResponse } from "next/server";
import {guardAdmin} from "@/lib/serverAuth";

import { db } from "@/db";
import { series, seasons, episodes } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import { asc, eq } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSeeded();
    const { id } = await params;
    const seriesId = Number(id);

    const [foundSeries] = await db
      .select()
      .from(series)
      .where(eq(series.id, seriesId));

    if (!foundSeries) {
      return NextResponse.json({ error: "Series not found" }, { status: 404 });
    }

    const seriesSeasons = await db
      .select()
      .from(seasons)
      .where(eq(seasons.seriesId, seriesId))
      .orderBy(asc(seasons.seasonNumber));

    const seriesEpisodes = await db
      .select()
      .from(episodes)
      .where(eq(episodes.seriesId, seriesId))
      .orderBy(asc(episodes.seasonNumber), asc(episodes.episodeNumber));

    return NextResponse.json({
      series: foundSeries,
      seasons: seriesSeasons,
      episodes: seriesEpisodes,
    });
  } catch (error) {
    console.error("Error getting series:", error);
    return NextResponse.json(
      { error: "Failed to get series" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = guardAdmin(request);
  if (!gate.ok) return gate.response;
  try {
    await ensureSeeded();
    const { id } = await params;
    const seriesId = Number(id);
    const body = await request.json();

    // Support updating a specific episode's servers or download links
    if (body.episodeId) {
      const epId = Number(body.episodeId);
      const [updatedEp] = await db
        .update(episodes)
        .set({
          titleAr: body.titleAr,
          titleEn: body.titleEn,
          videoUrl: body.videoUrl,
          hlsUrl: body.hlsUrl,
          servers: body.servers,
          downloadLinks: body.downloadLinks,
        })
        .where(eq(episodes.id, epId))
        .returning();
      return NextResponse.json({ episode: updatedEp });
    }

    const updatePayload: Record<string, unknown> = {
      title: body.title || body.titleAr,
      titleAr: body.titleAr || body.title,
      titleEn: body.titleEn || body.title,
      description: body.description || body.descriptionAr,
      descriptionAr: body.descriptionAr || body.description,
      descriptionEn: body.descriptionEn || body.description,
      posterUrl: body.posterUrl,
      backdropUrl: body.backdropUrl || body.posterUrl,
      videoUrl: body.videoUrl,
      hlsUrl: body.hlsUrl,
      year: Number(body.year) || 2026,
      genre: body.genre || "drama",
      rating: Number(body.rating) || 9.0,
      quality: body.quality || "4K",
      isFeatured: Boolean(body.isFeatured),
      isPopular: Boolean(body.isPopular),
      isLatest: Boolean(body.isLatest),
    };

    if (Array.isArray(body.servers)) {
      updatePayload.servers = body.servers;
    }
    if (Array.isArray(body.downloadLinks)) {
      updatePayload.downloadLinks = body.downloadLinks;
    }

    const [updated] = await db
      .update(series)
      .set(updatePayload)
      .where(eq(series.id, seriesId))
      .returning();

    return NextResponse.json({ series: updated });
  } catch (error) {
    console.error("Error updating series:", error);
    return NextResponse.json(
      { error: "Failed to update series" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = guardAdmin(request);
  if (!gate.ok) return gate.response;
  try {
    await ensureSeeded();
    const { id } = await params;
    const seriesId = Number(id);

    await db.delete(episodes).where(eq(episodes.seriesId, seriesId));
    await db.delete(seasons).where(eq(seasons.seriesId, seriesId));
    await db.delete(series).where(eq(series.id, seriesId));

    return NextResponse.json({ deleted: true, id: seriesId });
  } catch (error) {
    console.error("Error deleting series:", error);
    return NextResponse.json(
      { error: "Failed to delete series" },
      { status: 500 }
    );
  }
}
