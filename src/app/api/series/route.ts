import { NextRequest, NextResponse } from "next/server";
import {guardAdmin} from "@/lib/serverAuth";

import { db } from "@/db";
import { series, seasons, episodes } from "@/db/schema";
import { ensureSeeded, buildDefaultServers, buildDefaultDownloads } from "@/db/seed";
import { asc, desc, eq } from "drizzle-orm";

export async function GET() {
  try {
    await ensureSeeded();
    const allSeries = await db
      .select()
      .from(series)
      .orderBy(desc(series.createdAt), desc(series.id));

    const allSeasons = await db
      .select()
      .from(seasons)
      .orderBy(asc(seasons.seasonNumber));

    const allEpisodes = await db
      .select()
      .from(episodes)
      .orderBy(asc(episodes.seasonNumber), asc(episodes.episodeNumber));

    return NextResponse.json({
      series: allSeries,
      seasons: allSeasons,
      episodes: allEpisodes,
    });
  } catch (error) {
    console.error("Error fetching series:", error);
    return NextResponse.json(
      { error: "Failed to fetch series" },
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

    // Support adding a season to an existing series
    if (body.action === "add_season") {
      const seriesId = Number(body.seriesId);
      const seasonNumber = Number(body.seasonNumber) || 1;
      const [createdSeason] = await db
        .insert(seasons)
        .values({
          seriesId,
          seasonNumber,
          titleAr: body.titleAr || `الموسم ${seasonNumber}`,
          titleEn: body.titleEn || `Season ${seasonNumber}`,
          year: Number(body.year) || 2026,
          posterUrl: body.posterUrl || "/images/poster-crown-of-andalus.jpg",
        })
        .returning();

      return NextResponse.json({ season: createdSeason }, { status: 201 });
    }

    // Support adding an episode to an existing series/season
    if (body.action === "add_episode") {
      const seriesId = Number(body.seriesId);
      const seasonNumber = Number(body.seasonNumber) || 1;
      const episodeNumber = Number(body.episodeNumber) || 1;

      const existingSeasons = await db
        .select()
        .from(seasons)
        .where(eq(seasons.seriesId, seriesId));

      let targetSeason = existingSeasons.find(
        (s) => s.seasonNumber === seasonNumber
      );

      if (!targetSeason) {
        const [newSeason] = await db
          .insert(seasons)
          .values({
            seriesId,
            seasonNumber,
            titleAr: `الموسم ${seasonNumber}`,
            titleEn: `Season ${seasonNumber}`,
            year: 2026,
          })
          .returning();
        targetSeason = newSeason;
      }

      const videoUrl =
        body.videoUrl ||
        "https://videos.pexels.com/video-files/31801785/13548474_3840_2160_25fps.mp4";
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

      const [createdEpisode] = await db
        .insert(episodes)
        .values({
          seriesId,
          seasonId: targetSeason.id,
          seasonNumber,
          episodeNumber,
          titleAr: body.titleAr || `الحلقة ${episodeNumber}`,
          titleEn: body.titleEn || `Episode ${episodeNumber}`,
          descriptionAr:
            body.descriptionAr ||
            `أحداث الحلقة ${episodeNumber} من الموسم ${seasonNumber}.`,
          descriptionEn:
            body.descriptionEn ||
            `Events of Season ${seasonNumber}, Episode ${episodeNumber}.`,
          duration: body.duration || "48m",
          thumbnailUrl:
            body.thumbnailUrl || "/images/backdrop-royal-palace.jpg",
          videoUrl,
          hlsUrl,
          servers,
          downloadLinks,
        })
        .returning();

      return NextResponse.json({ episode: createdEpisode }, { status: 201 });
    }

    // Default: Create a new Series with initial Season 1 & Episode 1
    const titleAr = body.titleAr || body.title || "مسلسل جديد";
    const titleEn = body.titleEn || body.title || "New Series";
    const slug =
      (titleEn || "series")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") +
      "-" +
      Date.now().toString().slice(-4);

    const videoUrl =
      body.videoUrl ||
      "https://videos.pexels.com/video-files/31801785/13548474_3840_2160_25fps.mp4";
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

    const [createdSeries] = await db
      .insert(series)
      .values({
        slug,
        title: body.title || titleAr,
        titleAr,
        titleEn,
        description: body.description || body.descriptionAr || titleAr,
        descriptionAr:
          body.descriptionAr ||
          body.description ||
          "مسلسل حصري على منصة NAZMOVIES أفلام ناز.",
        descriptionEn:
          body.descriptionEn ||
          body.description ||
          "Exclusive series streaming on NAZMOVIES.",
        posterUrl: body.posterUrl || "/images/poster-crown-of-andalus.jpg",
        backdropUrl:
          body.backdropUrl ||
          body.posterUrl ||
          "/images/backdrop-royal-palace.jpg",
        videoUrl,
        hlsUrl,
        servers,
        downloadLinks,
        year: Number(body.year) || 2026,
        seasonsCount: Number(body.seasonsCount) || 1,
        episodesCount: Number(body.episodesCount) || 8,
        genre: body.genre || "drama",
        genreAr: body.genreAr || "دراما",
        genreEn: body.genreEn || "Drama",
        categorySlug: "series",
        country: body.country || "UAE",
        countryAr: body.countryAr || body.country || "الإمارات",
        countryEn: body.countryEn || body.country || "UAE",
        rating: Number(body.rating) || 9.0,
        quality: body.quality || "4K",
        language: body.language || "العربية",
        originType: body.originType || "arabic",
        directorAr: body.directorAr || "سامر البرقاوي",
        directorEn: body.directorEn || "Samer Al-Barqawi",
        castAr: body.castAr || "نخبة من النجوم",
        castEn: body.castEn || "All-Star Cast",
        badge: "SERIES",
        isFeatured: Boolean(body.isFeatured),
        isPopular: body.isPopular !== undefined ? Boolean(body.isPopular) : true,
        isLatest: body.isLatest !== undefined ? Boolean(body.isLatest) : true,
      })
      .returning();

    const [s1] = await db
      .insert(seasons)
      .values({
        seriesId: createdSeries.id,
        seasonNumber: 1,
        titleAr: "الموسم 1",
        titleEn: "Season 1",
        year: createdSeries.year,
        posterUrl: createdSeries.posterUrl,
      })
      .returning();

    await db.insert(episodes).values([
      {
        seriesId: createdSeries.id,
        seasonId: s1.id,
        seasonNumber: 1,
        episodeNumber: 1,
        titleAr: "الحلقة 1: البداية",
        titleEn: "Episode 1: Pilot",
        descriptionAr: `الحلقة الافتتاحية من مسلسل ${createdSeries.titleAr}.`,
        descriptionEn: `Premiere episode of ${createdSeries.titleEn}.`,
        duration: "50m",
        thumbnailUrl: createdSeries.backdropUrl,
        videoUrl,
        hlsUrl,
        servers,
        downloadLinks,
      },
      {
        seriesId: createdSeries.id,
        seasonId: s1.id,
        seasonNumber: 1,
        episodeNumber: 2,
        titleAr: "الحلقة 2: المواجهة",
        titleEn: "Episode 2: The Confrontation",
        descriptionAr: `تصاعد الأحداث في الحلقة الثانية من ${createdSeries.titleAr}.`,
        descriptionEn: `Rising stakes in Episode 2 of ${createdSeries.titleEn}.`,
        duration: "48m",
        thumbnailUrl: createdSeries.backdropUrl,
        videoUrl,
        hlsUrl,
        servers,
        downloadLinks,
      },
    ]);

    return NextResponse.json({ series: createdSeries }, { status: 201 });
  } catch (error) {
    console.error("Error creating series:", error);
    return NextResponse.json(
      { error: "Failed to create series" },
      { status: 500 }
    );
  }
}
