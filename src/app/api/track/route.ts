import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/db";
import { visitorAnalytics } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import { getAuthenticatedUserId } from "@/lib/serverAuth";
import { resolveCountryCode } from "@/lib/geo";

export const dynamic = "force-dynamic";

const EVENTS = new Set(["site_visit", "page_view", "movie_view", "series_view", "episode_view", "search"]);
const PAGE_TYPES = new Set([
  "home", "movies", "series", "categories", "mylist", "movie_detail", "series_detail", "search", "player",
]);
const ID_RE = /^[A-Za-z0-9-]{8,64}$/;
const BOT_RE = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|pingdom|monitor/i;

// Deduplication windows (minutes)
const WINDOW: Record<string, number> = {
  page_view: 30,
  movie_view: 30,
  series_view: 30,
  episode_view: 30,
  search: 10,
};

export async function POST(request: NextRequest) {
  try {
    const ua = request.headers.get("user-agent") || "";
    if (!ua || BOT_RE.test(ua)) return NextResponse.json({ ok: true, skipped: "bot" });

    const body = await request.json().catch(() => ({}));
    const eventType = String(body.eventType || "");
    const visitorId = String(body.visitorId || "");
    const sessionId = String(body.sessionId || "");
    if (!EVENTS.has(eventType) || !ID_RE.test(visitorId) || !ID_RE.test(sessionId)) {
      return NextResponse.json({ error: "Invalid event" }, { status: 400 });
    }

    const pageType = PAGE_TYPES.has(body.pageType) ? String(body.pageType) : null;
    const contentId = Number.isInteger(body.contentId) && body.contentId > 0 ? Number(body.contentId) : null;
    const contentType = ["movie", "series", "episode"].includes(body.contentType) ? String(body.contentType) : null;
    const query = typeof body.query === "string" ? body.query.trim().toLowerCase().slice(0, 100) : "";

    if (["movie_view", "series_view", "episode_view"].includes(eventType) && !contentId) {
      return NextResponse.json({ error: "contentId required" }, { status: 400 });
    }
    if (eventType === "search" && query.length < 2) {
      return NextResponse.json({ ok: true, skipped: "short-query" });
    }

    await ensureSeeded();
    const userId = getAuthenticatedUserId(request); // never trust a client-sent user id
    const countryCode = resolveCountryCode(request);

    // Dedupe key: one site_visit per session; other events once per visitor+target per window
    let bucketParts: string[];
    if (eventType === "site_visit") {
      bucketParts = [eventType, sessionId];
    } else {
      const bucket = Math.floor(Date.now() / (WINDOW[eventType] * 60_000));
      bucketParts = [eventType, visitorId, pageType || "", contentType || "", String(contentId || ""), query, String(bucket)];
    }
    const dedupeKey = crypto.createHash("sha256").update(bucketParts.join("|")).digest("hex");

    const inserted = await db
      .insert(visitorAnalytics)
      .values({
        visitorId,
        userId,
        country: countryCode === "XX" ? null : countryCode,
        countryCode,
        pageType,
        contentId,
        contentType,
        eventType,
        sessionId,
        dedupeKey,
      })
      .onConflictDoNothing({ target: visitorAnalytics.dedupeKey })
      .returning({ id: visitorAnalytics.id });

    return NextResponse.json({ ok: true, recorded: inserted.length > 0 });
  } catch (error) {
    console.error("[track] error:", error);
    return NextResponse.json({ error: "Tracking failed" }, { status: 500 });
  }
}
