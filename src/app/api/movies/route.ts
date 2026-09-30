import { NextRequest, NextResponse } from "next/server";
import {guardAdmin} from "@/lib/serverAuth";

import { db } from "@/db";
import { movies, subtitles } from "@/db/schema";
import { ensureSeeded, buildDefaultServers, buildDefaultDownloads } from "@/db/seed";
import { desc, eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    await ensureSeeded();
    const { searchParams } = new URL(request.url);
    const genre = searchParams.get("genre");
    const category = searchParams.get("category");

    const allMovies = await db
      .select()
      .from(movies)
      .orderBy(desc(movies.createdAt), desc(movies.id));

    let filtered = allMovies;
    if (genre && genre !== "all") {
      filtered = filtered.filter((m) => m.genre === genre);
    }
    if (category && category !== "all") {
      if (category === "top-rated") {
        filtered = filtered.filter((m) => m.rating >= 9.0);
      } else if (category === "arabic" || category === "foreign") {
        filtered = filtered.filter((m) => m.originType === category);
      } else if (category !== "movies") {
        filtered = filtered.filter(
          (m) => m.genre === category || m.categorySlug === category
        );
      }
    }

    return NextResponse.json({ movies: filtered });
  } catch (error) {
    console.error("Error fetching movies:", error);
    return NextResponse.json(
      { error: "Failed to fetch movies" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const gate = guardAdmin(request);
  if (!gate.ok) return gate.response;
  try {
    await ensureSeeded();
    const body = await request.json();

    const titleAr = body.titleAr || body.title || "فيلم جديد";
    const titleEn = body.titleEn || body.title || "New Movie";
    const slug =
      (titleEn || "movie")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") +
      "-" +
      Date.now().toString().slice(-4);

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

    const videoUrl =
      body.videoUrl ||
      "https://videos.pexels.com/video-files/36136184/15324554_3840_2160_24fps.mp4";
    const hlsUrl =
      body.hlsUrl || "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";

    const servers =
      Array.isArray(body.servers) && body.servers.length > 0
        ? body.servers
        : buildDefaultServers(videoUrl, hlsUrl);

    const downloadLinks =
      Array.isArray(body.downloadLinks) && body.downloadLinks.length > 0
        ? body.downloadLinks
        : buildDefaultDownloads(videoUrl);

    const [created] = await db
      .insert(movies)
      .values({
        slug,
        title: body.title || titleAr,
        titleAr,
        titleEn,
        description: body.description || body.descriptionAr || titleAr,
        descriptionAr:
          body.descriptionAr ||
          body.description ||
          "فيلم سينمائي حصري على منصة NAZMOVIES أفلام ناز.",
        descriptionEn:
          body.descriptionEn ||
          body.description ||
          "Exclusive cinematic feature streaming on NAZMOVIES.",
        posterUrl: body.posterUrl || "/images/poster-sands-of-eternity.jpg",
        backdropUrl:
          body.backdropUrl ||
          body.posterUrl ||
          "/images/backdrop-desert-empire.jpg",
        videoUrl,
        hlsUrl,
        servers,
        downloadLinks,
        year: Number(body.year) || 2026,
        duration: body.duration || "2h 15m",
        genre: genreSlug,
        genreAr: gLabels.ar,
        genreEn: gLabels.en,
        categorySlug: body.categorySlug || genreSlug,
        country: body.country || "USA",
        countryAr: body.countryAr || body.country || "الولايات المتحدة",
        countryEn: body.countryEn || body.country || "United States",
        rating: Number(body.rating) || 8.8,
        quality: body.quality || "4K",
        language: body.language || "العربية / الإنجليزية",
        originType: body.originType || "foreign",
        directorAr: body.directorAr || "مخرج سينمائي",
        directorEn: body.directorEn || "Cinema Director",
        castAr: body.castAr || "نخبة من النجوم",
        castEn: body.castEn || "All-Star Cast",
        badge: body.badge || body.quality || "4K",
        isFeatured: Boolean(body.isFeatured),
        isPopular: body.isPopular !== undefined ? Boolean(body.isPopular) : true,
        isLatest: body.isLatest !== undefined ? Boolean(body.isLatest) : true,
        viewsCount: 1500,
        uniqueViewsCount: 1200,
        watchTimeMinutes: 2900,
      })
      .returning();

    if (body.subtitleUrl) {
      await db.insert(subtitles).values({
        mediaType: "movie",
        mediaId: created.id,
        langCode: "ar",
        labelAr: "العربية",
        labelEn: "Arabic",
        vttUrl: body.subtitleUrl,
      });
    }

    return NextResponse.json({ movie: created }, { status: 201 });
  } catch (error) {
    console.error("Error creating movie:", error);
    return NextResponse.json(
      { error: "Failed to create movie" },
      { status: 500 }
    );
  }
}
