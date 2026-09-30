import { NextRequest, NextResponse } from "next/server";
import { pool, db } from "@/db";
import { movies, series, episodes } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import {guardAdmin} from "@/lib/serverAuth";
import { inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

type Period = "daily" | "weekly" | "monthly";
const PERIODS: Record<Period, { daysBack: number; unit: "hour" | "day"; buckets: number; step: string }> = {
  daily: { daysBack: 0, unit: "hour", buckets: 24, step: "1 hour" },
  weekly: { daysBack: 6, unit: "day", buckets: 7, step: "1 day" },
  monthly: { daysBack: 29, unit: "day", buckets: 30, step: "1 day" },
};

async function safeTimezone(tz: string | null): Promise<string> {
  if (!tz || !/^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){0,2}$|^UTC$/.test(tz)) return "UTC";
  try {
    await pool.query("SELECT now() AT TIME ZONE $1", [tz]);
    return tz;
  } catch {
    return "UTC";
  }
}

// Events with local timestamp (created_at is stored as UTC wall time)
const EV = `ev AS (
  SELECT *, (created_at AT TIME ZONE 'UTC') AT TIME ZONE $1 AS lt FROM visitor_analytics
), b AS (
  SELECT date_trunc('day', now() AT TIME ZONE $1) - make_interval(days => $2::int) AS start
)`;

export async function GET(request: NextRequest) {
  const gate = guardAdmin(request);
  if (!gate.ok) return gate.response;
  try {
    await ensureSeeded();
    const params = new URL(request.url).searchParams;
    const period = (["daily", "weekly", "monthly"].includes(params.get("period") || "") ? params.get("period") : "daily") as Period;
    const cfg = PERIODS[period];
    const tz = await safeTimezone(params.get("tz"));
    const args = [tz, cfg.daysBack];

    const [summaryQ, countriesQ, unknownQ, chartQ, contentQ, allTimeQ] = await Promise.all([
      pool.query(
        `WITH ${EV}
         SELECT
           count(*) FILTER (WHERE event_type = 'site_visit')::int   AS visits,
           count(DISTINCT visitor_id)::int                           AS unique_visitors,
           count(*) FILTER (WHERE event_type = 'page_view')::int     AS page_views,
           count(*) FILTER (WHERE event_type = 'movie_view')::int    AS movie_views,
           count(*) FILTER (WHERE event_type = 'series_view')::int   AS series_views,
           count(*) FILTER (WHERE event_type = 'episode_view')::int  AS episode_views,
           count(*) FILTER (WHERE event_type = 'search')::int        AS searches,
           count(DISTINCT country_code) FILTER (WHERE country_code IS NOT NULL AND country_code <> 'XX')::int AS countries,
           count(*)::int AS events
         FROM ev, b WHERE ev.lt >= b.start`,
        args
      ),
      pool.query(
        `WITH ${EV}
         SELECT country_code, count(*)::int AS visits, count(DISTINCT visitor_id)::int AS visitors
         FROM ev, b
         WHERE ev.lt >= b.start AND event_type = 'site_visit' AND country_code IS NOT NULL AND country_code <> 'XX'
         GROUP BY country_code ORDER BY visits DESC, country_code ASC LIMIT 10`,
        args
      ),
      pool.query(
        `WITH ${EV}
         SELECT count(*)::int AS visits FROM ev, b
         WHERE ev.lt >= b.start AND event_type = 'site_visit' AND (country_code IS NULL OR country_code = 'XX')`,
        args
      ),
      pool.query(
        `WITH ${EV},
         g AS (
           SELECT generate_series(b.start, b.start + ($3::int - 1) * $4::interval, $4::interval) AS bucket FROM b
         )
         SELECT to_char(g.bucket, 'YYYY-MM-DD"T"HH24:MI') AS bucket_label,
           count(ev.id) FILTER (WHERE ev.event_type = 'site_visit')::int AS visits,
           count(DISTINCT ev.visitor_id)::int AS visitors,
           count(ev.id) FILTER (WHERE ev.event_type IN ('movie_view','series_view','episode_view'))::int AS views
         FROM g LEFT JOIN ev ON date_trunc('${cfg.unit}', ev.lt) = g.bucket
         GROUP BY g.bucket ORDER BY g.bucket`,
        [...args, cfg.buckets, cfg.step]
      ),
      pool.query(
        `WITH ${EV},
         c AS (
           SELECT content_type, content_id, count(*)::int AS views, count(DISTINCT visitor_id)::int AS viewers,
                  row_number() OVER (PARTITION BY content_type ORDER BY count(*) DESC, content_id) AS rn
           FROM ev, b
           WHERE ev.lt >= b.start AND event_type IN ('movie_view','series_view','episode_view') AND content_id IS NOT NULL
           GROUP BY content_type, content_id
         )
         SELECT content_type, content_id, views, viewers FROM c WHERE rn <= 5 ORDER BY content_type, views DESC`,
        args
      ),
      pool.query(`SELECT count(*)::int AS n, max(created_at) AS last_event FROM visitor_analytics`),
    ]);

    const s = summaryQ.rows[0];
    const totalVisits: number = s.visits;

    // Resolve content titles (aggregate only)
    const rows = contentQ.rows as { content_type: string; content_id: number; views: number; viewers: number }[];
    const ids = (t: string) => rows.filter((r) => r.content_type === t).map((r) => r.content_id);
    const [mRows, sRows, eRows] = await Promise.all([
      ids("movie").length ? db.select().from(movies).where(inArray(movies.id, ids("movie"))) : [],
      ids("series").length ? db.select().from(series).where(inArray(series.id, ids("series"))) : [],
      ids("episode").length ? db.select().from(episodes).where(inArray(episodes.id, ids("episode"))) : [],
    ]);
    const epSeriesIds = [...new Set(eRows.map((e) => e.seriesId))];
    const epSeries = epSeriesIds.length ? await db.select().from(series).where(inArray(series.id, epSeriesIds)) : [];
    const title = (r: (typeof rows)[number]) => {
      if (r.content_type === "movie") {
        const m = mRows.find((x) => x.id === r.content_id);
        return m ? { titleAr: m.titleAr, titleEn: m.titleEn, posterUrl: m.posterUrl } : null;
      }
      if (r.content_type === "series") {
        const x = sRows.find((y) => y.id === r.content_id);
        return x ? { titleAr: x.titleAr, titleEn: x.titleEn, posterUrl: x.posterUrl } : null;
      }
      const e = eRows.find((y) => y.id === r.content_id);
      if (!e) return null;
      const parent = epSeries.find((y) => y.id === e.seriesId);
      return {
        titleAr: `${parent?.titleAr || ""} • م${e.seasonNumber} ح${e.episodeNumber}`,
        titleEn: `${parent?.titleEn || ""} • S${e.seasonNumber}E${e.episodeNumber}`,
        posterUrl: parent?.posterUrl || e.thumbnailUrl,
      };
    };
    const topContent = rows
      .map((r) => {
        const t = title(r);
        return t ? { contentType: r.content_type, contentId: r.content_id, views: r.views, viewers: r.viewers, ...t } : null;
      })
      .filter(Boolean);

    return NextResponse.json({
      period,
      timezone: tz,
      generatedAt: new Date().toISOString(),
      hasAnyData: allTimeQ.rows[0].n > 0,
      lastEventAt: allTimeQ.rows[0].last_event,
      summary: {
        visits: totalVisits,
        uniqueVisitors: s.unique_visitors,
        pageViews: s.page_views,
        movieViews: s.movie_views,
        seriesViews: s.series_views,
        episodeViews: s.episode_views,
        contentViews: s.movie_views + s.series_views + s.episode_views,
        searches: s.searches,
        countries: s.countries,
        events: s.events,
      },
      topCountries: countriesQ.rows.map((r, i) => ({
        rank: i + 1,
        countryCode: r.country_code,
        visits: r.visits,
        visitors: r.visitors,
        percent: totalVisits ? Math.round((r.visits / totalVisits) * 1000) / 10 : 0,
      })),
      unknownCountryVisits: unknownQ.rows[0].visits,
      chart: {
        unit: cfg.unit,
        points: chartQ.rows.map((r) => ({
          // local wall-clock bucket start (formatted in SQL, no JS timezone shift)
          bucket: r.bucket_label as string,
          visits: r.visits,
          visitors: r.visitors,
          views: r.views,
        })),
      },
      topContent,
    });
  } catch (error) {
    console.error("[analytics/visitors] error:", error);
    return NextResponse.json({ error: "Failed to load analytics" }, { status: 500 });
  }
}
