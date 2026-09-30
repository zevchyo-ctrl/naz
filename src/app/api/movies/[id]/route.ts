import { NextRequest, NextResponse } from "next/server";
import {guardAdmin} from "@/lib/serverAuth";

import { db } from "@/db";
import { movies, subtitles } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import { and, eq } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSeeded();
    const { id } = await params;
    const movieId = Number(id);

    const [movie] = await db
      .select()
      .from(movies)
      .where(eq(movies.id, movieId));

    if (!movie) {
      return NextResponse.json({ error: "Movie not found" }, { status: 404 });
    }

    const movieSubtitles = await db
      .select()
      .from(subtitles)
      .where(
        and(eq(subtitles.mediaType, "movie"), eq(subtitles.mediaId, movieId))
      );

    return NextResponse.json({ movie, subtitles: movieSubtitles });
  } catch (error) {
    console.error("Error getting movie:", error);
    return NextResponse.json(
      { error: "Failed to get movie" },
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
    const movieId = Number(id);
    const body = await request.json();

    const genreMap: Record<string, { ar: string; en: string }> = {
      action: { ar: "أكشن", en: "Action" },
      drama: { ar: "دراما", en: "Drama" },
      comedy: { ar: "كوميديا", en: "Comedy" },
      horror: { ar: "رعب", en: "Horror" },
      scifi: { ar: "خيال علمي", en: "Sci-Fi" },
      romance: { ar: "رومانسي", en: "Romance" },
      adventure: { ar: "مغامرات", en: "Adventure" },
      mystery: { ar: "غموض", en: "Mystery" },
      crime: { ar: "جريمة", en: "Crime" },
    };

    const genreSlug = body.genre || "action";
    const gLabels = genreMap[genreSlug] || {
      ar: body.genreAr || "أكشن",
      en: body.genreEn || "Action",
    };

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
      duration: body.duration,
      genre: genreSlug,
      genreAr: gLabels.ar,
      genreEn: gLabels.en,
      country: body.country,
      countryAr: body.countryAr || body.country,
      countryEn: body.countryEn || body.country,
      rating: Number(body.rating) || 8.5,
      quality: body.quality || "4K",
      language: body.language,
      originType: body.originType || "foreign",
      directorAr: body.directorAr,
      directorEn: body.directorEn,
      castAr: body.castAr,
      castEn: body.castEn,
      badge: body.badge || body.quality || "4K",
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
      .update(movies)
      .set(updatePayload)
      .where(eq(movies.id, movieId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Movie not found" }, { status: 404 });
    }

    return NextResponse.json({ movie: updated });
  } catch (error) {
    console.error("Error updating movie:", error);
    return NextResponse.json(
      { error: "Failed to update movie" },
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
    const movieId = Number(id);

    await db.delete(movies).where(eq(movies.id, movieId));
    return NextResponse.json({ deleted: true, id: movieId });
  } catch (error) {
    console.error("Error deleting movie:", error);
    return NextResponse.json(
      { error: "Failed to delete movie" },
      { status: 500 }
    );
  }
}
