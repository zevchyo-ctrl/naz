import {
  VideoServerItem,
  DownloadLinkItem,
  PlatformSettingsData,
} from "@/db/schema";
import { DEFAULT_THEME, EMPTY_SECTIONS, DEFAULT_SITE_NAME, DEFAULT_TELEGRAM_URL } from "@/lib/theme";

export const SAMPLE_HLS_1 = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";
export const SAMPLE_HLS_2 =
  "https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8";

export const VIDEO_SPACE =
  "https://videos.pexels.com/video-files/36136184/15324554_3840_2160_24fps.mp4";
export const VIDEO_CITY =
  "https://videos.pexels.com/video-files/30078588/12900812_3840_2160_25fps.mp4";
export const VIDEO_DRONE =
  "https://videos.pexels.com/video-files/34579322/14652595_3840_2160_30fps.mp4";
export const VIDEO_LOBBY =
  "https://videos.pexels.com/video-files/31801785/13548474_3840_2160_25fps.mp4";
export const VIDEO_ASTRO =
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
      url: primaryMp4 || VIDEO_SPACE,
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
  const safeUrl = videoUrl || VIDEO_SPACE;
  return [
    {
      id: "dl-4k",
      quality: "4K",
      size: "4.8 GB",
      url: `${safeUrl}?download=4k`,
      format: "MP4 • HEVC 10-bit",
      isEnabled: true,
    },
    {
      id: "dl-1080p",
      quality: "1080p",
      size: "2.1 GB",
      url: `${safeUrl}?download=1080p`,
      format: "MP4 • Full HD",
      isEnabled: true,
    },
    {
      id: "dl-720p",
      quality: "720p",
      size: "950 MB",
      url: `${safeUrl}?download=720p`,
      format: "MP4 • HD Ready",
      isEnabled: true,
    },
  ];
}

export const EMPTY_AD_SLOT = { enabled: false, code: "" };

export const DEFAULT_AD_CONFIG = {
  popup: { ...EMPTY_AD_SLOT },
  bannerHeader: { ...EMPTY_AD_SLOT },
  bannerPlayer: { ...EMPTY_AD_SLOT },
  bannerFooter: { ...EMPTY_AD_SLOT },
  headerScripts: { ...EMPTY_AD_SLOT },
};

export const DEFAULT_PREMIUM_SETTINGS = {
  price: "$5 / Month",
  telegramUsername: "@nazmovies_admin",
  paymentInstructions: `طرق الدفع المتاحة:

• فودافون كاش: 01000000000
• PayPal: payments@nazmovies.com
• USDT (TRC20): TXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
• تحويل بنكي: NAZMOVIES — IBAN: SA0000000000000000000000

بعد إتمام التحويل، أرسل تأكيد العملية عبر تليجرام وسيتم تفعيل اشتراكك خلال 24 ساعة.`,
};

export const DEFAULT_BRANDING = {
  siteName: DEFAULT_SITE_NAME,
  logoUrl: "",
  telegramContactUrl: DEFAULT_TELEGRAM_URL,
  themePreset: "default",
  theme: DEFAULT_THEME,
  sections: EMPTY_SECTIONS,
};

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
