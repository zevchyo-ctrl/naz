import type { ThemeColors, SectionColors, PlatformSettingsData } from "@/db/schema";

export const DEFAULT_SITE_NAME = "NAZMOVIES";
export const DEFAULT_TELEGRAM_URL = "https://t.me/nazmovies";

export const DEFAULT_THEME: ThemeColors = {
  primary: "#FFD21F",
  secondary: "#FFB800",
  accent: "#E50914",
  background: "#050505",
  card: "#0B0B0F",
  text: "#FFFFFF",
  textSecondary: "#A1A1AA",
  button: "#FFD21F",
  buttonHover: "#FFB800",
  border: "#26262B",
  header: "#050505",
  footer: "#040406",
};

export const EMPTY_SECTIONS: SectionColors = {
  header: "",
  navigation: "",
  hero: "",
  movieSections: "",
  seriesSections: "",
  movieCard: "",
  seriesCard: "",
  searchBar: "",
  buttons: "",
  footer: "",
  loginPage: "",
  registerPage: "",
  userProfile: "",
};

export interface ThemePreset {
  id: string;
  nameAr: string;
  nameEn: string;
  /** Complete theme — every ThemeColors key is present */
  theme: ThemeColors;
  /** Complete section map ("" = inherit from theme) */
  sections: SectionColors;
}

const RAW_PRESETS: Omit<ThemePreset, "sections">[] = [
  { id: "default", nameAr: "السينما الافتراضي", nameEn: "Default Cinema", theme: DEFAULT_THEME },
  {
    id: "dark-red",
    nameAr: "السينما الحمراء الداكنة",
    nameEn: "Dark Red Cinema",
    theme: {
      ...DEFAULT_THEME,
      primary: "#E50914", secondary: "#B20710", accent: "#FFD21F",
      background: "#0A0203", card: "#16070A", button: "#E50914", buttonHover: "#B20710",
      border: "#3A1216", header: "#0A0203", footer: "#070102",
    },
  },
  {
    id: "black-gold",
    nameAr: "الأسود والذهبي",
    nameEn: "Black & Gold",
    theme: {
      ...DEFAULT_THEME,
      primary: "#D4AF37", secondary: "#F5D76E", accent: "#8B6914",
      background: "#000000", card: "#0D0B05", button: "#D4AF37", buttonHover: "#F5D76E",
      border: "#2E2710", header: "#000000", footer: "#000000",
    },
  },
  {
    id: "blue",
    nameAr: "السينما الزرقاء",
    nameEn: "Blue Cinema",
    theme: {
      ...DEFAULT_THEME,
      primary: "#38BDF8", secondary: "#0EA5E9", accent: "#F43F5E",
      background: "#030712", card: "#0B1220", textSecondary: "#94A3B8",
      button: "#38BDF8", buttonHover: "#0EA5E9", border: "#1E293B", header: "#030712", footer: "#020617",
    },
  },
  {
    id: "purple",
    nameAr: "السينما البنفسجية",
    nameEn: "Purple Cinema",
    theme: {
      ...DEFAULT_THEME,
      primary: "#A855F7", secondary: "#7C3AED", accent: "#F59E0B",
      background: "#07030D", card: "#130A1F", textSecondary: "#A1A1C4",
      button: "#A855F7", buttonHover: "#7C3AED", border: "#2A1A40", header: "#07030D", footer: "#05020A",
    },
  },
];

export const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export function isHex(v: unknown): v is string {
  return typeof v === "string" && HEX_RE.test(v);
}

/** Build the :root CSS variable block used by every component. */
export function buildThemeCss(
  s: Pick<PlatformSettingsData, "theme" | "sections">,
  selector = ":root"
): string {
  const t = { ...DEFAULT_THEME, ...(s.theme || {}) };
  const sec = { ...EMPTY_SECTIONS, ...(s.sections || {}) };
  const pick = (override: string, fallback: string) => (isHex(override) ? override : fallback);
  const vars: Record<string, string> = {
    "--primary-color": t.primary,
    "--secondary-color": t.secondary,
    "--accent-color": t.accent,
    "--background-color": t.background,
    "--card-color": t.card,
    "--text-color": t.text,
    "--text-secondary-color": t.textSecondary,
    "--button-color": pick(sec.buttons, t.button),
    "--button-hover-color": t.buttonHover,
    "--border-color": t.border,
    "--header-color": pick(sec.header, t.header),
    "--footer-color": pick(sec.footer, t.footer),
    "--nav-color": pick(sec.navigation, "transparent"),
    "--hero-color": pick(sec.hero, "transparent"),
    "--movie-section-color": pick(sec.movieSections, "transparent"),
    "--series-section-color": pick(sec.seriesSections, "transparent"),
    "--movie-card-color": pick(sec.movieCard, t.card),
    "--series-card-color": pick(sec.seriesCard, t.card),
    "--search-color": pick(sec.searchBar, "#FFFFFF0F"),
    "--login-color": pick(sec.loginPage, t.card),
    "--register-color": pick(sec.registerPage, t.card),
    "--profile-color": pick(sec.userProfile, t.card),
  };
  // Only hex / known keywords reach here, so no CSS injection is possible.
  const body = Object.entries(vars)
    .map(([k, v]) => `${k}:${isHex(v) || v === "transparent" ? v : "#000"};`)
    .join("");
  return `${selector}{${body}}`;
}

export function formatClock(sec: number): string {
  if (!sec || !isFinite(sec) || sec < 0) return "00:00";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Canonical form: "#RRGGBB" / "#RRGGBBAA" uppercase; expands "#RGB". Returns null if invalid. */
export function normalizeHex(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!HEX_RE.test(t)) return null;
  let h = t.slice(1).toUpperCase();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return `#${h}`;
}

/** Complete theme: every key present and valid; invalid/missing values fall back per key. */
export function normalizeTheme(input: Partial<Record<keyof ThemeColors, unknown>> | undefined | null, fallback: ThemeColors = DEFAULT_THEME): ThemeColors {
  const out = { ...fallback };
  for (const k of Object.keys(DEFAULT_THEME) as (keyof ThemeColors)[]) {
    out[k] = normalizeHex(input?.[k]) ?? normalizeHex(fallback[k]) ?? DEFAULT_THEME[k];
  }
  return out;
}

/** Complete section map: "" (inherit) or a valid hex for every key. */
export function normalizeSections(input: Partial<Record<keyof SectionColors, unknown>> | undefined | null, fallback: SectionColors = EMPTY_SECTIONS): SectionColors {
  const out = { ...EMPTY_SECTIONS };
  for (const k of Object.keys(EMPTY_SECTIONS) as (keyof SectionColors)[]) {
    const v = input?.[k];
    out[k] = v === "" ? "" : normalizeHex(v) ?? (fallback[k] === "" ? "" : normalizeHex(fallback[k]) ?? "");
  }
  return out;
}

/** All presets are normalised into complete, valid objects at module load
 * (declared last so HEX_RE / normalizeHex are initialised first). */
export const THEME_PRESETS: ThemePreset[] = RAW_PRESETS.map((p) => ({
  ...p,
  theme: normalizeTheme(p.theme, DEFAULT_THEME),
  sections: { ...EMPTY_SECTIONS },
}));

export const PRESET_IDS = [...RAW_PRESETS.map((p) => p.id), "custom"];

