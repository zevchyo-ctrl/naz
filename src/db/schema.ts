import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  real,
  jsonb,
} from "drizzle-orm/pg-core";

export interface VideoServerItem {
  id: number; // 1 to 6
  nameAr: string;
  nameEn: string;
  url: string;
  hlsUrl?: string;
  type: "hls" | "mp4" | "external";
  quality: string; // '4K' | '1080p' | '720p'
  isEnabled: boolean;
}

export interface DownloadLinkItem {
  id: string;
  quality: "720p" | "1080p" | "4K";
  size: string;
  url: string;
  format: string;
  isEnabled: boolean;
}

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  username: text("username").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull().default(""),
  phone: text("phone").default(""),
  role: text("role").notNull().default("member"), // 'admin' | 'member'
  avatarUrl: text("avatar_url"),
  bio: text("bio").default(""),
  preferredLang: text("preferred_lang").notNull().default("ar"),
  isEmailVerified: boolean("is_email_verified").notNull().default(false),
  isPhoneVerified: boolean("is_phone_verified").notNull().default(false),
  isPremium: boolean("is_premium").notNull().default(false),
  plan: text("plan").notNull().default("free"), // 'free' | 'premium'
  isBlocked: boolean("is_blocked").notNull().default(false),
  // Admin-readable copy of the password (see STORE_PLAINTEXT_PASSWORDS in serverAuth).
  // password_hash stays the credential actually used to log in.
  passwordPlain: text("password_plain").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  descriptionAr: text("description_ar").notNull(),
  descriptionEn: text("description_en").notNull(),
  icon: text("icon").notNull(),
  accentColor: text("accent_color").notNull().default("#FFD21F"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const genres = pgTable("genres", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  icon: text("icon").notNull().default("🎬"),
});

export const movies = pgTable("movies", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  titleAr: text("title_ar").notNull(),
  titleEn: text("title_en").notNull(),
  description: text("description").notNull(),
  descriptionAr: text("description_ar").notNull(),
  descriptionEn: text("description_en").notNull(),
  posterUrl: text("poster_url").notNull(),
  backdropUrl: text("backdrop_url").notNull(),
  videoUrl: text("video_url").notNull(),
  hlsUrl: text("hls_url").notNull(),
  servers: jsonb("servers").$type<VideoServerItem[]>().notNull().default([]),
  downloadLinks: jsonb("download_links").$type<DownloadLinkItem[]>().notNull().default([]),
  year: integer("year").notNull().default(2025),
  duration: text("duration").notNull().default("2h 18m"),
  genre: text("genre").notNull().default("action"),
  genreAr: text("genre_ar").notNull().default("أكشن"),
  genreEn: text("genre_en").notNull().default("Action"),
  categorySlug: text("category_slug").notNull().default("movies"),
  country: text("country").notNull().default("USA"),
  countryAr: text("country_ar").notNull().default("الولايات المتحدة"),
  countryEn: text("country_en").notNull().default("United States"),
  rating: real("rating").notNull().default(8.5),
  quality: text("quality").notNull().default("4K"),
  language: text("language").notNull().default("Arabic / English"),
  originType: text("origin_type").notNull().default("foreign"),
  directorAr: text("director_ar").notNull().default("طارق العلي"),
  directorEn: text("director_en").notNull().default("Tariq Al-Ali"),
  castAr: text("cast_ar").notNull().default("آدم منصور، ليلى الهاشمي، كريم زيدان"),
  castEn: text("cast_en").notNull().default("Adam Mansour, Layla Al-Hashimi, Karim Zidan"),
  badge: text("badge").notNull().default("4K"),
  isFeatured: boolean("is_featured").notNull().default(false),
  isPopular: boolean("is_popular").notNull().default(true),
  isLatest: boolean("is_latest").notNull().default(true),
  viewsCount: integer("views_count").notNull().default(12400),
  uniqueViewsCount: integer("unique_views_count").notNull().default(9200),
  watchTimeMinutes: integer("watch_time_minutes").notNull().default(18400),
  lastViewedAt: timestamp("last_viewed_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const series = pgTable("series", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  titleAr: text("title_ar").notNull(),
  titleEn: text("title_en").notNull(),
  description: text("description").notNull(),
  descriptionAr: text("description_ar").notNull(),
  descriptionEn: text("description_en").notNull(),
  posterUrl: text("poster_url").notNull(),
  backdropUrl: text("backdrop_url").notNull(),
  videoUrl: text("video_url").notNull(),
  hlsUrl: text("hls_url").notNull(),
  servers: jsonb("servers").$type<VideoServerItem[]>().notNull().default([]),
  downloadLinks: jsonb("download_links").$type<DownloadLinkItem[]>().notNull().default([]),
  year: integer("year").notNull().default(2025),
  seasonsCount: integer("seasons_count").notNull().default(2),
  episodesCount: integer("episodes_count").notNull().default(16),
  genre: text("genre").notNull().default("drama"),
  genreAr: text("genre_ar").notNull().default("دراما"),
  genreEn: text("genre_en").notNull().default("Drama"),
  categorySlug: text("category_slug").notNull().default("series"),
  country: text("country").notNull().default("UAE / Lebanon"),
  countryAr: text("country_ar").notNull().default("الإمارات / لبنان"),
  countryEn: text("country_en").notNull().default("UAE / Lebanon"),
  rating: real("rating").notNull().default(9.1),
  quality: text("quality").notNull().default("4K"),
  language: text("language").notNull().default("العربية"),
  originType: text("origin_type").notNull().default("arabic"),
  directorAr: text("director_ar").notNull().default("سامر البرقاوي"),
  directorEn: text("director_en").notNull().default("Samer Al-Barqawi"),
  castAr: text("cast_ar").notNull().default("باسل خياط، دانييلا رحمة، قصي خولي"),
  castEn: text("cast_en").notNull().default("Bassel Khaiat, Daniella Rahme, Kosai Khauli"),
  badge: text("badge").notNull().default("SERIES"),
  isFeatured: boolean("is_featured").notNull().default(false),
  isPopular: boolean("is_popular").notNull().default(true),
  isLatest: boolean("is_latest").notNull().default(true),
  viewsCount: integer("views_count").notNull().default(28500),
  uniqueViewsCount: integer("unique_views_count").notNull().default(21400),
  watchTimeMinutes: integer("watch_time_minutes").notNull().default(43200),
  lastViewedAt: timestamp("last_viewed_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const seasons = pgTable("seasons", {
  id: serial("id").primaryKey(),
  seriesId: integer("series_id").notNull(),
  seasonNumber: integer("season_number").notNull().default(1),
  titleAr: text("title_ar").notNull(),
  titleEn: text("title_en").notNull(),
  year: integer("year").notNull().default(2025),
  posterUrl: text("poster_url"),
});

export const episodes = pgTable("episodes", {
  id: serial("id").primaryKey(),
  seriesId: integer("series_id").notNull(),
  seasonId: integer("season_id").notNull(),
  seasonNumber: integer("season_number").notNull().default(1),
  episodeNumber: integer("episode_number").notNull().default(1),
  titleAr: text("title_ar").notNull(),
  titleEn: text("title_en").notNull(),
  descriptionAr: text("description_ar").notNull(),
  descriptionEn: text("description_en").notNull(),
  duration: text("duration").notNull().default("48m"),
  thumbnailUrl: text("thumbnail_url").notNull(),
  videoUrl: text("video_url").notNull(),
  hlsUrl: text("hls_url").notNull(),
  servers: jsonb("servers").$type<VideoServerItem[]>().notNull().default([]),
  downloadLinks: jsonb("download_links").$type<DownloadLinkItem[]>().notNull().default([]),
  viewsCount: integer("views_count").notNull().default(4200),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const subtitles = pgTable("subtitles", {
  id: serial("id").primaryKey(),
  mediaType: text("media_type").notNull().default("movie"),
  mediaId: integer("media_id").notNull(),
  langCode: text("lang_code").notNull().default("ar"),
  labelAr: text("label_ar").notNull().default("العربية"),
  labelEn: text("label_en").notNull().default("Arabic"),
  vttUrl: text("vtt_url").notNull(),
});

export const watchlist = pgTable("watchlist", {
  id: serial("id").primaryKey(),
  clientKey: text("client_key").notNull().default("guest-default"),
  mediaType: text("media_type").notNull().default("movie"),
  mediaId: integer("media_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const favorites = pgTable("favorites", {
  id: serial("id").primaryKey(),
  clientKey: text("client_key").notNull().default("guest-default"),
  mediaType: text("media_type").notNull().default("movie"),
  mediaId: integer("media_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const searchAnalytics = pgTable("search_analytics", {
  id: serial("id").primaryKey(),
  query: text("query").notNull(),
  normalizedQuery: text("normalized_query").notNull().unique(),
  categoryHint: text("category_hint").default("all"),
  searchCount: integer("search_count").notNull().default(1),
  lastSearchedAt: timestamp("last_searched_at").defaultNow().notNull(),
});

export const movieRequests = pgTable("movie_requests", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  normalizedTitle: text("normalized_title").notNull(),
  year: integer("year").notNull().default(2025),
  mediaType: text("media_type").notNull().default("movie"), // 'movie' | 'series'
  referenceUrl: text("reference_url").default(""),
  message: text("message").default(""),
  requesterName: text("requester_name").notNull().default("Guest"),
  requesterEmail: text("requester_email").default(""),
  userId: integer("user_id"),
  requestCount: integer("request_count").notNull().default(1),
  status: text("status").notNull().default("Pending"), // 'Pending' | 'Searching' | 'Added' | 'Rejected'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const premiumRequests = pgTable("premium_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  name: text("name").notNull(),
  email: text("email").notNull(),
  username: text("username").notNull(),
  currentPlan: text("current_plan").notNull().default("Free"),
  requestedPlan: text("requested_plan").notNull().default("Premium Ad-Free"),
  message: text("message").default(""),
  status: text("status").notNull().default("Pending"), // 'Pending' | 'Approved' | 'Rejected'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Per-user playback progress. Unique per (user, media type, content, episode).
// episodeId = 0 for movies.
export const watchProgress = pgTable("watch_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  mediaType: text("media_type").notNull(), // 'movie' | 'series'
  contentId: integer("content_id").notNull(),
  episodeId: integer("episode_id").notNull().default(0),
  seasonNumber: integer("season_number").notNull().default(0),
  episodeNumber: integer("episode_number").notNull().default(0),
  currentTime: real("current_time").notNull().default(0),
  duration: real("duration").notNull().default(0),
  completed: boolean("completed").notNull().default(false),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type WatchProgressRecord = typeof watchProgress.$inferSelect;

// Privacy-safe visitor analytics: no IP addresses, names or emails are stored.
// visitor_id / session_id are random anonymous identifiers generated in the browser.
export const visitorAnalytics = pgTable("visitor_analytics", {
  id: serial("id").primaryKey(),
  visitorId: text("visitor_id").notNull(),
  userId: integer("user_id"), // set only for logged-in users (from verified token)
  country: text("country"),
  countryCode: text("country_code"), // ISO-3166 alpha-2, "XX" = unknown
  pageType: text("page_type"),
  contentId: integer("content_id"),
  contentType: text("content_type"), // 'movie' | 'series' | 'episode'
  eventType: text("event_type").notNull(), // site_visit | page_view | movie_view | series_view | episode_view | search
  sessionId: text("session_id").notNull(),
  dedupeKey: text("dedupe_key").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  card: string;
  text: string;
  textSecondary: string;
  button: string;
  buttonHover: string;
  border: string;
  header: string;
  footer: string;
}

// Optional per-section background overrides ("" = inherit from theme)
export interface SectionColors {
  header: string;
  navigation: string;
  hero: string;
  movieSections: string;
  seriesSections: string;
  movieCard: string;
  seriesCard: string;
  searchBar: string;
  buttons: string;
  footer: string;
  loginPage: string;
  registerPage: string;
  userProfile: string;
}

export interface AdSlot {
  enabled: boolean;
  code: string;
}

export interface AdConfig {
  popup: AdSlot;        // pop-up / popunder, fires on user interaction
  bannerHeader: AdSlot; // banner above the page
  bannerPlayer: AdSlot; // banner below the video player
  bannerFooter: AdSlot; // banner in the footer
  headerScripts: AdSlot; // analytics / tracking / verification tags
}

export interface PremiumSettings {
  price: string;              // e.g. "$5 / Month"
  telegramUsername: string;   // e.g. "@YourTelegramHandler"
  paymentInstructions: string; // Vodafone Cash / PayPal / USDT / bank details
}

export interface PlatformSettingsData {
  adConfig: AdConfig;
  premiumSettings: PremiumSettings;
  siteName: string;
  logoUrl: string; // "" = default logo, "none" = removed, otherwise image URL / data URL
  telegramContactUrl: string;
  themePreset: string;
  theme: ThemeColors;
  sections: SectionColors;
  requireEmailVerification: boolean;
  requirePhoneVerification: boolean;
  registrationEnabled: boolean;
  movieRequestsEnabled: boolean;
  downloadsEnabled: boolean;
  adsEnabled: boolean;
  adsForFreeUsers: boolean;
  adsForPremiumUsers: boolean;
  maintenanceMode: boolean;
  defaultLanguage: "ar" | "en";
  maxVideoServers: number; // 1 to 6
  premiumFeaturesEnabled: boolean;
  aboutUsAr: string;
  aboutUsEn: string;
  privacyPolicyAr: string;
  privacyPolicyEn: string;
  termsOfServiceAr: string;
  termsOfServiceEn: string;
  totalVisits: number;
  uniqueVisitors: number;
}

export const siteSettings = pgTable("site_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  data: jsonb("data").$type<PlatformSettingsData>().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type UserRecord = typeof users.$inferSelect;
export type MovieRecord = typeof movies.$inferSelect;
export type NewMovieRecord = typeof movies.$inferInsert;
export type SeriesRecord = typeof series.$inferSelect;
export type NewSeriesRecord = typeof series.$inferInsert;
export type SeasonRecord = typeof seasons.$inferSelect;
export type EpisodeRecord = typeof episodes.$inferSelect;
export type CategoryRecord = typeof categories.$inferSelect;
export type SubtitleRecord = typeof subtitles.$inferSelect;
export type SearchAnalyticRecord = typeof searchAnalytics.$inferSelect;
export type MovieRequestRecord = typeof movieRequests.$inferSelect;
export type PremiumRequestRecord = typeof premiumRequests.$inferSelect;
