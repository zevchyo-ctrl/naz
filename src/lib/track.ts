"use client";

import { getUserToken } from "@/lib/clientAuth";

export type TrackEventType =
  | "site_visit"
  | "page_view"
  | "movie_view"
  | "series_view"
  | "episode_view"
  | "search";

const VISITOR_KEY = "nazmovies_vid";
const SESSION_KEY = "nazmovies_sid";

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Anonymous, privacy-safe identifiers (no personal data). */
function getIds() {
  let vid = "";
  let sid = "";
  try {
    vid = localStorage.getItem(VISITOR_KEY) || "";
    if (!vid) {
      vid = randomId();
      localStorage.setItem(VISITOR_KEY, vid);
    }
    // A "session" = one browser tab session (sessionStorage)
    sid = sessionStorage.getItem(SESSION_KEY) || "";
    if (!sid) {
      sid = randomId();
      sessionStorage.setItem(SESSION_KEY, sid);
    }
  } catch {
    vid = vid || randomId();
    sid = sid || randomId();
  }
  return { vid, sid };
}

// Client-side guard against rapid duplicate fires (server also de-duplicates)
const recent = new Map<string, number>();

export function trackEvent(
  eventType: TrackEventType,
  data: { pageType?: string; contentId?: number; contentType?: "movie" | "series" | "episode"; query?: string } = {}
) {
  if (typeof window === "undefined") return;
  const key = `${eventType}|${data.pageType || ""}|${data.contentType || ""}|${data.contentId || ""}|${data.query || ""}`;
  const now = Date.now();
  if ((recent.get(key) || 0) > now - 5000) return;
  recent.set(key, now);

  const { vid, sid } = getIds();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getUserToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  fetch("/api/track", {
    method: "POST",
    keepalive: true,
    headers,
    body: JSON.stringify({ eventType, visitorId: vid, sessionId: sid, ...data }),
  }).catch(() => {});
}
