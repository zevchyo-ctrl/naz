import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { movies, series, searchAnalytics } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import { eq, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    await ensureSeeded();
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim();
    const track = searchParams.get("track") !== "false";

    if (!q) {
      return NextResponse.json({ movies: [], series: [] });
    }

    const normalized = q.toLowerCase();

    // Record search analytics if query is at least 2 characters
    if (track && normalized.length >= 2) {
      try {
        const existing = await db
          .select()
          .from(searchAnalytics)
          .where(eq(searchAnalytics.normalizedQuery, normalized));

        if (existing.length > 0) {
          await db
            .update(searchAnalytics)
            .set({
              searchCount: sql`${searchAnalytics.searchCount} + 1`,
              lastSearchedAt: new Date(),
            })
            .where(eq(searchAnalytics.id, existing[0].id));
        } else {
          await db.insert(searchAnalytics).values({
            query: q,
            normalizedQuery: normalized,
            categoryHint: "search",
            searchCount: 1,
          });
        }
      } catch {
        // Ignore duplicate race condition
      }
    }

    const allMovies = await db.select().from(movies);
    const allSeries = await db.select().from(series);

    const matchedMovies = allMovies.filter((m) => {
      const hay = [
        m.title,
        m.titleAr,
        m.titleEn,
        m.genre,
        m.genreAr,
        m.genreEn,
        m.castAr,
        m.castEn,
        m.directorAr,
        m.directorEn,
        String(m.year),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(normalized);
    });

    const matchedSeries = allSeries.filter((s) => {
      const hay = [
        s.title,
        s.titleAr,
        s.titleEn,
        s.genre,
        s.genreAr,
        s.genreEn,
        s.castAr,
        s.castEn,
        s.directorAr,
        s.directorEn,
        String(s.year),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(normalized);
    });

    return NextResponse.json({
      movies: matchedMovies,
      series: matchedSeries,
    });
  } catch (error) {
    console.error("Error searching:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
