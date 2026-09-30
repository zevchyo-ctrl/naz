import { pool, db } from "./index";
import {
  categories,
  genres,
  movies,
  series,
  seasons,
  episodes,
  subtitles,
  users,
  searchAnalytics,
  movieRequests,
  premiumRequests,
  siteSettings,
  VideoServerItem,
  DownloadLinkItem,
  PlatformSettingsData,
} from "./schema";
import { count, eq } from "drizzle-orm";
import { DEFAULT_BRANDING, DEFAULT_AD_CONFIG, DEFAULT_PREMIUM_SETTINGS } from "@/lib/defaults";

const SAMPLE_HLS_1 = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";
const SAMPLE_HLS_2 =
  "https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8";

const VIDEO_SPACE =
  "https://videos.pexels.com/video-files/36136184/15324554_3840_2160_24fps.mp4";
const VIDEO_CITY =
  "https://videos.pexels.com/video-files/30078588/12900812_3840_2160_25fps.mp4";
const VIDEO_DRONE =
  "https://videos.pexels.com/video-files/34579322/14652595_3840_2160_30fps.mp4";
const VIDEO_LOBBY =
  "https://videos.pexels.com/video-files/31801785/13548474_3840_2160_25fps.mp4";
const VIDEO_ASTRO =
  "https://videos.pexels.com/video-files/7665028/7665028-hd_1920_1080_25fps.mp4";

export function buildDefaultServers(
  primaryMp4: string,
  primaryHls: string = SAMPLE_HLS_1
): VideoServerItem[] {
  return [
    {
      id: 1,
      nameAr: "سيرفر ناز الرئيسي 4K",
      nameEn: "Server 1 (NAZ Ultra 4K)",
      url: primaryMp4,
      hlsUrl: primaryHls,
      type: "mp4",
      quality: "4K",
      isEnabled: true,
    },
    {
      id: 2,
      nameAr: "سيرفر البث السريع HLS",
      nameEn: "Server 2 (HLS Adaptive)",
      url: primaryHls,
      hlsUrl: primaryHls,
      type: "hls",
      quality: "1080p",
      isEnabled: true,
    },
    {
      id: 3,
      nameAr: "سيرفر السينما الذهبي",
      nameEn: "Server 3 (Gold Cinema CDN)",
      url: VIDEO_DRONE,
      hlsUrl: SAMPLE_HLS_2,
      type: "mp4",
      quality: "4K",
      isEnabled: true,
    },
    {
      id: 4,
      nameAr: "سيرفر احتياطي فائق السرعة",
      nameEn: "Server 4 (Turbo Mirror)",
      url: VIDEO_CITY,
      hlsUrl: primaryHls,
      type: "mp4",
      quality: "1080p",
      isEnabled: true,
    },
    {
      id: 5,
      nameAr: "سيرفر خارجي مباشر",
      nameEn: "Server 5 (External Direct)",
      url: VIDEO_SPACE,
      hlsUrl: SAMPLE_HLS_2,
      type: "external",
      quality: "1080p",
      isEnabled: true,
    },
    {
      id: 6,
      nameAr: "سيرفر السرعات المتوسطة 720p",
      nameEn: "Server 6 (Eco Stream 720p)",
      url: VIDEO_ASTRO,
      hlsUrl: primaryHls,
      type: "mp4",
      quality: "720p",
      isEnabled: true,
    },
  ];
}

export function buildDefaultDownloads(videoUrl: string): DownloadLinkItem[] {
  return [
    {
      id: "dl-4k",
      quality: "4K",
      size: "4.8 GB",
      url: `${videoUrl}?download=4k`,
      format: "MP4 • HEVC 10-bit",
      isEnabled: true,
    },
    {
      id: "dl-1080p",
      quality: "1080p",
      size: "2.1 GB",
      url: `${videoUrl}?download=1080p`,
      format: "MP4 • Full HD",
      isEnabled: true,
    },
    {
      id: "dl-720p",
      quality: "720p",
      size: "950 MB",
      url: `${videoUrl}?download=720p`,
      format: "MP4 • HD Ready",
      isEnabled: true,
    },
  ];
}

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettingsData = {
  ...DEFAULT_BRANDING,
  adConfig: DEFAULT_AD_CONFIG,
  premiumSettings: DEFAULT_PREMIUM_SETTINGS,
  requireEmailVerification: false,
  requirePhoneVerification: false,
  registrationEnabled: true,
  movieRequestsEnabled: true,
  downloadsEnabled: true,
  adsEnabled: true,
  adsForFreeUsers: true,
  adsForPremiumUsers: false,
  maintenanceMode: false,
  defaultLanguage: "ar",
  maxVideoServers: 6,
  premiumFeaturesEnabled: true,
  totalVisits: 148920,
  uniqueVisitors: 64310,
  aboutUsAr: `منصة NAZMOVIES (أفلام ناز) هي وجهتك السينمائية الفاخرة لاكتشاف ومشاهدة أحدث الأفلام والمسلسلات العربية والعالمية بجودة فائقة تصل إلى 4K Ultra HD.

تأسست المنصة لتقديم تجربة بث حديثة تجمع بين التصميم السينمائي الفاخر، تعدد سيرفرات المشاهدة السريعة (حتى 6 سيرفرات لكل عرض)، وخيارات التحميل المباشر للمحتوى المرخص، مع دعم كامل للغتين العربية والإنجليزية.

رسالتنا هي وضع المشاهد في قلب صالة سينمائية خاصة، مع واجهة زجاجية سلسة، قوائم مشاهدة ذكية، وإمكانية طلب الأعمال المفضلة ليتم توفيرها بأعلى جودة ممكنة.`,
  aboutUsEn: `NAZMOVIES (Naz Movies) is your premier luxury streaming destination for discovering and watching the finest Arabic and international movies and TV series in up to 4K Ultra HD quality.

Built with a passion for world-class cinema, NAZMOVIES combines a bespoke obsidian-and-gold liquid glass aesthetic with ultra-reliable multi-server streaming (up to 6 redundant servers per title) and authorized direct downloads.

Our mission is to bring the grandeur of a private IMAX theater directly to your screen, complete with instant Arabic RTL and English LTR support, personalized watchlists, and community-driven movie requests.`,
  privacyPolicyAr: `1. معلومات الحساب:
نقوم بجمع المعلومات الأساسية عند إنشاء الحساب مثل الاسم، البريد الإلكتروني، واسم المستخدم لتخصيص تجربتك وحفظ قائمتك المفضلة.

2. ملفات تعريف الارتباط والتخزين المحلي (Cookies & LocalStorage):
نستخدم التخزين المحلي لحفظ تفضيلات اللغة (العربية/الإنجليزية)، قائمة المشاهدة، وجلسة الدخول لضمان تجربة سريعة وسلسة.

3. التحليلات وإحصائيات المشاهدة:
نقوم بتسجيل إحصائيات المشاهدة الفعلية ووقت المشاهدة بشكل مجمع لتحسين جودة السيرفرات ومعرفة الأعمال الأكثر شعبية.

4. تحليلات البحث:
يتم حفظ الكلمات الأكثر بحثاً بشكل غير شخصي لتطوير مكتبة المحتوى وتوفير الأفلام المطلوبة بسرعة.

5. الإعلانات والحسابات المميزة (Premium):
تظهر الإعلانات الترويجية للحسابات المجانية فقط لدعم استمرارية المنصة، بينما يتمتع مشتركو الحسابات المميزة (Premium Ad-Free) بتجربة خالية تماماً من الإعلانات.

6. الاحتفاظ بالبيانات وحقوق المستخدم:
يحق لكل مستخدم تعديل بيانات ملفه الشخصي أو طلب حذف حسابه وسجل مشاهداته في أي وقت عبر التواصل مع إدارة المنصة.

7. معلومات التواصل:
لأي استفسارات تتعلق بالخصوصية، يمكنكم مراسلة فريق إدارة NAZMOVIES عبر نموذج التواصل أو طلبات الترقية داخل الموقع.`,
  privacyPolicyEn: `1. Account Information:
We collect essential account details such as your name, email address, and username when you register to personalize your profile and synchronize your watchlist.

2. Cookies & Local Storage:
We use browser local storage and session cookies to remember your language preference (Arabic RTL / English LTR), active playback server, and login session.

3. Analytics & Watch History:
We measure meaningful video views and aggregated watch time to optimize streaming server capacity and curate our Most Watched rankings.

4. Search Analytics:
Search queries are logged in an aggregated, privacy-respecting manner to understand trending titles and fulfill audience demand.

5. Advertising & Premium Accounts:
Standard free accounts may see curated promotional banners when enabled by the administrator. Approved Premium accounts enjoy a 100% ad-free cinema experience.

6. Data Retention & User Rights:
You retain the right to view, update, or request deletion of your profile information at any time through your account settings.

7. Contact Information:
For questions regarding this Privacy Policy, please reach out to the NAZMOVIES administration team through our platform contact forms.`,
  termsOfServiceAr: `1. قبول الشروط:
باستخدامك لمنصة NAZMOVIES (أفلام ناز)، فإنك توافق على الالتزام بهذه الشروط والأحكام المنظمة لاستخدام المنصة وخدماتها.

2. حقوق الملكية والمحتوى المرخص:
جميع الروابط والسيرفرات المضافة عبر المنصة مخصصة للمحتوى الذي يمتلك مالك المنصة حقوق توزيعه أو بثه بشكل قانوني ومرخص.

3. استخدام الحساب الشخصي:
يلتزم المستخدم بالحفاظ على سرية بيانات الدخول الخاصة به، وعدم استخدام المنصة بأي طريقة تضر بالسيرفرات أو تعطل تجربة المستخدمين الآخرين.

4. نظام طلب الأفلام والترقية المميزة:
تخضع طلبات إضافة الأفلام وطلبات الترقية إلى الباقة الخالية من الإعلانات (Premium) لمراجعة وموافقة إدارة الموقع.

5. التعديلات وتحديث الخدمة:
تحتفظ إدارة NAZMOVIES بالحق في تحديث السيرفرات، تعديل الميزات، أو تفعيل وضع الصيانة المؤقت لتحسين الأداء في أي وقت.`,
  termsOfServiceEn: `1. Acceptance of Terms:
By accessing and using NAZMOVIES (Naz Movies), you agree to abide by these Terms of Service and all applicable regulations.

2. Authorized Content & Distribution:
All streaming servers and download options provided on the platform are strictly intended for media that the platform operator is authorized to host, link, or distribute.

3. User Accounts & Security:
Users are responsible for maintaining the confidentiality of their account credentials and for all activities that occur under their profile.

4. Movie Requests & Premium Upgrades:
Submissions made through the "Request a Movie" and "Upgrade to Ad-Free" systems are reviewed by platform administrators and fulfilled at their discretion.

5. Service Modifications:
NAZMOVIES reserves the right to update streaming servers, modify platform features, or schedule maintenance windows to ensure optimal cinema performance.`,
};

let isSeeded = false;
let seedingPromise: Promise<void> | null = null;

// Serialize seeding: in-process promise lock + cross-process advisory lock.
// Without this, parallel first requests raced and caused unique-key failures (500s).
export async function ensureSeeded() {
  if (isSeeded) return;
  if (!seedingPromise) {
    seedingPromise = (async () => {
      const lockClient = await pool.connect();
      try {
        await lockClient.query("SELECT pg_advisory_lock(977032701)");
        await runSeed();
      } finally {
        await lockClient.query("SELECT pg_advisory_unlock(977032701)").catch(() => {});
        lockClient.release();
      }
    })().catch((err) => {
      seedingPromise = null;
      throw err;
    });
  }
  await seedingPromise;
}

async function runSeed() {
  if (isSeeded) return;

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        username TEXT NOT NULL DEFAULT 'naz_user',
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL DEFAULT '',
        phone TEXT DEFAULT '',
        role TEXT NOT NULL DEFAULT 'member',
        avatar_url TEXT,
        bio TEXT DEFAULT '',
        preferred_lang TEXT NOT NULL DEFAULT 'ar',
        is_email_verified BOOLEAN NOT NULL DEFAULT false,
        is_phone_verified BOOLEAN NOT NULL DEFAULT false,
        is_premium BOOLEAN NOT NULL DEFAULT false,
        plan TEXT NOT NULL DEFAULT 'free',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        name_ar TEXT NOT NULL,
        name_en TEXT NOT NULL,
        description_ar TEXT NOT NULL,
        description_en TEXT NOT NULL,
        icon TEXT NOT NULL,
        accent_color TEXT NOT NULL DEFAULT '#FFD21F',
        sort_order INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS genres (
        id SERIAL PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        name_ar TEXT NOT NULL,
        name_en TEXT NOT NULL,
        icon TEXT NOT NULL DEFAULT '🎬'
      );

      CREATE TABLE IF NOT EXISTS movies (
        id SERIAL PRIMARY KEY,
        slug TEXT NOT NULL,
        title TEXT NOT NULL,
        title_ar TEXT NOT NULL,
        title_en TEXT NOT NULL,
        description TEXT NOT NULL,
        description_ar TEXT NOT NULL,
        description_en TEXT NOT NULL,
        poster_url TEXT NOT NULL,
        backdrop_url TEXT NOT NULL,
        video_url TEXT NOT NULL,
        hls_url TEXT NOT NULL,
        servers JSONB NOT NULL DEFAULT '[]'::jsonb,
        download_links JSONB NOT NULL DEFAULT '[]'::jsonb,
        year INTEGER NOT NULL DEFAULT 2025,
        duration TEXT NOT NULL DEFAULT '2h 18m',
        genre TEXT NOT NULL DEFAULT 'action',
        genre_ar TEXT NOT NULL DEFAULT 'أكشن',
        genre_en TEXT NOT NULL DEFAULT 'Action',
        category_slug TEXT NOT NULL DEFAULT 'movies',
        country TEXT NOT NULL DEFAULT 'USA',
        country_ar TEXT NOT NULL DEFAULT 'الولايات المتحدة',
        country_en TEXT NOT NULL DEFAULT 'United States',
        rating REAL NOT NULL DEFAULT 8.5,
        quality TEXT NOT NULL DEFAULT '4K',
        language TEXT NOT NULL DEFAULT 'Arabic / English',
        origin_type TEXT NOT NULL DEFAULT 'foreign',
        director_ar TEXT NOT NULL DEFAULT 'طارق العلي',
        director_en TEXT NOT NULL DEFAULT 'Tariq Al-Ali',
        cast_ar TEXT NOT NULL DEFAULT 'آدم منصور، ليلى الهاشمي',
        cast_en TEXT NOT NULL DEFAULT 'Adam Mansour, Layla Al-Hashimi',
        badge TEXT NOT NULL DEFAULT '4K',
        is_featured BOOLEAN NOT NULL DEFAULT false,
        is_popular BOOLEAN NOT NULL DEFAULT true,
        is_latest BOOLEAN NOT NULL DEFAULT true,
        views_count INTEGER NOT NULL DEFAULT 12400,
        unique_views_count INTEGER NOT NULL DEFAULT 9200,
        watch_time_minutes INTEGER NOT NULL DEFAULT 18400,
        last_viewed_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS series (
        id SERIAL PRIMARY KEY,
        slug TEXT NOT NULL,
        title TEXT NOT NULL,
        title_ar TEXT NOT NULL,
        title_en TEXT NOT NULL,
        description TEXT NOT NULL,
        description_ar TEXT NOT NULL,
        description_en TEXT NOT NULL,
        poster_url TEXT NOT NULL,
        backdrop_url TEXT NOT NULL,
        video_url TEXT NOT NULL,
        hls_url TEXT NOT NULL,
        servers JSONB NOT NULL DEFAULT '[]'::jsonb,
        download_links JSONB NOT NULL DEFAULT '[]'::jsonb,
        year INTEGER NOT NULL DEFAULT 2025,
        seasons_count INTEGER NOT NULL DEFAULT 2,
        episodes_count INTEGER NOT NULL DEFAULT 16,
        genre TEXT NOT NULL DEFAULT 'drama',
        genre_ar TEXT NOT NULL DEFAULT 'دراما',
        genre_en TEXT NOT NULL DEFAULT 'Drama',
        category_slug TEXT NOT NULL DEFAULT 'series',
        country TEXT NOT NULL DEFAULT 'UAE',
        country_ar TEXT NOT NULL DEFAULT 'الإمارات',
        country_en TEXT NOT NULL DEFAULT 'UAE',
        rating REAL NOT NULL DEFAULT 9.1,
        quality TEXT NOT NULL DEFAULT '4K',
        language TEXT NOT NULL DEFAULT 'العربية',
        origin_type TEXT NOT NULL DEFAULT 'arabic',
        director_ar TEXT NOT NULL DEFAULT 'سامر البرقاوي',
        director_en TEXT NOT NULL DEFAULT 'Samer Al-Barqawi',
        cast_ar TEXT NOT NULL DEFAULT 'باسل خياط، دانييلا رحمة',
        cast_en TEXT NOT NULL DEFAULT 'Bassel Khaiat, Daniella Rahme',
        badge TEXT NOT NULL DEFAULT 'SERIES',
        is_featured BOOLEAN NOT NULL DEFAULT false,
        is_popular BOOLEAN NOT NULL DEFAULT true,
        is_latest BOOLEAN NOT NULL DEFAULT true,
        views_count INTEGER NOT NULL DEFAULT 28500,
        unique_views_count INTEGER NOT NULL DEFAULT 21400,
        watch_time_minutes INTEGER NOT NULL DEFAULT 43200,
        last_viewed_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS seasons (
        id SERIAL PRIMARY KEY,
        series_id INTEGER NOT NULL,
        season_number INTEGER NOT NULL DEFAULT 1,
        title_ar TEXT NOT NULL,
        title_en TEXT NOT NULL,
        year INTEGER NOT NULL DEFAULT 2025,
        poster_url TEXT
      );

      CREATE TABLE IF NOT EXISTS episodes (
        id SERIAL PRIMARY KEY,
        series_id INTEGER NOT NULL,
        season_id INTEGER NOT NULL,
        season_number INTEGER NOT NULL DEFAULT 1,
        episode_number INTEGER NOT NULL DEFAULT 1,
        title_ar TEXT NOT NULL,
        title_en TEXT NOT NULL,
        description_ar TEXT NOT NULL,
        description_en TEXT NOT NULL,
        duration TEXT NOT NULL DEFAULT '48m',
        thumbnail_url TEXT NOT NULL,
        video_url TEXT NOT NULL,
        hls_url TEXT NOT NULL,
        servers JSONB NOT NULL DEFAULT '[]'::jsonb,
        download_links JSONB NOT NULL DEFAULT '[]'::jsonb,
        views_count INTEGER NOT NULL DEFAULT 4200,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS subtitles (
        id SERIAL PRIMARY KEY,
        media_type TEXT NOT NULL DEFAULT 'movie',
        media_id INTEGER NOT NULL,
        lang_code TEXT NOT NULL DEFAULT 'ar',
        label_ar TEXT NOT NULL DEFAULT 'العربية',
        label_en TEXT NOT NULL DEFAULT 'Arabic',
        vtt_url TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS watchlist (
        id SERIAL PRIMARY KEY,
        client_key TEXT NOT NULL DEFAULT 'guest-default',
        media_type TEXT NOT NULL DEFAULT 'movie',
        media_id INTEGER NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS favorites (
        id SERIAL PRIMARY KEY,
        client_key TEXT NOT NULL DEFAULT 'guest-default',
        media_type TEXT NOT NULL DEFAULT 'movie',
        media_id INTEGER NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS search_analytics (
        id SERIAL PRIMARY KEY,
        query TEXT NOT NULL,
        normalized_query TEXT NOT NULL UNIQUE,
        category_hint TEXT DEFAULT 'all',
        search_count INTEGER NOT NULL DEFAULT 1,
        last_searched_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS movie_requests (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        normalized_title TEXT NOT NULL,
        year INTEGER NOT NULL DEFAULT 2025,
        media_type TEXT NOT NULL DEFAULT 'movie',
        reference_url TEXT DEFAULT '',
        message TEXT DEFAULT '',
        requester_name TEXT NOT NULL DEFAULT 'Guest',
        requester_email TEXT DEFAULT '',
        user_id INTEGER,
        request_count INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'Pending',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS premium_requests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        username TEXT NOT NULL,
        current_plan TEXT NOT NULL DEFAULT 'Free',
        requested_plan TEXT NOT NULL DEFAULT 'Premium Ad-Free',
        message TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'Pending',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS watch_progress (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        media_type TEXT NOT NULL,
        content_id INTEGER NOT NULL,
        episode_id INTEGER NOT NULL DEFAULT 0,
        season_number INTEGER NOT NULL DEFAULT 0,
        episode_number INTEGER NOT NULL DEFAULT 0,
        "current_time" REAL NOT NULL DEFAULT 0,
        duration REAL NOT NULL DEFAULT 0,
        completed BOOLEAN NOT NULL DEFAULT false,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT watch_progress_unique UNIQUE (user_id, media_type, content_id, episode_id)
      );
      CREATE INDEX IF NOT EXISTS watch_progress_user_idx ON watch_progress (user_id, updated_at DESC);

      CREATE TABLE IF NOT EXISTS visitor_analytics (
        id SERIAL PRIMARY KEY,
        visitor_id TEXT NOT NULL,
        user_id INTEGER,
        country TEXT,
        country_code TEXT,
        page_type TEXT,
        content_id INTEGER,
        content_type TEXT,
        event_type TEXT NOT NULL,
        session_id TEXT NOT NULL,
        dedupe_key TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS visitor_analytics_time_idx ON visitor_analytics (created_at);
      CREATE INDEX IF NOT EXISTS visitor_analytics_event_time_idx ON visitor_analytics (event_type, created_at);

      CREATE TABLE IF NOT EXISTS site_settings (
        id SERIAL PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        data JSONB NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Ensure new columns exist if tables were created previously
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT NOT NULL DEFAULT 'naz_user';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT NOT NULL DEFAULT '';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_phone_verified BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_premium BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_plain TEXT NOT NULL DEFAULT '';

      ALTER TABLE movies ADD COLUMN IF NOT EXISTS servers JSONB NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE movies ADD COLUMN IF NOT EXISTS download_links JSONB NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE movies ADD COLUMN IF NOT EXISTS unique_views_count INTEGER NOT NULL DEFAULT 9200;
      ALTER TABLE movies ADD COLUMN IF NOT EXISTS watch_time_minutes INTEGER NOT NULL DEFAULT 18400;
      ALTER TABLE movies ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMP NOT NULL DEFAULT NOW();

      ALTER TABLE series ADD COLUMN IF NOT EXISTS servers JSONB NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE series ADD COLUMN IF NOT EXISTS download_links JSONB NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE series ADD COLUMN IF NOT EXISTS unique_views_count INTEGER NOT NULL DEFAULT 21400;
      ALTER TABLE series ADD COLUMN IF NOT EXISTS watch_time_minutes INTEGER NOT NULL DEFAULT 43200;
      ALTER TABLE series ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMP NOT NULL DEFAULT NOW();

      ALTER TABLE episodes ADD COLUMN IF NOT EXISTS servers JSONB NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE episodes ADD COLUMN IF NOT EXISTS download_links JSONB NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE episodes ADD COLUMN IF NOT EXISTS views_count INTEGER NOT NULL DEFAULT 4200;
    `);
  } finally {
    client.release();
  }

  // Ensure site settings exist
  const existingSettings = await db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.key, "main"));
  if (existingSettings.length === 0) {
    await db.insert(siteSettings).values({
      key: "main",
      data: DEFAULT_PLATFORM_SETTINGS,
    });
  }

  // Check if movies already exist
  const [{ value: movieCount }] = await db.select({ value: count() }).from(movies);
  if (movieCount > 0) {
    isSeeded = true;
    return;
  }

  // Seed default users
  await db.insert(users).values([
    {
      name: "المدير العام - NAZMOVIES",
      username: "naz_admin",
      email: "admin@nazmovies.com",
      passwordHash: "9770327",
      phone: "+966500000001",
      role: "admin",
      preferredLang: "ar",
      isEmailVerified: true,
      isPhoneVerified: true,
      isPremium: true,
      plan: "premium",
      bio: "مدير منصة أفلام ناز السينمائية",
    },
    {
      name: "نواف المنصور",
      username: "nawaf_vip",
      email: "vip@nazmovies.com",
      passwordHash: "123456",
      phone: "+966500000002",
      role: "member",
      preferredLang: "ar",
      isEmailVerified: true,
      isPhoneVerified: false,
      isPremium: true,
      plan: "premium",
      bio: "عاشق للسينما وأفلام الخيال العلمي بدقة 4K",
    },
    {
      name: "سارة الهاشمي",
      username: "sara_cinema",
      email: "sara@nazmovies.com",
      passwordHash: "123456",
      phone: "+971500000003",
      role: "member",
      preferredLang: "ar",
      isEmailVerified: false,
      isPhoneVerified: false,
      isPremium: false,
      plan: "free",
      bio: "متابعة للمسلسلات العربية والتاريخية",
    },
  ]);

  // Seed 12 Categories
  await db.insert(categories).values([
    {
      slug: "movies",
      nameAr: "أفلام",
      nameEn: "Movies",
      descriptionAr: "أحدث الأفلام السينمائية العالمية والعربية بجودة 4K فائقة",
      descriptionEn: "Blockbuster international and Arabic cinema in 4K Ultra HD",
      icon: "🎬",
      accentColor: "#FFD21F",
      sortOrder: 1,
    },
    {
      slug: "series",
      nameAr: "مسلسلات",
      nameEn: "Series",
      descriptionAr: "مسلسلات درامية وتشويقية حصرية بمواسم كاملة",
      descriptionEn: "Exclusive binge-worthy drama and thriller series",
      icon: "📺",
      accentColor: "#E50914",
      sortOrder: 2,
    },
    {
      slug: "action",
      nameAr: "أكشن",
      nameEn: "Action",
      descriptionAr: "ملاحم الحركة والمطاردات والمعارك عالية الإثارة",
      descriptionEn: "High-octane chases, tactical combat, and adrenaline",
      icon: "🔥",
      accentColor: "#FF5722",
      sortOrder: 3,
    },
    {
      slug: "romance",
      nameAr: "رومانسي",
      nameEn: "Romance",
      descriptionAr: "قصص حب خالدة ومشاعر إنسانية دافئة",
      descriptionEn: "Timeless love stories and heartfelt cinema",
      icon: "❤️",
      accentColor: "#F43F5E",
      sortOrder: 4,
    },
    {
      slug: "comedy",
      nameAr: "كوميديا",
      nameEn: "Comedy",
      descriptionAr: "أفلام كوميدية ممتعة لأمسية مليئة بالبهجة",
      descriptionEn: "Feel-good comedies and witty entertainment",
      icon: "😂",
      accentColor: "#FBBF24",
      sortOrder: 5,
    },
    {
      slug: "horror",
      nameAr: "رعب",
      nameEn: "Horror",
      descriptionAr: "غموض ما وراء الطبيعة وإثارة تحبس الأنفاس",
      descriptionEn: "Supernatural chills and psychological terror",
      icon: "👻",
      accentColor: "#991B1B",
      sortOrder: 6,
    },
    {
      slug: "scifi",
      nameAr: "خيال علمي",
      nameEn: "Sci-Fi",
      descriptionAr: "رحلات عبر المجرات وعوالم المستقبل المذهلة",
      descriptionEn: "Interstellar odysseys and futuristic worlds",
      icon: "🚀",
      accentColor: "#38BDF8",
      sortOrder: 7,
    },
    {
      slug: "mystery",
      nameAr: "غموض",
      nameEn: "Mystery",
      descriptionAr: "ألغاز معقدة وتحقيقات لا تهدأ حتى اللحظة الأخيرة",
      descriptionEn: "Mind-bending puzzles and neo-noir investigations",
      icon: "🔎",
      accentColor: "#A855F7",
      sortOrder: 8,
    },
    {
      slug: "drama",
      nameAr: "دراما",
      nameEn: "Drama",
      descriptionAr: "روائع القصص الإنسانية والتاريخية العميقة",
      descriptionEn: "Powerful character studies and emotional depth",
      icon: "🎭",
      accentColor: "#FFD21F",
      sortOrder: 9,
    },
    {
      slug: "top-rated",
      nameAr: "الأعلى تقييمًا",
      nameEn: "Top Rated",
      descriptionAr: "تحف سينمائية حازت على أعلى تقييمات النقاد والجمهور",
      descriptionEn: "Critically acclaimed masterpieces with 9.0+ ratings",
      icon: "🏆",
      accentColor: "#FFB800",
      sortOrder: 10,
    },
    {
      slug: "foreign",
      nameAr: "أجنبي",
      nameEn: "Foreign",
      descriptionAr: "إنتاجات هوليوود والسينما الأوروبية والآسيوية المترجمة",
      descriptionEn: "Hollywood, European, and global blockbusters",
      icon: "🌎",
      accentColor: "#60A5FA",
      sortOrder: 11,
    },
    {
      slug: "arabic",
      nameAr: "عربي",
      nameEn: "Arabic",
      descriptionAr: "أقوى الإنتاجات العربية والخليجية والمصرية والشامية",
      descriptionEn: "Premier Arabic cinema and flagship regional productions",
      icon: "🌙",
      accentColor: "#10B981",
      sortOrder: 12,
    },
  ]);

  // Seed Genres
  await db.insert(genres).values([
    { slug: "action", nameAr: "أكشن", nameEn: "Action", icon: "🔥" },
    { slug: "drama", nameAr: "دراما", nameEn: "Drama", icon: "🎭" },
    { slug: "comedy", nameAr: "كوميديا", nameEn: "Comedy", icon: "😂" },
    { slug: "horror", nameAr: "رعب", nameEn: "Horror", icon: "👻" },
    { slug: "scifi", nameAr: "خيال علمي", nameEn: "Sci-Fi", icon: "🚀" },
    { slug: "romance", nameAr: "رومانسي", nameEn: "Romance", icon: "❤️" },
    { slug: "adventure", nameAr: "مغامرات", nameEn: "Adventure", icon: "🧭" },
    { slug: "mystery", nameAr: "غموض", nameEn: "Mystery", icon: "🔎" },
    { slug: "crime", nameAr: "جريمة", nameEn: "Crime", icon: "🕵️" },
  ]);

  // Seed 12 Rich Movies with 6 Servers & Download Links
  const insertedMovies = await db
    .insert(movies)
    .values([
      {
        slug: "sands-of-eternity",
        title: "رمال الخلود",
        titleAr: "رمال الخلود",
        titleEn: "Sands of Eternity",
        description:
          "في مستقبل بعيد حيث تبتلع العواصف الذهبية مدن الأرض، ينطلق القائد راشد في مهمة مستحيلة عبر صحراء المدار المفقود لإنقاذ آخر مفاعل للطاقة النقية قبل كسوف الشمس الأعظم.",
        descriptionAr:
          "في مستقبل بعيد حيث تبتلع العواصف الذهبية مدن الأرض، ينطلق القائد راشد في مهمة مستحيلة عبر صحراء المدار المفقود لإنقاذ آخر مفاعل للطاقة النقية قبل كسوف الشمس الأعظم.",
        descriptionEn:
          "In a distant future where golden storms consume Earth's megacities, Commander Rashid embarks on a perilous expedition across the Eclipse Desert to secure the last pure energy core.",
        posterUrl: "/images/poster-sands-of-eternity.jpg",
        backdropUrl: "/images/backdrop-desert-empire.jpg",
        videoUrl: VIDEO_SPACE,
        hlsUrl: SAMPLE_HLS_1,
        servers: buildDefaultServers(VIDEO_SPACE, SAMPLE_HLS_1),
        downloadLinks: buildDefaultDownloads(VIDEO_SPACE),
        year: 2026,
        duration: "2h 34m",
        genre: "scifi",
        genreAr: "خيال علمي",
        genreEn: "Sci-Fi",
        categorySlug: "scifi",
        country: "UAE / USA",
        countryAr: "الإمارات / أمريكا",
        countryEn: "UAE / USA",
        rating: 9.4,
        quality: "4K",
        language: "العربية / الإنجليزية",
        originType: "arabic",
        directorAr: "ماجد الأنصاري",
        directorEn: "Majid Al-Ansari",
        castAr: "يعقوب الفرحان، صبا مبارك، آدم منصور، كينغسلي بن دير",
        castEn: "Yagoub Alfarhan, Saba Mubarak, Adam Mansour, Kingsley Ben-Adir",
        badge: "4K",
        isFeatured: true,
        isPopular: true,
        isLatest: true,
        viewsCount: 94800,
        uniqueViewsCount: 72100,
        watchTimeMinutes: 189400,
      },
      {
        slug: "midnight-syndicate",
        title: "نقابة منتصف الليل",
        titleAr: "نقابة منتصف الليل",
        titleEn: "Midnight Syndicate",
        description:
          "مهندس أمن سيبراني سابق يُستدرج لتنفيذ أكبر عملية اختراق لخزينة الذهب الفيدرالية في ليلة ممطرة، ليكتشف أن الخزينة تخفي أسراراً تهدد حكومات العالم.",
        descriptionAr:
          "مهندس أمن سيبراني سابق يُستدرج لتنفيذ أكبر عملية اختراق لخزينة الذهب الفيدرالية في ليلة ممطرة، ليكتشف أن الخزينة تخفي أسراراً تهدد حكومات العالم.",
        descriptionEn:
          "A former cyber-security architect is recruited to execute an impossible heist on a sovereign gold vault on a rain-slicked neon night, uncovering a global conspiracy.",
        posterUrl: "/images/poster-midnight-syndicate.jpg",
        backdropUrl: "/images/backdrop-neon-heist.jpg",
        videoUrl: VIDEO_DRONE,
        hlsUrl: SAMPLE_HLS_2,
        servers: buildDefaultServers(VIDEO_DRONE, SAMPLE_HLS_2),
        downloadLinks: buildDefaultDownloads(VIDEO_DRONE),
        year: 2026,
        duration: "2h 19m",
        genre: "action",
        genreAr: "أكشن",
        genreEn: "Action",
        categorySlug: "action",
        country: "USA / UK",
        countryAr: "الولايات المتحدة / بريطانيا",
        countryEn: "USA / UK",
        rating: 9.1,
        quality: "4K",
        language: "الإنجليزية (مترجم)",
        originType: "foreign",
        directorAr: "كريستوفر فانس",
        directorEn: "Christopher Vance",
        castAr: "إدريس إلبا، ريبيكا فيرغسون، رامي مالك",
        castEn: "Idris Elba, Rebecca Ferguson, Rami Malek",
        badge: "NEW",
        isFeatured: true,
        isPopular: true,
        isLatest: true,
        viewsCount: 86300,
        uniqueViewsCount: 64200,
        watchTimeMinutes: 162100,
      },
      {
        slug: "abyssal-horizon",
        title: "أفق الهاوية",
        titleAr: "أفق الهاوية",
        titleEn: "Abyssal Horizon",
        description:
          "طاقم مركبة استكشاف فضائية يلتقط إشارة صوتية قديمة قادمة من حافة ثقب أسود ذهبي، وعند اقترابهم يبدأ الزمن بالتباطؤ وتظهر ذكرياتهم أمامهم كواقع ملموس.",
        descriptionAr:
          "طاقم مركبة استكشاف فضائية يلتقط إشارة صوتية قديمة قادمة من حافة ثقب أسود ذهبي، وعند اقترابهم يبدأ الزمن بالتباطؤ وتظهر ذكرياتهم أمامهم كواقع ملموس.",
        descriptionEn:
          "An interstellar crew intercepts an ancient telemetry signal near a golden supermassive black hole where time dilation brings their deepest memories to life.",
        posterUrl: "/images/poster-abyssal-horizon.jpg",
        backdropUrl: "/images/hero-cinema-gold.jpg",
        videoUrl: VIDEO_SPACE,
        hlsUrl: SAMPLE_HLS_1,
        servers: buildDefaultServers(VIDEO_SPACE, SAMPLE_HLS_1),
        downloadLinks: buildDefaultDownloads(VIDEO_SPACE),
        year: 2025,
        duration: "2h 42m",
        genre: "scifi",
        genreAr: "خيال علمي",
        genreEn: "Sci-Fi",
        categorySlug: "scifi",
        country: "USA",
        countryAr: "الولايات المتحدة",
        countryEn: "United States",
        rating: 9.3,
        quality: "4K",
        language: "الإنجليزية (مترجم)",
        originType: "foreign",
        directorAr: "دينيس لورين",
        directorEn: "Denis Laurent",
        castAr: "كيليان مورفي، ليا سيدو، أوسكار إسحاق",
        castEn: "Cillian Murphy, Léa Seydoux, Oscar Isaac",
        badge: "4K",
        isFeatured: true,
        isPopular: true,
        isLatest: false,
        viewsCount: 79400,
        uniqueViewsCount: 59800,
        watchTimeMinutes: 154200,
      },
      {
        slug: "crimson-whisper",
        title: "الهمس القرمزي",
        titleAr: "الهمس القرمزي",
        titleEn: "Crimson Whisper",
        description:
          "روائية شابة تنتقل إلى قصر قديم يطل على جرف ضبابي لكتابة روايتها الجديدة، لكنها تكتشف أن الغرفة ذات النافذة الحمراء تسجل أحداثاً لم تقع بعد.",
        descriptionAr:
          "روائية شابة تنتقل إلى قصر قديم يطل على جرف ضبابي لكتابة روايتها الجديدة، لكنها تكتشف أن الغرفة ذات النافذة الحمراء تسجل أحداثاً لم تقع بعد.",
        descriptionEn:
          "A young novelist retreats to a cliffside Victorian manor only to discover that the crimson-lit attic room records terrifying events before they happen.",
        posterUrl: "/images/poster-crimson-whisper.jpg",
        backdropUrl:
          "https://images.pexels.com/photos/37911516/pexels-photo-37911516.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
        videoUrl: VIDEO_CITY,
        hlsUrl: SAMPLE_HLS_2,
        servers: buildDefaultServers(VIDEO_CITY, SAMPLE_HLS_2),
        downloadLinks: buildDefaultDownloads(VIDEO_CITY),
        year: 2025,
        duration: "1h 58m",
        genre: "horror",
        genreAr: "رعب",
        genreEn: "Horror",
        categorySlug: "horror",
        country: "UK",
        countryAr: "بريطانيا",
        countryEn: "United Kingdom",
        rating: 8.6,
        quality: "4K",
        language: "الإنجليزية (مترجم)",
        originType: "foreign",
        directorAr: "إيلينا غراي",
        directorEn: "Elena Gray",
        castAr: "آنيا تايلور، بيل سكارسغارد، كلير فوي",
        castEn: "Anya Taylor-Joy, Bill Skarsgård, Claire Foy",
        badge: "HD",
        isFeatured: false,
        isPopular: true,
        isLatest: true,
        viewsCount: 51200,
        uniqueViewsCount: 38900,
        watchTimeMinutes: 88300,
      },
      {
        slug: "oasis-nights",
        title: "ليالي الواحة الذهبية",
        titleAr: "ليالي الواحة الذهبية",
        titleEn: "Golden Oasis Nights",
        description:
          "عازف بيانو وعالمة فلك يلتقيان بالصدفة في مهرجان سينمائي فوق أسطح دبي المتلألئة، لتبدأ رحلة رومانسية كوميدية تمتد عبر ثلاث مدن في ليلة واحدة.",
        descriptionAr:
          "عازف بيانو وعالمة فلك يلتقيان بالصدفة في مهرجان سينمائي فوق أسطح دبي المتلألئة، لتبدأ رحلة رومانسية كوميدية تمتد عبر ثلاث مدن في ليلة واحدة.",
        descriptionEn:
          "A jazz pianist and an astrophysicist cross paths at a rooftop film gala overlooking glittering city lights, sparking an unforgettable romantic adventure.",
        posterUrl: "/images/poster-oasis-nights.jpg",
        backdropUrl:
          "https://images.pexels.com/photos/30057593/pexels-photo-30057593.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
        videoUrl: VIDEO_LOBBY,
        hlsUrl: SAMPLE_HLS_1,
        servers: buildDefaultServers(VIDEO_LOBBY, SAMPLE_HLS_1),
        downloadLinks: buildDefaultDownloads(VIDEO_LOBBY),
        year: 2026,
        duration: "2h 04m",
        genre: "romance",
        genreAr: "رومانسي",
        genreEn: "Romance",
        categorySlug: "romance",
        country: "UAE / Egypt",
        countryAr: "الإمارات / مصر",
        countryEn: "UAE / Egypt",
        rating: 8.8,
        quality: "4K",
        language: "العربية",
        originType: "arabic",
        directorAr: "نادين لبكي",
        directorEn: "Nadine Labaki",
        castAr: "أحمد مالك، رزان جمال، ظافر العابدين",
        castEn: "Ahmed Malek, Razane Jammal, Dhafer L'Abidine",
        badge: "NEW",
        isFeatured: false,
        isPopular: true,
        isLatest: true,
        viewsCount: 63400,
        uniqueViewsCount: 49200,
        watchTimeMinutes: 112000,
      },
      {
        slug: "the-cairo-gambit",
        title: "مناورة القاهرة",
        titleAr: "مناورة القاهرة",
        titleEn: "The Cairo Gambit",
        description:
          "محقق مخضرم يطارد شبكة دولية لتهريب الآثار النادرة عبر مزادات سرية، في دراما بوليسية مشوقة تمزج بين الذكاء والمواجهات الحاسمة.",
        descriptionAr:
          "محقق مخضرم يطارد شبكة دولية لتهريب الآثار النادرة عبر مزادات سرية، في دراما بوليسية مشوقة تمزج بين الذكاء والمواجهات الحاسمة.",
        descriptionEn:
          "A veteran detective tracks an international syndicate auctioning ancient royal artifacts in underground vaults across Cairo and Geneva.",
        posterUrl:
          "https://images.pexels.com/photos/13932609/pexels-photo-13932609.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800",
        backdropUrl:
          "https://images.pexels.com/photos/30878454/pexels-photo-30878454.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
        videoUrl: VIDEO_CITY,
        hlsUrl: SAMPLE_HLS_1,
        servers: buildDefaultServers(VIDEO_CITY, SAMPLE_HLS_1),
        downloadLinks: buildDefaultDownloads(VIDEO_CITY),
        year: 2025,
        duration: "2h 12m",
        genre: "drama",
        genreAr: "دراما",
        genreEn: "Drama",
        categorySlug: "drama",
        country: "Egypt",
        countryAr: "مصر",
        countryEn: "Egypt",
        rating: 9.0,
        quality: "4K",
        language: "العربية",
        originType: "arabic",
        directorAr: "مروان حامد",
        directorEn: "Marwan Hamed",
        castAr: "كريم عبد العزيز، منى زكي، آسر ياسين",
        castEn: "Karim Abdel Aziz, Mona Zaki, Asser Yassin",
        badge: "4K",
        isFeatured: false,
        isPopular: true,
        isLatest: true,
        viewsCount: 74900,
        uniqueViewsCount: 58300,
        watchTimeMinutes: 141000,
      },
      {
        slug: "hotel-casablanca-express",
        title: "قطار كازابلانكا السريع",
        titleAr: "قطار كازابلانكا السريع",
        titleEn: "Casablanca Express",
        description:
          "ثلاثة أصدقاء يجدون أنفسهم بالخطأ على متن قطار فاخر يحمل حقيبة دبلوماسية مفقودة، لتتحول الرحلة إلى مغامرة كوميدية مليئة بالمفاجآت.",
        descriptionAr:
          "ثلاثة أصدقاء يجدون أنفسهم بالخطأ على متن قطار فاخر يحمل حقيبة دبلوماسية مفقودة، لتتحول الرحلة إلى مغامرة كوميدية مليئة بالمفاجآت.",
        descriptionEn:
          "Three friends accidentally board a luxury transcontinental train carrying a swapped diplomatic briefcase, triggering a hilarious chain of chases.",
        posterUrl:
          "https://images.pexels.com/photos/9067815/pexels-photo-9067815.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800",
        backdropUrl:
          "https://images.pexels.com/photos/34007217/pexels-photo-34007217.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
        videoUrl: VIDEO_LOBBY,
        hlsUrl: SAMPLE_HLS_2,
        servers: buildDefaultServers(VIDEO_LOBBY, SAMPLE_HLS_2),
        downloadLinks: buildDefaultDownloads(VIDEO_LOBBY),
        year: 2025,
        duration: "1h 52m",
        genre: "comedy",
        genreAr: "كوميديا",
        genreEn: "Comedy",
        categorySlug: "comedy",
        country: "Morocco / KSA",
        countryAr: "المغرب / السعودية",
        countryEn: "Morocco / KSA",
        rating: 8.4,
        quality: "HD",
        language: "العربية",
        originType: "arabic",
        directorAr: "صهيب قسم الباري",
        directorEn: "Suhaib Gasmelbari",
        castAr: "إبراهيم الحجاج، هشام بهلول، محمد القس",
        castEn: "Ibrahim Al-Hajjaj, Hicham Bahloul, Mohammad Al-Qass",
        badge: "HD",
        isFeatured: false,
        isPopular: false,
        isLatest: true,
        viewsCount: 44100,
        uniqueViewsCount: 33400,
        watchTimeMinutes: 71500,
      },
      {
        slug: "atlas-expedition",
        title: "بعثة جبال الأطلس",
        titleAr: "بعثة جبال الأطلس",
        titleEn: "The Atlas Expedition",
        description:
          "فريق من المستكشفين يتبع خريطة فلكية أندلسية قديمة تقودهم إلى مدينة مفقودة محفورة داخل قمم الجبال الشاهقة.",
        descriptionAr:
          "فريق من المستكشفين يتبع خريطة فلكية أندلسية قديمة تقودهم إلى مدينة مفقودة محفورة داخل قمم الجبال الشاهقة.",
        descriptionEn:
          "A team of explorers follows an ancient Andalusian celestial map leading to a lost citadel carved deep inside towering mountain peaks.",
        posterUrl:
          "https://images.pexels.com/photos/15079026/pexels-photo-15079026.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800",
        backdropUrl:
          "https://images.pexels.com/photos/23384428/pexels-photo-23384428.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
        videoUrl: VIDEO_DRONE,
        hlsUrl: SAMPLE_HLS_1,
        servers: buildDefaultServers(VIDEO_DRONE, SAMPLE_HLS_1),
        downloadLinks: buildDefaultDownloads(VIDEO_DRONE),
        year: 2026,
        duration: "2h 25m",
        genre: "adventure",
        genreAr: "مغامرات",
        genreEn: "Adventure",
        categorySlug: "movies",
        country: "Spain / Morocco",
        countryAr: "إسبانيا / المغرب",
        countryEn: "Spain / Morocco",
        rating: 8.9,
        quality: "4K",
        language: "العربية / الإسبانية",
        originType: "foreign",
        directorAr: "أليخاندرو مونتيرو",
        directorEn: "Alejandro Montero",
        castAr: "بيدرو باسكال، سلمى حايك، أمير المصري",
        castEn: "Pedro Pascal, Salma Hayek, Amir El-Masry",
        badge: "4K",
        isFeatured: false,
        isPopular: true,
        isLatest: true,
        viewsCount: 57800,
        uniqueViewsCount: 44100,
        watchTimeMinutes: 109400,
      },
      {
        slug: "velvet-cipher",
        title: "الشيفرة المخملية",
        titleAr: "الشيفرة المخملية",
        titleEn: "Velvet Cipher",
        description:
          "اختفاء لوحة شهيرة من متحف باريس الوطني يقود محققة جنائية إلى سلسلة من الرسائل المشفرة داخل مقطوعات موسيقية كلاسيكية.",
        descriptionAr:
          "اختفاء لوحة شهيرة من متحف باريس الوطني يقود محققة جنائية إلى سلسلة من الرسائل المشفرة داخل مقطوعات موسيقية كلاسيكية.",
        descriptionEn:
          "The disappearance of a priceless masterpiece in Paris leads a forensic cryptographer into a labyrinth of clues hidden inside classical symphonies.",
        posterUrl:
          "https://images.pexels.com/photos/9065151/pexels-photo-9065151.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800",
        backdropUrl:
          "https://images.pexels.com/photos/7513425/pexels-photo-7513425.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
        videoUrl: VIDEO_ASTRO,
        hlsUrl: SAMPLE_HLS_2,
        servers: buildDefaultServers(VIDEO_ASTRO, SAMPLE_HLS_2),
        downloadLinks: buildDefaultDownloads(VIDEO_ASTRO),
        year: 2025,
        duration: "2h 08m",
        genre: "mystery",
        genreAr: "غموض",
        genreEn: "Mystery",
        categorySlug: "mystery",
        country: "France",
        countryAr: "فرنسا",
        countryEn: "France",
        rating: 8.7,
        quality: "4K",
        language: "الفرنسية (مترجم)",
        originType: "foreign",
        directorAr: "لورينزو فافر",
        directorEn: "Lorenzo Favre",
        castAr: "إيفا غرين، عمر سي، فنسنت كاسل",
        castEn: "Eva Green, Omar Sy, Vincent Cassel",
        badge: "4K",
        isFeatured: false,
        isPopular: false,
        isLatest: true,
        viewsCount: 39200,
        uniqueViewsCount: 29800,
        watchTimeMinutes: 69100,
      },
      {
        slug: "valkyrie-protocol",
        title: "بروتوكول فالكيري",
        titleAr: "بروتوكول فالكيري",
        titleEn: "Valkyrie Protocol",
        description:
          "عميلة استخبارات سابقة تكتشف تفعيل نظام دفاعي آلي خارج عن السيطرة، وأمامها 12 ساعة فقط لاختراق البرج المركزي وإيقاف العد التنازلي.",
        descriptionAr:
          "عميلة استخبارات سابقة تكتشف تفعيل نظام دفاعي آلي خارج عن السيطرة، وأمامها 12 ساعة فقط لاختراق البرج المركزي وإيقاف العد التنازلي.",
        descriptionEn:
          "A rogue intelligence operative has twelve hours to breach a sky-piercing citadel and shut down an autonomous defense grid gone rogue.",
        posterUrl:
          "https://images.pexels.com/photos/8717531/pexels-photo-8717531.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800",
        backdropUrl:
          "https://images.pexels.com/photos/19665186/pexels-photo-19665186.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
        videoUrl: VIDEO_DRONE,
        hlsUrl: SAMPLE_HLS_1,
        servers: buildDefaultServers(VIDEO_DRONE, SAMPLE_HLS_1),
        downloadLinks: buildDefaultDownloads(VIDEO_DRONE),
        year: 2026,
        duration: "2h 15m",
        genre: "action",
        genreAr: "أكشن",
        genreEn: "Action",
        categorySlug: "action",
        country: "USA",
        countryAr: "الولايات المتحدة",
        countryEn: "United States",
        rating: 8.9,
        quality: "4K",
        language: "الإنجليزية (مترجم)",
        originType: "foreign",
        directorAr: "ديفيد ليتش",
        directorEn: "David Leitch",
        castAr: "تشارليز ثيرون، كيانو ريفز، هيرويوكي سانادا",
        castEn: "Charlize Theron, Keanu Reeves, Hiroyuki Sanada",
        badge: "NEW",
        isFeatured: false,
        isPopular: true,
        isLatest: true,
        viewsCount: 68500,
        uniqueViewsCount: 51900,
        watchTimeMinutes: 128000,
      },
      {
        slug: "shadow-frequency",
        title: "تردد الظلال",
        titleAr: "تردد الظلال",
        titleEn: "Shadow Frequency",
        description:
          "مهندس صوتيات يكتشف تردداً خفياً في تسجيلات قديمة يفتح بوابة لأطياف من عالم آخر داخل استوديو مهجور.",
        descriptionAr:
          "مهندس صوتيات يكتشف تردداً خفياً في تسجيلات قديمة يفتح بوابة لأطياف من عالم آخر داخل استوديو مهجور.",
        descriptionEn:
          "An audio restoration engineer uncovers a sub-audible frequency on vintage reels that summons entities inside a locked soundstage.",
        posterUrl:
          "https://images.pexels.com/photos/14274429/pexels-photo-14274429.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800",
        backdropUrl:
          "https://images.pexels.com/photos/36439651/pexels-photo-36439651.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
        videoUrl: VIDEO_CITY,
        hlsUrl: SAMPLE_HLS_2,
        servers: buildDefaultServers(VIDEO_CITY, SAMPLE_HLS_2),
        downloadLinks: buildDefaultDownloads(VIDEO_CITY),
        year: 2025,
        duration: "1h 54m",
        genre: "horror",
        genreAr: "رعب",
        genreEn: "Horror",
        categorySlug: "horror",
        country: "Canada",
        countryAr: "كندا",
        countryEn: "Canada",
        rating: 8.3,
        quality: "HD",
        language: "الإنجليزية (مترجم)",
        originType: "foreign",
        directorAr: "ماركوس بيل",
        directorEn: "Marcus Bell",
        castAr: "إيثان هوك، فيرا فارميغا",
        castEn: "Ethan Hawke, Vera Farmiga",
        badge: "HD",
        isFeatured: false,
        isPopular: false,
        isLatest: false,
        viewsCount: 31800,
        uniqueViewsCount: 24100,
        watchTimeMinutes: 54200,
      },
      {
        slug: "symphony-of-rain",
        title: "سمفونية المطر الأخير",
        titleAr: "سمفونية المطر الأخير",
        titleEn: "Symphony of Rain",
        description:
          "قصة إنسانية مؤثرة عن مؤلف موسيقي يفقد سمعه تدريجياً ويحاول إكمال أعظم مقطوعاته بمساعدة ابنته الشابة قبل حفل الأوركسترا الملكي.",
        descriptionAr:
          "قصة إنسانية مؤثرة عن مؤلف موسيقي يفقد سمعه تدريجياً ويحاول إكمال أعظم مقطوعاته بمساعدة ابنته الشابة قبل حفل الأوركسترا الملكي.",
        descriptionEn:
          "A deeply moving drama following a renowned composer racing against progressive hearing loss to finish his magnum opus alongside his daughter.",
        posterUrl:
          "https://images.pexels.com/photos/10040315/pexels-photo-10040315.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800",
        backdropUrl:
          "https://images.pexels.com/photos/30057593/pexels-photo-30057593.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
        videoUrl: VIDEO_ASTRO,
        hlsUrl: SAMPLE_HLS_1,
        servers: buildDefaultServers(VIDEO_ASTRO, SAMPLE_HLS_1),
        downloadLinks: buildDefaultDownloads(VIDEO_ASTRO),
        year: 2025,
        duration: "2h 16m",
        genre: "drama",
        genreAr: "دراما",
        genreEn: "Drama",
        categorySlug: "drama",
        country: "Lebanon / France",
        countryAr: "لبنان / فرنسا",
        countryEn: "Lebanon / France",
        rating: 9.2,
        quality: "4K",
        language: "العربية / الفرنسية",
        originType: "arabic",
        directorAr: "زياد دويري",
        directorEn: "Ziad Doueiri",
        castAr: "عادل كرم، كاميل كوتان، ريتا حايك",
        castEn: "Adel Karam, Camille Cottin, Rita Hayek",
        badge: "4K",
        isFeatured: false,
        isPopular: true,
        isLatest: true,
        viewsCount: 59100,
        uniqueViewsCount: 46300,
        watchTimeMinutes: 118500,
      },
    ])
    .returning();

  // Seed 8 Rich Series with 6 Servers & Download Links
  const insertedSeries = await db
    .insert(series)
    .values([
      {
        slug: "crown-of-andalus",
        title: "تاج الأندلس",
        titleAr: "تاج الأندلس",
        titleEn: "Crown of Andalus",
        description:
          "ملحمة تاريخية فاخرة تروي صراعات القصور والتحالفات السرية في قرطبة الذهبية، حيث تتقاطع طموحات الأمراء مع دسائس الحراس الملكيين.",
        descriptionAr:
          "ملحمة تاريخية فاخرة تروي صراعات القصور والتحالفات السرية في قرطبة الذهبية، حيث تتقاطع طموحات الأمراء مع دسائس الحراس الملكيين.",
        descriptionEn:
          "A sweeping historical epic chronicling palace intrigue, secret alliances, and chivalric honor inside the golden courts of Cordoba.",
        posterUrl: "/images/poster-crown-of-andalus.jpg",
        backdropUrl: "/images/backdrop-royal-palace.jpg",
        videoUrl: VIDEO_LOBBY,
        hlsUrl: SAMPLE_HLS_1,
        servers: buildDefaultServers(VIDEO_LOBBY, SAMPLE_HLS_1),
        downloadLinks: buildDefaultDownloads(VIDEO_LOBBY),
        year: 2026,
        seasonsCount: 3,
        episodesCount: 24,
        genre: "drama",
        genreAr: "دراما تاريخية",
        genreEn: "Historical Drama",
        categorySlug: "series",
        country: "Syria / UAE",
        countryAr: "سوريا / الإمارات",
        countryEn: "Syria / UAE",
        rating: 9.5,
        quality: "4K",
        language: "العربية الفصحى",
        originType: "arabic",
        directorAr: "حاتم علي / الليث حجو",
        directorEn: "Al-Laith Hajjo",
        castAr: "تيم حسن، سلافة معمار، باسل خياط، منى واصف",
        castEn: "Taim Hasan, Sulafa Memar, Bassel Khaiat, Mouna Wassef",
        badge: "SERIES",
        isFeatured: true,
        isPopular: true,
        isLatest: true,
        viewsCount: 142000,
        uniqueViewsCount: 108400,
        watchTimeMinutes: 312000,
      },
      {
        slug: "red-dune-syndicate",
        title: "عهد الرمال الحمراء",
        titleAr: "عهد الرمال الحمراء",
        titleEn: "Red Dune Syndicate",
        description:
          "مسلسل تشويق وجريمة يدور حول صراع عائلتين من كبار تجار الألماس والشحن البحري، وكيف يقلب محقق خاص الطاولة على الجميع.",
        descriptionAr:
          "مسلسل تشويق وجريمة يدور حول صراع عائلتين من كبار تجار الألماس والشحن البحري، وكيف يقلب محقق خاص الطاولة على الجميع.",
        descriptionEn:
          "A high-stakes crime thriller centered on two rival maritime dynasties and the relentless investigator dismantling their empire from within.",
        posterUrl:
          "https://images.pexels.com/photos/18486319/pexels-photo-18486319.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800",
        backdropUrl: "/images/backdrop-neon-heist.jpg",
        videoUrl: VIDEO_CITY,
        hlsUrl: SAMPLE_HLS_2,
        servers: buildDefaultServers(VIDEO_CITY, SAMPLE_HLS_2),
        downloadLinks: buildDefaultDownloads(VIDEO_CITY),
        year: 2026,
        seasonsCount: 3,
        episodesCount: 18,
        genre: "crime",
        genreAr: "جريمة وتشويق",
        genreEn: "Crime Thriller",
        categorySlug: "series",
        country: "KSA / Lebanon",
        countryAr: "السعودية / لبنان",
        countryEn: "KSA / Lebanon",
        rating: 9.2,
        quality: "4K",
        language: "العربية",
        originType: "arabic",
        directorAr: "سامر البرقاوي",
        directorEn: "Samer Al-Barqawi",
        castAr: "قصي خولي، دانييلا رحمة، عبدالمحسن النمر",
        castEn: "Kosai Khauli, Daniella Rahme, Abdulmohsen Al-Nimr",
        badge: "SERIES",
        isFeatured: false,
        isPopular: true,
        isLatest: true,
        viewsCount: 115400,
        uniqueViewsCount: 89200,
        watchTimeMinutes: 248000,
      },
      {
        slug: "cyber-caliphate-2099",
        title: "مدار النيون 2099",
        titleAr: "مدار النيون 2099",
        titleEn: "Neon Orbit 2099",
        description:
          "في عام 2099، تتحول المحطات المدارية إلى مدن ذكية تحكمها خوارزميات متصارعة، ويقود فريق من القراصنة ثورة لاستعادة الوعي البشري.",
        descriptionAr:
          "في عام 2099، تتحول المحطات المدارية إلى مدن ذكية تحكمها خوارزميات متصارعة، ويقود فريق من القراصنة ثورة لاستعادة الوعي البشري.",
        descriptionEn:
          "In 2099, orbital megacities are governed by rival AI syndicates until a cell of neural hackers sparks a rebellion for human consciousness.",
        posterUrl:
          "https://images.pexels.com/photos/8108557/pexels-photo-8108557.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800",
        backdropUrl: "/images/backdrop-desert-empire.jpg",
        videoUrl: VIDEO_SPACE,
        hlsUrl: SAMPLE_HLS_1,
        servers: buildDefaultServers(VIDEO_SPACE, SAMPLE_HLS_1),
        downloadLinks: buildDefaultDownloads(VIDEO_SPACE),
        year: 2025,
        seasonsCount: 3,
        episodesCount: 20,
        genre: "scifi",
        genreAr: "خيال علمي",
        genreEn: "Sci-Fi",
        categorySlug: "scifi",
        country: "USA / Japan",
        countryAr: "أمريكا / اليابان",
        countryEn: "USA / Japan",
        rating: 9.3,
        quality: "4K",
        language: "الإنجليزية (مترجم)",
        originType: "foreign",
        directorAr: "أليكس غارلاند",
        directorEn: "Alex Garland",
        castAr: "سونغ كانغ، زيندايا، هيرويوكي سانادا",
        castEn: "Sung Kang, Zendaya, Hiroyuki Sanada",
        badge: "4K",
        isFeatured: false,
        isPopular: true,
        isLatest: true,
        viewsCount: 104200,
        uniqueViewsCount: 79400,
        watchTimeMinutes: 219000,
      },
      {
        slug: "shadow-division",
        title: "الفرقة السابعة: الظل",
        titleAr: "الفرقة السابعة: الظل",
        titleEn: "Shadow Division VII",
        description:
          "وحدة عمليات خاصة سرية تعمل عبر القارات لإحباط التهديدات التكنولوجية الكبرى قبل وصولها إلى وسائل الإعلام.",
        descriptionAr:
          "وحدة عمليات خاصة سرية تعمل عبر القارات لإحباط التهديدات التكنولوجية الكبرى قبل وصولها إلى وسائل الإعلام.",
        descriptionEn:
          "A covert multinational task force operates across continents to neutralize high-level technological threats before they reach the public eye.",
        posterUrl:
          "https://images.pexels.com/photos/28302225/pexels-photo-28302225.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800",
        backdropUrl:
          "https://images.pexels.com/photos/23384428/pexels-photo-23384428.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
        videoUrl: VIDEO_DRONE,
        hlsUrl: SAMPLE_HLS_2,
        servers: buildDefaultServers(VIDEO_DRONE, SAMPLE_HLS_2),
        downloadLinks: buildDefaultDownloads(VIDEO_DRONE),
        year: 2025,
        seasonsCount: 3,
        episodesCount: 24,
        genre: "action",
        genreAr: "أكشن",
        genreEn: "Action",
        categorySlug: "action",
        country: "UK / USA",
        countryAr: "بريطانيا / أمريكا",
        countryEn: "UK / USA",
        rating: 8.9,
        quality: "4K",
        language: "الإنجليزية (مترجم)",
        originType: "foreign",
        directorAr: "غاي ريتشي",
        directorEn: "Guy Ritchie",
        castAr: "ريتشرد مادن، توم هاردي، إميلي بلانت",
        castEn: "Richard Madden, Tom Hardy, Emily Blunt",
        badge: "SERIES",
        isFeatured: false,
        isPopular: true,
        isLatest: false,
        viewsCount: 88700,
        uniqueViewsCount: 66200,
        watchTimeMinutes: 174000,
      },
      {
        slug: "palace-of-mirrors",
        title: "قصر المرايا",
        titleAr: "قصر المرايا",
        titleEn: "Palace of Mirrors",
        description:
          "دراما اجتماعية عربية مشوقة تكشف أسرار عائلة أرستقراطية عريقة بعد قراءة وصية غامضة تغير موازين القوى بين الإخوة.",
        descriptionAr:
          "دراما اجتماعية عربية مشوقة تكشف أسرار عائلة أرستقراطية عريقة بعد قراءة وصية غامضة تغير موازين القوى بين الإخوة.",
        descriptionEn:
          "An engrossing Arabic family drama unraveling the guarded secrets of an aristocratic dynasty after a cryptic testament shifts power among siblings.",
        posterUrl: "/images/poster-oasis-nights.jpg",
        backdropUrl: "/images/backdrop-royal-palace.jpg",
        videoUrl: VIDEO_LOBBY,
        hlsUrl: SAMPLE_HLS_1,
        servers: buildDefaultServers(VIDEO_LOBBY, SAMPLE_HLS_1),
        downloadLinks: buildDefaultDownloads(VIDEO_LOBBY),
        year: 2026,
        seasonsCount: 2,
        episodesCount: 15,
        genre: "drama",
        genreAr: "دراما",
        genreEn: "Drama",
        categorySlug: "arabic",
        country: "Egypt / Lebanon",
        countryAr: "مصر / لبنان",
        countryEn: "Egypt / Lebanon",
        rating: 9.0,
        quality: "4K",
        language: "العربية",
        originType: "arabic",
        directorAr: "كاملة أبو ذكري",
        directorEn: "Kamla Abou Zekri",
        castAr: "نيللي كريم، عابد فهد، نادين نسيب نجيم",
        castEn: "Nelly Karim, Abed Fahed, Nadine Nassib Njeim",
        badge: "NEW",
        isFeatured: false,
        isPopular: true,
        isLatest: true,
        viewsCount: 91200,
        uniqueViewsCount: 70500,
        watchTimeMinutes: 186000,
      },
      {
        slug: "northern-detective",
        title: "محقق الشمال البارد",
        titleAr: "محقق الشمال البارد",
        titleEn: "Nordic Silence",
        description:
          "في بلدة ساحلية يغطيها الجليد، يفتح محقق جنائي ملف قضية قديمة تعود إلى عشرين عاماً بعد العثور على دليل جديد تحت الجليد.",
        descriptionAr:
          "في بلدة ساحلية يغطيها الجليد، يفتح محقق جنائي ملف قضية قديمة تعود إلى عشرين عاماً بعد العثور على دليل جديد تحت الجليد.",
        descriptionEn:
          "In a frostbitten coastal fjord, a forensic detective reopens a twenty-year-old cold case when thawing ice reveals a chilling new clue.",
        posterUrl: "/images/poster-crimson-whisper.jpg",
        backdropUrl:
          "https://images.pexels.com/photos/37911516/pexels-photo-37911516.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
        videoUrl: VIDEO_CITY,
        hlsUrl: SAMPLE_HLS_2,
        servers: buildDefaultServers(VIDEO_CITY, SAMPLE_HLS_2),
        downloadLinks: buildDefaultDownloads(VIDEO_CITY),
        year: 2025,
        seasonsCount: 3,
        episodesCount: 18,
        genre: "crime",
        genreAr: "جريمة",
        genreEn: "Crime",
        categorySlug: "foreign",
        country: "Norway / UK",
        countryAr: "النرويج / بريطانيا",
        countryEn: "Norway / UK",
        rating: 8.8,
        quality: "4K",
        language: "الإنجليزية (مترجم)",
        originType: "foreign",
        directorAr: "توماس فينتربرغ",
        directorEn: "Thomas Vinterberg",
        castAr: "مادس ميكلسن، صوفي غرابول",
        castEn: "Mads Mikkelsen, Sofie Gråbøl",
        badge: "4K",
        isFeatured: false,
        isPopular: false,
        isLatest: true,
        viewsCount: 64300,
        uniqueViewsCount: 48900,
        watchTimeMinutes: 132000,
      },
      {
        slug: "quantum-echoes",
        title: "أصداء الكوانتم",
        titleAr: "أصداء الكوانتم",
        titleEn: "Quantum Echoes",
        description:
          "عالمة فيزياء تكتشف طريقة لإرسال رسائل قصيرة مدتها 60 ثانية إلى الماضي، لكن كل رسالة تغير حاضرها بطريقة غير متوقعة.",
        descriptionAr:
          "عالمة فيزياء تكتشف طريقة لإرسال رسائل قصيرة مدتها 60 ثانية إلى الماضي، لكن كل رسالة تغير حاضرها بطريقة غير متوقعة.",
        descriptionEn:
          "A quantum physicist discovers how to transmit 60-second audio messages into the past, with each transmission reshaping her present reality.",
        posterUrl: "/images/poster-abyssal-horizon.jpg",
        backdropUrl: "/images/hero-cinema-gold.jpg",
        videoUrl: VIDEO_ASTRO,
        hlsUrl: SAMPLE_HLS_1,
        servers: buildDefaultServers(VIDEO_ASTRO, SAMPLE_HLS_1),
        downloadLinks: buildDefaultDownloads(VIDEO_ASTRO),
        year: 2026,
        seasonsCount: 2,
        episodesCount: 12,
        genre: "scifi",
        genreAr: "خيال علمي",
        genreEn: "Sci-Fi",
        categorySlug: "scifi",
        country: "USA / Germany",
        countryAr: "أمريكا / ألمانيا",
        countryEn: "USA / Germany",
        rating: 9.1,
        quality: "4K",
        language: "الإنجليزية (مترجم)",
        originType: "foreign",
        directorAr: "باران بو أودار",
        directorEn: "Baran bo Odar",
        castAr: "لويس هوفمان، ليزا فيكاري",
        castEn: "Louis Hofmann, Lisa Vicari",
        badge: "SERIES",
        isFeatured: false,
        isPopular: true,
        isLatest: true,
        viewsCount: 83400,
        uniqueViewsCount: 62100,
        watchTimeMinutes: 169000,
      },
      {
        slug: "knights-of-the-desert",
        title: "فرسان البادية",
        titleAr: "فرسان البادية",
        titleEn: "Knights of the Desert",
        description:
          "ملحمة عربية أصيلة تصور الشجاعة والفروسية وحماية القوافل التجارية عبر طرق الصحراء القديمة.",
        descriptionAr:
          "ملحمة عربية أصيلة تصور الشجاعة والفروسية وحماية القوافل التجارية عبر طرق الصحراء القديمة.",
        descriptionEn:
          "An authentic Arabian epic celebrating chivalry, poetry, and the guardians of ancient silk-and-incense caravan routes.",
        posterUrl: "/images/poster-sands-of-eternity.jpg",
        backdropUrl: "/images/backdrop-desert-empire.jpg",
        videoUrl: VIDEO_SPACE,
        hlsUrl: SAMPLE_HLS_1,
        servers: buildDefaultServers(VIDEO_SPACE, SAMPLE_HLS_1),
        downloadLinks: buildDefaultDownloads(VIDEO_SPACE),
        year: 2025,
        seasonsCount: 3,
        episodesCount: 30,
        genre: "action",
        genreAr: "أكشن تاريخي",
        genreEn: "Action Epic",
        categorySlug: "arabic",
        country: "Jordan / KSA",
        countryAr: "الأردن / السعودية",
        countryEn: "Jordan / KSA",
        rating: 8.9,
        quality: "4K",
        language: "العربية",
        originType: "arabic",
        directorAr: "سائد الهواري",
        directorEn: "Saed Al-Hawari",
        castAr: "منذر رياحنة، صبا مبارك، ياسر المصري",
        castEn: "Monzer Rayahneh, Saba Mubarak, Yasser Al-Masri",
        badge: "SERIES",
        isFeatured: false,
        isPopular: true,
        isLatest: false,
        viewsCount: 77500,
        uniqueViewsCount: 59300,
        watchTimeMinutes: 158000,
      },
    ])
    .returning();

  // Seed Seasons (Season 1, 2, 3) and Episodes (Episode 1, 2, 3, 4) for every Series
  const epThumbnails = [
    "/images/backdrop-royal-palace.jpg",
    "/images/backdrop-desert-empire.jpg",
    "/images/backdrop-neon-heist.jpg",
    "/images/hero-cinema-gold.jpg",
  ];
  const epVideos = [VIDEO_LOBBY, VIDEO_SPACE, VIDEO_DRONE, VIDEO_CITY];

  for (const s of insertedSeries) {
    for (let sNum = 1; sNum <= 3; sNum++) {
      const [insertedSeason] = await db
        .insert(seasons)
        .values({
          seriesId: s.id,
          seasonNumber: sNum,
          titleAr: `الموسم ${sNum}`,
          titleEn: `Season ${sNum}`,
          year: s.year - (3 - sNum),
          posterUrl: s.posterUrl,
        })
        .returning();

      const epValues = [1, 2, 3, 4].map((epNum) => {
        const vUrl = epVideos[(epNum - 1) % epVideos.length];
        const hUrl = epNum % 2 === 0 ? SAMPLE_HLS_2 : SAMPLE_HLS_1;
        return {
          seriesId: s.id,
          seasonId: insertedSeason.id,
          seasonNumber: sNum,
          episodeNumber: epNum,
          titleAr: `الحلقة ${epNum}: ${
            epNum === 1
              ? "بداية العهد"
              : epNum === 2
              ? "ليلة الأسرار"
              : epNum === 3
              ? "المواجهة الكبرى"
              : "ما وراء الأفق"
          }`,
          titleEn: `Episode ${epNum}: ${
            epNum === 1
              ? "The Awakening"
              : epNum === 2
              ? "Night of Secrets"
              : epNum === 3
              ? "The Reckoning"
              : "Beyond the Horizon"
          }`,
          descriptionAr: `أحداث مشوقة في الحلقة ${epNum} من الموسم ${sNum} لمسلسل ${s.titleAr} حيث تتصاعد وتيرة المواجهة وتنكشف الخبايا.`,
          descriptionEn: `Gripping events unfold in Season ${sNum}, Episode ${epNum} of ${s.titleEn} as alliances are tested and hidden truths surface.`,
          duration: `${44 + epNum * 3}m`,
          thumbnailUrl: epThumbnails[(epNum - 1) % epThumbnails.length],
          videoUrl: vUrl,
          hlsUrl: hUrl,
          servers: buildDefaultServers(vUrl, hUrl),
          downloadLinks: buildDefaultDownloads(vUrl),
          viewsCount: 12000 - epNum * 800,
        };
      });

      await db.insert(episodes).values(epValues);
    }
  }

  // Seed Subtitles for Movies
  for (const m of insertedMovies) {
    await db.insert(subtitles).values([
      {
        mediaType: "movie",
        mediaId: m.id,
        langCode: "ar",
        labelAr: "العربية (الأصلية)",
        labelEn: "Arabic",
        vttUrl: "/api/subtitles?lang=ar",
      },
      {
        mediaType: "movie",
        mediaId: m.id,
        langCode: "en",
        labelAr: "الإنجليزية (English)",
        labelEn: "English",
        vttUrl: "/api/subtitles?lang=en",
      },
    ]);
  }

  // Seed Search Analytics (including exact prompt examples + Arabic/English terms)
  await db.insert(searchAnalytics).values([
    {
      query: "Batman",
      normalizedQuery: "batman",
      categoryHint: "movies",
      searchCount: 2540,
    },
    {
      query: "Action",
      normalizedQuery: "action",
      categoryHint: "action",
      searchCount: 1820,
    },
    {
      query: "Breaking Bad",
      normalizedQuery: "breaking bad",
      categoryHint: "series",
      searchCount: 1400,
    },
    {
      query: "رمال الخلود",
      normalizedQuery: "رمال الخلود",
      categoryHint: "scifi",
      searchCount: 1290,
    },
    {
      query: "تاج الأندلس",
      normalizedQuery: "تاج الأندلس",
      categoryHint: "series",
      searchCount: 1120,
    },
    {
      query: "4K Arabic Movies",
      normalizedQuery: "4k arabic movies",
      categoryHint: "arabic",
      searchCount: 890,
    },
    {
      query: "Sci-Fi 2026",
      normalizedQuery: "sci-fi 2026",
      categoryHint: "scifi",
      searchCount: 740,
    },
  ]);

  // Seed Movie / Series Requests
  await db.insert(movieRequests).values([
    {
      title: "Dune: Messiah IMAX Edition",
      normalizedTitle: "dune: messiah imax edition",
      year: 2026,
      mediaType: "movie",
      referenceUrl: "https://imdb.com/title/tt15239678",
      message: "نرجو توفير النسخة الكاملة بدقة 4K مع الترجمة العربية الاحترافية",
      requesterName: "خالد العتيبي",
      requesterEmail: "khaled@example.com",
      requestCount: 47,
      status: "Searching",
    },
    {
      title: "الحشاشين - الموسم الخاص",
      normalizedTitle: "الحشاشين - الموسم الخاص",
      year: 2025,
      mediaType: "series",
      referenceUrl: "",
      message: "أتمنى إضافة جميع الحلقات على سيرفر ناز الرئيسي",
      requesterName: "ريم الشمري",
      requesterEmail: "reem@example.com",
      requestCount: 34,
      status: "Pending",
    },
    {
      title: "The Batman Part II",
      normalizedTitle: "the batman part ii",
      year: 2026,
      mediaType: "movie",
      referenceUrl: "",
      message: "Please add 4K HDR stream and 1080p download link when released.",
      requesterName: "Omar Al-Farsi",
      requesterEmail: "omar@example.com",
      requestCount: 29,
      status: "Pending",
    },
    {
      title: "رمال الخلود (نسخة المخرج)",
      normalizedTitle: "رمال الخلود (نسخة المخرج)",
      year: 2026,
      mediaType: "movie",
      referenceUrl: "",
      message: "تم توفيره بجودة ممتازة شكراً لكم",
      requesterName: "نواف المنصور",
      requesterEmail: "vip@nazmovies.com",
      requestCount: 19,
      status: "Added",
    },
  ]);

  // Seed Premium Upgrade Requests
  await db.insert(premiumRequests).values([
    {
      userId: 3,
      name: "سارة الهاشمي",
      email: "sara@nazmovies.com",
      username: "sara_cinema",
      currentPlan: "Free",
      requestedPlan: "Premium Ad-Free (Annual)",
      message: "أرغب في الترقية إلى الباقة الخالية من الإعلانات وتفعيل شارة الحساب المميز.",
      status: "Pending",
    },
    {
      userId: 2,
      name: "نواف المنصور",
      email: "vip@nazmovies.com",
      username: "nawaf_vip",
      currentPlan: "Free",
      requestedPlan: "Premium Ad-Free (VIP)",
      message: "يرجى تفعيل اشتراك البريميوم بدون إعلانات لحسابي.",
      status: "Approved",
    },
  ]);

  isSeeded = true;
}
