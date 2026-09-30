import { db } from "@/db";
import { siteSettings, PlatformSettingsData } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import { DEFAULT_PLATFORM_SETTINGS, DEFAULT_AD_CONFIG, DEFAULT_PREMIUM_SETTINGS } from "@/lib/defaults";
import { DEFAULT_THEME, EMPTY_SECTIONS, normalizeTheme, normalizeSections } from "@/lib/theme";
import { eq } from "drizzle-orm";

export function merge(data: Partial<PlatformSettingsData> | undefined): PlatformSettingsData {
  const d = data || {};
  return {
    ...DEFAULT_PLATFORM_SETTINGS,
    ...d,
    adConfig: {
      ...DEFAULT_AD_CONFIG,
      ...(d.adConfig || {}),
    },
    premiumSettings: { ...DEFAULT_PREMIUM_SETTINGS, ...(d.premiumSettings || {}) },
    theme: normalizeTheme(d.theme, DEFAULT_THEME),
    sections: normalizeSections(d.sections, EMPTY_SECTIONS),
  };
}

export async function getSettings(): Promise<PlatformSettingsData> {
  await ensureSeeded();
  const [row] = await db.select().from(siteSettings).where(eq(siteSettings.key, "main"));
  return merge(row?.data);
}

