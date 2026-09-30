import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { siteSettings, PlatformSettingsData } from "@/db/schema";
import { DEFAULT_PLATFORM_SETTINGS, DEFAULT_BRANDING, DEFAULT_AD_CONFIG, DEFAULT_PREMIUM_SETTINGS } from "@/lib/defaults";
import { DEFAULT_THEME, EMPTY_SECTIONS, PRESET_IDS, normalizeHex, normalizeTheme, normalizeSections } from "@/lib/theme";
import {guardAdmin} from "@/lib/serverAuth";
import { getSettings } from "@/lib/settingsServer";

export const dynamic = "force-dynamic";

const MAX_LOGO_CHARS = 2_800_000; // ~2MB binary as base64

function validateLogo(v: unknown): string | null {
  if (typeof v !== "string") return null;
  if (v === "" || v === "none") return v;
  if (/^\/images\/[\w\-./]+\.(png|jpe?g|webp|svg)$/i.test(v)) return v;
  if (/^https:\/\/[^\s"'<>]+$/i.test(v) && v.length < 2000) return v;
  const m = /^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,([A-Za-z0-9+/=]+)$/.exec(v);
  if (!m || v.length > MAX_LOGO_CHARS) return null;
  if (m[1] === "svg+xml") {
    const svg = Buffer.from(m[2], "base64").toString("utf8").toLowerCase();
    // Logos render via <img> (scripts never run), but reject active content anyway.
    // Event handlers must be real attributes (preceded by whitespace), so ordinary
    // attributes like `content=` / `contentScriptType=` are not false positives.
    if (/<script|javascript:|\son[a-z]+\s*=|<foreignobject|<iframe|<embed|<object/.test(svg)) return null;
  }
  return v;
}

function validateTelegram(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (/^https:\/\/(t\.me|telegram\.me|telegram\.dog)\/[A-Za-z0-9_+/?=&%-]{1,200}$/i.test(s)) return s;
  if (/^tg:\/\/resolve\?domain=[A-Za-z0-9_]{3,64}$/i.test(s)) return s;
  return null;
}

const BOOL_KEYS = [
  "requireEmailVerification", "requirePhoneVerification", "registrationEnabled",
  "movieRequestsEnabled", "downloadsEnabled", "adsEnabled", "adsForFreeUsers",
  "adsForPremiumUsers", "maintenanceMode", "premiumFeaturesEnabled",
] as const;
const TEXT_KEYS = [
  "aboutUsAr", "aboutUsEn", "privacyPolicyAr", "privacyPolicyEn",
  "termsOfServiceAr", "termsOfServiceEn",
] as const;

export async function GET() {
  try {
    return NextResponse.json({ settings: await getSettings() });
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json({ settings: DEFAULT_PLATFORM_SETTINGS });
  }
}

export async function PUT(request: NextRequest) {
  const gate = guardAdmin(request);
  if (!gate.ok) return gate.response;
  try {
    const current = await getSettings();
    const body = await request.json().catch(() => ({}));
    const next: PlatformSettingsData = { ...current, theme: { ...current.theme }, sections: { ...current.sections } };
    const errors: string[] = [];

    // Restore default branding/theme only (content & users untouched)
    if (body.resetBranding === true) {
      Object.assign(next, JSON.parse(JSON.stringify(DEFAULT_BRANDING)));
    }

    for (const k of BOOL_KEYS) if (typeof body[k] === "boolean") next[k] = body[k];
    for (const k of TEXT_KEYS) if (typeof body[k] === "string") next[k] = body[k].slice(0, 20000);
    if (body.defaultLanguage === "ar" || body.defaultLanguage === "en") next.defaultLanguage = body.defaultLanguage;
    if (body.maxVideoServers !== undefined) {
      const n = Number(body.maxVideoServers);
      if (Number.isInteger(n) && n >= 1 && n <= 6) next.maxVideoServers = n;
      else errors.push("maxVideoServers");
    }

    if (body.siteName !== undefined) {
      const name = String(body.siteName).replace(/[<>]/g, "").trim();
      if (name.length >= 1 && name.length <= 40) next.siteName = name;
      else errors.push("siteName");
    }
    if (body.logoUrl !== undefined) {
      const logo = validateLogo(body.logoUrl);
      if (logo === null) errors.push("logoUrl");
      else next.logoUrl = logo;
    }
    if (body.telegramContactUrl !== undefined) {
      const tg = validateTelegram(body.telegramContactUrl);
      if (tg === null) errors.push("telegramContactUrl");
      else next.telegramContactUrl = tg;
    }
    if (body.themePreset !== undefined) {
      if (typeof body.themePreset === "string" && PRESET_IDS.includes(body.themePreset)) next.themePreset = body.themePreset;
      else errors.push("themePreset");
    }
    // Merge submitted colours over the CURRENT saved theme, then validate the final values.
    if (body.theme !== undefined) {
      if (!body.theme || typeof body.theme !== "object") errors.push("theme");
      else {
        for (const key of Object.keys(DEFAULT_THEME) as (keyof typeof DEFAULT_THEME)[]) {
          const v = body.theme[key];
          if (v === undefined || v === null) continue; // keep current value
          const hex = normalizeHex(v);
          if (hex) next.theme[key] = hex;
          else errors.push(`theme.${key}=${JSON.stringify(v)}`);
        }
      }
    }
    if (body.sections !== undefined) {
      if (!body.sections || typeof body.sections !== "object") errors.push("sections");
      else {
        for (const key of Object.keys(EMPTY_SECTIONS) as (keyof typeof EMPTY_SECTIONS)[]) {
          const v = body.sections[key];
          if (v === undefined || v === null) continue;
          if (v === "") { next.sections[key] = ""; continue; }
          const hex = normalizeHex(v);
          if (hex) next.sections[key] = hex;
          else errors.push(`sections.${key}=${JSON.stringify(v)}`);
        }
      }
    }

    // --- Ad management -------------------------------------------------
    // Ad codes are raw third-party tags (script/iframe/HTML) and are stored verbatim:
    // that is the whole point of the feature. They only ever render inside the
    // dedicated ad containers, and only while their slot is enabled.
    const AD_SLOTS = Object.keys(DEFAULT_AD_CONFIG) as (keyof typeof DEFAULT_AD_CONFIG)[];
    const MAX_AD_CODE = 20000;
    if (body.adConfig !== undefined) {
      if (!body.adConfig || typeof body.adConfig !== "object") errors.push("adConfig");
      else {
        for (const slot of AD_SLOTS) {
          const incoming = body.adConfig[slot];
          if (incoming === undefined) continue;
          if (!incoming || typeof incoming !== "object") { errors.push(`adConfig.${slot}`); continue; }
          const current = next.adConfig[slot] || { enabled: false, code: "" };
          const code = incoming.code === undefined ? current.code : String(incoming.code);
          if (code.length > MAX_AD_CODE) { errors.push(`adConfig.${slot}.code`); continue; }
          next.adConfig = {
            ...next.adConfig,
            [slot]: {
              enabled: typeof incoming.enabled === "boolean" ? incoming.enabled : current.enabled,
              code,
            },
          };
        }
      }
    }

    // --- Premium subscription settings ----------------------------------
    if (body.premiumSettings !== undefined) {
      if (!body.premiumSettings || typeof body.premiumSettings !== "object") errors.push("premiumSettings");
      else {
        const ps = { ...DEFAULT_PREMIUM_SETTINGS, ...next.premiumSettings };
        if (body.premiumSettings.price !== undefined) ps.price = String(body.premiumSettings.price).slice(0, 60);
        if (body.premiumSettings.paymentInstructions !== undefined) {
          ps.paymentInstructions = String(body.premiumSettings.paymentInstructions).slice(0, 5000);
        }
        if (body.premiumSettings.telegramUsername !== undefined) {
          const raw = String(body.premiumSettings.telegramUsername).trim().replace(/^@/, "");
          if (raw && !/^[A-Za-z0-9_]{4,32}$/.test(raw)) errors.push("premiumSettings.telegramUsername");
          else ps.telegramUsername = raw ? `@${raw}` : "";
        }
        next.premiumSettings = ps;
      }
    }

    if (errors.length) {
      console.warn("[settings] rejected fields:", errors);
      return NextResponse.json({ error: "Invalid values", fields: errors }, { status: 400 });
    }

    // Final guarantee: persisted theme/sections are complete and valid
    next.theme = normalizeTheme(next.theme, DEFAULT_THEME);
    next.sections = normalizeSections(next.sections, EMPTY_SECTIONS);

    await db
      .insert(siteSettings)
      .values({ key: "main", data: next })
      .onConflictDoUpdate({ target: siteSettings.key, set: { data: next, updatedAt: new Date() } });

    return gate.seal(NextResponse.json({ settings: next }));
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
