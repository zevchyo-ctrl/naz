import type { NextRequest } from "next/server";

type GeoLib = { lookup: (ip: string) => { country: string; name?: string } | null };
let geo: GeoLib | null | undefined;

function loadGeo(): GeoLib | null {
  if (geo !== undefined) return geo;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    geo = require("geoip-country") as GeoLib;
  } catch (e) {
    console.warn("[geo] geoip-country unavailable:", e);
    geo = null;
  }
  return geo;
}

const HEADER_KEYS = [
  "cf-ipcountry",
  "x-vercel-ip-country",
  "cloudfront-viewer-country",
  "x-country-code",
  "x-appengine-country",
  "fastly-geo-country-code",
];

/**
 * Resolve the visitor's country (ISO alpha-2) server-side.
 * The IP address is used only in memory for the lookup and is NEVER stored or returned.
 */
export function resolveCountryCode(req: NextRequest | Request): string {
  for (const h of HEADER_KEYS) {
    const v = (req.headers.get(h) || "").trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(v) && v !== "XX" && v !== "T1") return v;
  }
  const fwd = req.headers.get("x-forwarded-for") || "";
  const ip = (fwd.split(",")[0] || req.headers.get("x-real-ip") || "").trim().replace(/^::ffff:/, "");
  if (!ip) return "XX";
  const hit = loadGeo()?.lookup(ip);
  return hit?.country && /^[A-Z]{2}$/.test(hit.country) ? hit.country : "XX";
}
