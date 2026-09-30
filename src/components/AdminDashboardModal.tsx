"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  Film,
  Tv,
  Plus,
  Trash2,
  Edit3,
  BarChart3,
  Search,
  MessageSquarePlus,
  Crown,
  Settings,
  FileText,
  Server,
  Download,
  CheckCircle2,
  Clock,
  Eye,
  Users,
  Sparkles,
  Save,
  Layers,
  Megaphone,
  UsersRound,
} from "lucide-react";
import { Language, translations } from "@/lib/translations";
import {
  MovieRecord,
  SeriesRecord,
  VideoServerItem,
  DownloadLinkItem,
  PlatformSettingsData,
  MovieRequestRecord,
  PremiumRequestRecord,
} from "@/db/schema";
import { buildDefaultServers, buildDefaultDownloads } from "@/lib/defaults";
import { adminFetch } from "@/lib/clientAuth";
import { CustomizationPanel, SaveResult } from "@/components/AdminExtraPanels";
import VisitorStatsPanel from "@/components/VisitorStatsPanel";
import AdManagementPanel from "@/components/AdManagementPanel";
import UsersPanel from "@/components/UsersPanel";
import PremiumSettingsPanel from "@/components/PremiumSettingsPanel";

interface AdminDashboardModalProps {
  lang: Language;
  moviesList: MovieRecord[];
  seriesList: SeriesRecord[];
  settings: PlatformSettingsData;
  onClose: () => void;
  onLogout: () => void;
  onRefreshData: () => Promise<void>;
  onUpdateSettings: (newSettings: Record<string, unknown>) => Promise<SaveResult>;
  showToast: (msg: string) => void;
}

type AdminTab =
  | "analytics"
  | "ads"
  | "users"
  | "viewing"
  | "customization"
  | "content"
  | "view_stats"
  | "search_stats"
  | "movie_requests"
  | "premium_requests"
  | "settings"
  | "legal_pages";

export default function AdminDashboardModal({
  lang,
  moviesList,
  seriesList,
  settings,
  onClose,
  onLogout,
  onRefreshData,
  onUpdateSettings,
  showToast,
}: AdminDashboardModalProps) {
  const t = translations[lang];
  const [activeTab, setActiveTab] = useState<AdminTab>("analytics");
  const [dateRange, setDateRange] = useState<string>("all");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Content form state (Add / Edit Movie or Series)
  const [contentMode, setContentMode] = useState<
    "movie" | "series" | "episode"
  >("movie");
  const [editingMovieId, setEditingMovieId] = useState<number | null>(null);
  const [titleAr, setTitleAr] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [descriptionAr, setDescriptionAr] = useState("");
  const [descriptionEn, setDescriptionEn] = useState("");
  const [posterUrl, setPosterUrl] = useState(
    "/images/poster-sands-of-eternity.jpg"
  );
  const [backdropUrl, setBackdropUrl] = useState(
    "/images/backdrop-desert-empire.jpg"
  );
  const [videoUrl, setVideoUrl] = useState(
    "https://videos.pexels.com/video-files/36136184/15324554_3840_2160_24fps.mp4"
  );
  const [hlsUrl, setHlsUrl] = useState(
    "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
  );
  const [year, setYear] = useState(2026);
  const [duration, setDuration] = useState("2h 20m");
  const [genre, setGenre] = useState("action");
  const [country, setCountry] = useState("USA / UAE");
  const [rating, setRating] = useState(9.0);
  const [quality, setQuality] = useState("4K");
  const [languageField, setLanguageField] = useState("العربية / الإنجليزية");
  const [originType, setOriginType] = useState<"arabic" | "foreign">("foreign");
  const [isFeatured, setIsFeatured] = useState(false);
  const [isPopular, setIsPopular] = useState(true);
  const [isLatest, setIsLatest] = useState(true);

  // Episode specific state
  const [targetSeriesId, setTargetSeriesId] = useState<number>(
    seriesList[0]?.id || 1
  );
  const [seasonNumber, setSeasonNumber] = useState<number>(1);
  const [episodeNumber, setEpisodeNumber] = useState<number>(5);

  // 6 Video Servers State
  const [servers, setServers] = useState<VideoServerItem[]>(() =>
    buildDefaultServers(
      "https://videos.pexels.com/video-files/36136184/15324554_3840_2160_24fps.mp4",
      "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
    )
  );

  // 3 Download Qualities State
  const [downloadLinks, setDownloadLinks] = useState<DownloadLinkItem[]>(() =>
    buildDefaultDownloads(
      "https://videos.pexels.com/video-files/36136184/15324554_3840_2160_24fps.mp4"
    )
  );

  // Editable Legal Pages State
  const [aboutAr, setAboutAr] = useState(settings.aboutUsAr);
  const [aboutEn, setAboutEn] = useState(settings.aboutUsEn);
  const [privacyAr, setPrivacyAr] = useState(settings.privacyPolicyAr);
  const [privacyEn, setPrivacyEn] = useState(settings.privacyPolicyEn);
  const [termsAr, setTermsAr] = useState(settings.termsOfServiceAr);
  const [termsEn, setTermsEn] = useState(settings.termsOfServiceEn);

  const fetchAnalytics = async (range = dateRange) => {
    setLoadingAnalytics(true);
    try {
      const res = await adminFetch(`/api/analytics?range=${range}`);
      const data = await res.json();
      setAnalyticsData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(dateRange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  const handleLoadMovieForEdit = (m: MovieRecord) => {
    setContentMode("movie");
    setEditingMovieId(m.id);
    setTitleAr(m.titleAr);
    setTitleEn(m.titleEn);
    setDescriptionAr(m.descriptionAr);
    setDescriptionEn(m.descriptionEn);
    setPosterUrl(m.posterUrl);
    setBackdropUrl(m.backdropUrl);
    setVideoUrl(m.videoUrl);
    setHlsUrl(m.hlsUrl);
    setYear(m.year);
    setDuration(m.duration);
    setGenre(m.genre);
    setCountry(m.country);
    setRating(m.rating);
    setQuality(m.quality);
    setLanguageField(m.language);
    setOriginType((m.originType as "arabic" | "foreign") || "foreign");
    setIsFeatured(m.isFeatured);
    setIsPopular(m.isPopular);
    setIsLatest(m.isLatest);
    setServers(
      Array.isArray(m.servers) && m.servers.length > 0
        ? m.servers
        : buildDefaultServers(m.videoUrl, m.hlsUrl)
    );
    setDownloadLinks(
      Array.isArray(m.downloadLinks) && m.downloadLinks.length > 0
        ? m.downloadLinks
        : buildDefaultDownloads(m.videoUrl)
    );
    setActiveTab("content");
  };

  const resetContentForm = () => {
    setEditingMovieId(null);
    setTitleAr("");
    setTitleEn("");
    setDescriptionAr("");
    setDescriptionEn("");
    setPosterUrl("/images/poster-sands-of-eternity.jpg");
    setBackdropUrl("/images/backdrop-desert-empire.jpg");
    const defaultV =
      "https://videos.pexels.com/video-files/36136184/15324554_3840_2160_24fps.mp4";
    const defaultH = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";
    setVideoUrl(defaultV);
    setHlsUrl(defaultH);
    setServers(buildDefaultServers(defaultV, defaultH));
    setDownloadLinks(buildDefaultDownloads(defaultV));
  };

  const handleSaveContent = async (e: React.FormEvent) => {
    e.preventDefault();

    if (contentMode === "episode") {
      const res = await adminFetch("/api/series", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_episode",
          seriesId: targetSeriesId,
          seasonNumber,
          episodeNumber,
          titleAr: titleAr || `الحلقة ${episodeNumber}`,
          titleEn: titleEn || `Episode ${episodeNumber}`,
          descriptionAr,
          descriptionEn,
          duration,
          thumbnailUrl: backdropUrl,
          videoUrl,
          hlsUrl,
          servers,
          downloadLinks,
        }),
      });
      if (res.ok) {
        await onRefreshData();
        showToast(
          lang === "ar"
            ? "✅ تم إضافة الحلقة مع 6 سيرفرات وروابط التحميل بنجاح!"
            : "✅ Episode added with 6 video servers & downloads!"
        );
        resetContentForm();
      }
      return;
    }

    if (contentMode === "series") {
      const res = await adminFetch("/api/series", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: titleAr || titleEn,
          titleAr: titleAr || titleEn,
          titleEn: titleEn || titleAr,
          descriptionAr,
          descriptionEn,
          posterUrl,
          backdropUrl,
          videoUrl,
          hlsUrl,
          servers,
          downloadLinks,
          year,
          genre,
          country,
          rating,
          quality,
          language: languageField,
          originType,
          isFeatured,
          isPopular,
          isLatest,
        }),
      });
      if (res.ok) {
        await onRefreshData();
        showToast(
          lang === "ar"
            ? "✅ تم إضافة المسلسل الجديد بنجاح!"
            : "✅ New series added successfully!"
        );
        resetContentForm();
      }
      return;
    }

    // Movie create or update
    const url = editingMovieId
      ? `/api/movies/${editingMovieId}`
      : "/api/movies";
    const method = editingMovieId ? "PUT" : "POST";

    const res = await adminFetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: titleAr || titleEn,
        titleAr: titleAr || titleEn,
        titleEn: titleEn || titleAr,
        description: descriptionAr || descriptionEn,
        descriptionAr,
        descriptionEn,
        posterUrl,
        backdropUrl,
        videoUrl,
        hlsUrl,
        servers,
        downloadLinks,
        year,
        duration,
        genre,
        country,
        rating,
        quality,
        language: languageField,
        originType,
        isFeatured,
        isPopular,
        isLatest,
      }),
    });

    if (res.ok) {
      await onRefreshData();
      showToast(
        editingMovieId
          ? lang === "ar"
            ? "✅ تم تحديث الفيلم وسيرفرات التشغيل بنجاح!"
            : "✅ Movie & video servers updated!"
          : lang === "ar"
          ? "✅ تم نشر الفيلم الجديد في الموقع فوراً!"
          : "✅ Movie published to catalog!"
      );
      resetContentForm();
    }
  };

  const handleDeleteMovie = async (id: number) => {
    const res = await adminFetch(`/api/movies/${id}`, { method: "DELETE" });
    if (res.ok) {
      await onRefreshData();
      showToast(lang === "ar" ? "🗑️ تم حذف الفيلم" : "🗑️ Movie deleted");
    }
  };

  const handleDeleteSeries = async (id: number) => {
    const res = await adminFetch(`/api/series/${id}`, { method: "DELETE" });
    if (res.ok) {
      await onRefreshData();
      showToast(lang === "ar" ? "🗑️ تم حذف المسلسل" : "🗑️ Series deleted");
    }
  };

  const handleUpdateRequestStatus = async (
    kind: "movie_request" | "premium_upgrade",
    id: number,
    status: string
  ) => {
    const res = await adminFetch("/api/requests", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, id, status }),
    });
    if (res.ok) {
      await fetchAnalytics(dateRange);
      await onRefreshData();
      showToast(
        lang === "ar"
          ? `✅ تم تحديث الحالة إلى ${status}`
          : `✅ Status updated to ${status}`
      );
    }
  };

  const updateServerField = (
    idx: number,
    field: keyof VideoServerItem,
    value: string | boolean | number
  ) => {
    setServers((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );
  };

  const updateDownloadField = (
    idx: number,
    field: keyof DownloadLinkItem,
    value: string | boolean
  ) => {
    setDownloadLinks((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );
  };

  const dateRanges = [
    { id: "today", ar: "اليوم", en: "Today" },
    { id: "yesterday", ar: "أمس", en: "Yesterday" },
    { id: "7d", ar: "آخر 7 أيام", en: "Last 7 Days" },
    { id: "30d", ar: "آخر 30 يومًا", en: "Last 30 Days" },
    { id: "90d", ar: "آخر 90 يومًا", en: "Last 90 Days" },
    { id: "all", ar: "كل الأوقات", en: "All Time" },
  ];

  return (
    <div className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-2 sm:p-6 overflow-y-auto overflow-x-hidden">
      <div className="w-full min-w-0 max-w-7xl h-[92vh] rounded-3xl bg-[#07070A] border border-[color:var(--primary-color)]/30 shadow-[0_0_90px_color-mix(in_srgb,var(--primary-color)_15%,transparent)] flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-[#0D0B06] via-[#13080A] to-[#08080C] border-b border-[color:var(--border-color)] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[color:var(--primary-color)] to-[color:var(--secondary-color)] text-black flex items-center justify-center font-black shadow-[0_0_25px_color-mix(in_srgb,var(--primary-color)_50%,transparent)]">
              🎬
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-[color:var(--text-color)] tracking-wide">
                  NAZMOVIES — {t.adminDashboard}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[color:var(--accent-color)] text-[color:var(--text-color)]">
                  ROOT ACCESS
                </span>
              </div>
              <p className="text-xs text-[color:var(--text-secondary-color)]">
                {lang === "ar"
                  ? "إدارة الأفلام والمسلسلات، 6 سيرفرات تشغيل، التحليلات، الطلبات، وإعدادات المنصة"
                  : "Complete Cinema Content, 6-Server Streaming, Analytics, Requests & Settings Suite"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="admin-logout"
              onClick={onLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[color:var(--accent-color)]/20 border border-[color:var(--accent-color)]/50 hover:bg-[color:var(--accent-color)] text-[color:var(--text-color)] text-xs font-bold transition"
            >
              <span>{lang === "ar" ? "تسجيل خروج المدير" : "Logout Admin"}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-[color:var(--text-color)] text-xs font-bold transition"
            >
              <X className="w-4 h-4" />
              <span>{lang === "ar" ? "إغلاق اللوحة" : "Close Dashboard"}</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 py-2.5 bg-[color:var(--card-color)] border-b border-[color:var(--border-color)] flex items-center gap-2 overflow-x-auto no-scrollbar">
          {[
            {
              id: "analytics",
              icon: BarChart3,
              label: t.analytics,
            },
            {
              id: "viewing",
              icon: Eye,
              label: lang === "ar" ? "إحصائيات المشاهدة" : "Viewing Statistics",
            },
            {
              id: "ads",
              icon: Megaphone,
              label: lang === "ar" ? "إدارة الإعلانات" : "Ad Management",
            },
            {
              id: "users",
              icon: UsersRound,
              label: lang === "ar" ? "المستخدمين" : "Users",
            },
            {
              id: "customization",
              icon: Sparkles,
              label: lang === "ar" ? "تخصيص الموقع" : "Website Customization",
            },
            {
              id: "content",
              icon: Film,
              label: t.manageContent,
            },
            {
              id: "view_stats",
              icon: Eye,
              label: t.movieViewStats,
            },
            {
              id: "search_stats",
              icon: Search,
              label: t.mostSearched,
            },
            {
              id: "movie_requests",
              icon: MessageSquarePlus,
              label: t.movieRequests,
            },
            {
              id: "premium_requests",
              icon: Crown,
              label: t.premiumRequests,
            },
            {
              id: "settings",
              icon: Settings,
              label: t.adminSettings,
            },
            {
              id: "legal_pages",
              icon: FileText,
              label: t.legalPagesEditor,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                data-testid={`admin-tab-${tab.id}`}
                type="button"
                onClick={() => setActiveTab(tab.id as AdminTab)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  active
                    ? "bg-[color:var(--primary-color)] text-black shadow-[0_0_20px_color-mix(in_srgb,var(--primary-color)_35%,transparent)]"
                    : "bg-white/5 text-[color:var(--text-secondary-color)] hover:bg-white/10 hover:text-[color:var(--text-color)]"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body Content */}
        <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-3 sm:p-6 space-y-6">
          {activeTab === "viewing" && <VisitorStatsPanel lang={lang} />}

          {activeTab === "ads" && (
            <AdManagementPanel lang={lang} settings={settings} onSave={onUpdateSettings} showToast={showToast} />
          )}

          {activeTab === "users" && <UsersPanel lang={lang} showToast={showToast} />}

          {activeTab === "customization" && (
            <CustomizationPanel lang={lang} settings={settings} onSave={onUpdateSettings} showToast={showToast} />
          )}

          {/* 1. ANALYTICS TAB */}
          {activeTab === "analytics" && (
            <div className="space-y-6">
              {/* Date Range Filter */}
              <div className="flex flex-wrap items-center justify-between gap-4 bg-white/[0.03] border border-[color:var(--border-color)] rounded-2xl p-4">
                <div>
                  <h3 className="text-base font-bold text-[color:var(--text-color)]">
                    {lang === "ar"
                      ? "نظرة عامة على أداء منصة أفلام ناز"
                      : "NAZMOVIES Platform Performance Overview"}
                  </h3>
                  <p className="text-xs text-[color:var(--text-secondary-color)]">
                    {lang === "ar"
                      ? "تصفية الإحصائيات والزيارات والمشاهدات حسب الفترة الزمنية"
                      : "Filter visits, unique viewers, and streaming metrics by time window"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {dateRanges.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setDateRange(r.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                        dateRange === r.id
                          ? "bg-[color:var(--primary-color)] text-black"
                          : "bg-white/5 text-[color:var(--text-secondary-color)] hover:bg-white/10"
                      }`}
                    >
                      {lang === "ar" ? r.ar : r.en}
                    </button>
                  ))}
                </div>
              </div>

              {/* KPI Summary Grid */}
              {analyticsData?.summary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    {
                      labelAr: "إجمالي زيارات الموقع",
                      labelEn: "Total Website Visits",
                      value:
                        analyticsData.summary.totalVisits.toLocaleString(),
                      accent: "text-[color:var(--primary-color)]",
                    },
                    {
                      labelAr: "الزوار الفريدون",
                      labelEn: "Unique Visitors",
                      value:
                        analyticsData.summary.uniqueVisitors.toLocaleString(),
                      accent: "text-emerald-400",
                    },
                    {
                      labelAr: "المستخدمون المسجلون",
                      labelEn: "Registered Users",
                      value:
                        analyticsData.summary.totalRegisteredUsers.toLocaleString(),
                      accent: "text-sky-400",
                    },
                    {
                      labelAr: "مشتركو البريميوم (بدون إعلانات)",
                      labelEn: "Premium Ad-Free Users",
                      value:
                        analyticsData.summary.premiumUsersCount.toLocaleString(),
                      accent: "text-[color:var(--primary-color)]",
                    },
                    {
                      labelAr: "إجمالي مشاهدات الأفلام",
                      labelEn: "Total Movie Views",
                      value:
                        analyticsData.summary.totalMovieViews.toLocaleString(),
                      accent: "text-[color:var(--accent-color)]",
                    },
                    {
                      labelAr: "إجمالي مشاهدات المسلسلات",
                      labelEn: "Total Series Views",
                      value:
                        analyticsData.summary.totalSeriesViews.toLocaleString(),
                      accent: "text-amber-400",
                    },
                    {
                      labelAr: "طلبات الأفلام النشطة",
                      labelEn: "Active Movie Requests",
                      value:
                        analyticsData.summary.pendingMovieRequestsCount.toLocaleString(),
                      accent: "text-purple-400",
                    },
                    {
                      labelAr: "طلبات الترقية للبريميوم",
                      labelEn: "Premium Upgrade Requests",
                      value:
                        analyticsData.summary.premiumRequestsCount.toLocaleString(),
                      accent: "text-rose-400",
                    },
                  ].map((stat, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-white/[0.03] border border-[color:var(--border-color)] hover:border-[color:var(--primary-color)]/40 transition"
                    >
                      <p className="text-xs text-[color:var(--text-secondary-color)]">
                        {lang === "ar" ? stat.labelAr : stat.labelEn}
                      </p>
                      <p className={`text-2xl font-black mt-1.5 ${stat.accent}`}>
                        {loadingAnalytics ? "..." : stat.value}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Visual Bar Charts: Most Watched Movies & Most Watched Series */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-5 rounded-2xl bg-white/[0.03] border border-[color:var(--border-color)] space-y-4">
                  <h4 className="text-sm font-bold text-[color:var(--primary-color)] flex items-center gap-2">
                    <Film className="w-4 h-4" />
                    <span>
                      {lang === "ar"
                        ? "الأفلام الأكثر مشاهدة"
                        : "Most Watched Movies"}
                    </span>
                  </h4>
                  <div className="space-y-3">
                    {(analyticsData?.mostWatchedMovies || [])
                      .slice(0, 5)
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      .map((m: any, i: number) => {
                        const maxV =
                          analyticsData?.mostWatchedMovies?.[0]?.viewsCount || 1;
                        const pct = Math.max(
                          12,
                          Math.round((m.viewsCount / maxV) * 100)
                        );
                        return (
                          <div key={m.id} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-[color:var(--text-color)]">
                                #{i + 1}{" "}
                                {lang === "ar" ? m.titleAr : m.titleEn}
                              </span>
                              <span className="text-[color:var(--primary-color)] font-mono">
                                {m.viewsCount.toLocaleString()}{" "}
                                {lang === "ar" ? "مشاهدة" : "views"}
                              </span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-[color:var(--primary-color)] to-[color:var(--accent-color)]"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-white/[0.03] border border-[color:var(--border-color)] space-y-4">
                  <h4 className="text-sm font-bold text-[color:var(--accent-color)] flex items-center gap-2">
                    <Tv className="w-4 h-4" />
                    <span>
                      {lang === "ar"
                        ? "المسلسلات الأكثر مشاهدة"
                        : "Most Watched Series"}
                    </span>
                  </h4>
                  <div className="space-y-3">
                    {(analyticsData?.mostWatchedSeries || [])
                      .slice(0, 5)
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      .map((s: any, i: number) => {
                        const maxV =
                          analyticsData?.mostWatchedSeries?.[0]?.viewsCount || 1;
                        const pct = Math.max(
                          12,
                          Math.round((s.viewsCount / maxV) * 100)
                        );
                        return (
                          <div key={s.id} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-[color:var(--text-color)]">
                                #{i + 1}{" "}
                                {lang === "ar" ? s.titleAr : s.titleEn}
                              </span>
                              <span className="text-[color:var(--primary-color)] font-mono">
                                {s.viewsCount.toLocaleString()}{" "}
                                {lang === "ar" ? "مشاهدة" : "views"}
                              </span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-[color:var(--accent-color)] to-[color:var(--primary-color)]"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. CONTENT MANAGEMENT TAB (Add/Edit Movie, Series, Episode + 6 Video Servers + Downloads) */}
          {activeTab === "content" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Form Column */}
              <form
                onSubmit={handleSaveContent}
                className="lg:col-span-7 p-5 rounded-2xl bg-white/[0.03] border border-[color:var(--border-color)] space-y-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--border-color)] pb-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        resetContentForm();
                        setContentMode("movie");
                      }}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                        contentMode === "movie"
                          ? "bg-[color:var(--primary-color)] text-black"
                          : "bg-white/5 text-[color:var(--text-secondary-color)]"
                      }`}
                    >
                      🎬 {t.addMovie}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        resetContentForm();
                        setContentMode("series");
                      }}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                        contentMode === "series"
                          ? "bg-[color:var(--primary-color)] text-black"
                          : "bg-white/5 text-[color:var(--text-secondary-color)]"
                      }`}
                    >
                      📺 {t.addSeries}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        resetContentForm();
                        setContentMode("episode");
                      }}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                        contentMode === "episode"
                          ? "bg-[color:var(--primary-color)] text-black"
                          : "bg-white/5 text-[color:var(--text-secondary-color)]"
                      }`}
                    >
                      🎞️ {t.addEpisode}
                    </button>
                  </div>

                  {editingMovieId && (
                    <button
                      type="button"
                      onClick={resetContentForm}
                      className="text-xs text-[color:var(--accent-color)] hover:underline"
                    >
                      {lang === "ar" ? "إلغاء التعديل" : "Cancel Edit"}
                    </button>
                  )}
                </div>

                {contentMode === "episode" && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-black/50 border border-[color:var(--primary-color)]/30">
                    <div>
                      <label className="block text-xs text-[color:var(--text-secondary-color)] mb-1">
                        {lang === "ar" ? "اختر المسلسل" : "Select Series"}
                      </label>
                      <select
                        value={targetSeriesId}
                        onChange={(e) =>
                          setTargetSeriesId(Number(e.target.value))
                        }
                        className="w-full px-3 py-2 rounded-xl bg-black border border-[color:var(--border-color)] text-xs text-[color:var(--text-color)]"
                      >
                        {seriesList.map((s) => (
                          <option key={s.id} value={s.id}>
                            {lang === "ar" ? s.titleAr : s.titleEn}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-[color:var(--text-secondary-color)] mb-1">
                        {t.season}
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={seasonNumber}
                        onChange={(e) =>
                          setSeasonNumber(Number(e.target.value))
                        }
                        className="w-full px-3 py-2 rounded-xl bg-black border border-[color:var(--border-color)] text-xs text-[color:var(--text-color)]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[color:var(--text-secondary-color)] mb-1">
                        {t.episode}
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={episodeNumber}
                        onChange={(e) =>
                          setEpisodeNumber(Number(e.target.value))
                        }
                        className="w-full px-3 py-2 rounded-xl bg-black border border-[color:var(--border-color)] text-xs text-[color:var(--text-color)]"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[color:var(--text-secondary-color)] mb-1">
                      {lang === "ar"
                        ? "العنوان بالعربية (Arabic Title)"
                        : "Arabic Title"}
                    </label>
                    <input
                      type="text"
                      required
                      value={titleAr}
                      onChange={(e) => setTitleAr(e.target.value)}
                      placeholder="مثال: فرسان الصحراء"
                      className="w-full px-3.5 py-2 rounded-xl bg-black/70 border border-[color:var(--border-color)] text-xs text-[color:var(--text-color)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[color:var(--text-secondary-color)] mb-1">
                      {lang === "ar"
                        ? "العنوان بالإنجليزية (English Title)"
                        : "English Title"}
                    </label>
                    <input
                      type="text"
                      required
                      value={titleEn}
                      onChange={(e) => setTitleEn(e.target.value)}
                      placeholder="e.g. Desert Knights"
                      className="w-full px-3.5 py-2 rounded-xl bg-black/70 border border-[color:var(--border-color)] text-xs text-[color:var(--text-color)]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[color:var(--text-secondary-color)] mb-1">
                      {lang === "ar"
                        ? "الوصف بالعربية"
                        : "Arabic Description"}
                    </label>
                    <textarea
                      rows={2}
                      value={descriptionAr}
                      onChange={(e) => setDescriptionAr(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-black/70 border border-[color:var(--border-color)] text-xs text-[color:var(--text-color)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[color:var(--text-secondary-color)] mb-1">
                      {lang === "ar"
                        ? "الوصف بالإنجليزية"
                        : "English Description"}
                    </label>
                    <textarea
                      rows={2}
                      value={descriptionEn}
                      onChange={(e) => setDescriptionEn(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-black/70 border border-[color:var(--border-color)] text-xs text-[color:var(--text-color)]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs text-[color:var(--text-secondary-color)] mb-1">
                      {t.genre}
                    </label>
                    <select
                      value={genre}
                      onChange={(e) => setGenre(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-black/70 border border-[color:var(--border-color)] text-xs text-[color:var(--text-color)]"
                    >
                      <option value="action">Action / أكشن</option>
                      <option value="drama">Drama / دراما</option>
                      <option value="scifi">Sci-Fi / خيال علمي</option>
                      <option value="comedy">Comedy / كوميديا</option>
                      <option value="horror">Horror / رعب</option>
                      <option value="romance">Romance / رومانسي</option>
                      <option value="adventure">Adventure / مغامرات</option>
                      <option value="mystery">Mystery / غموض</option>
                      <option value="crime">Crime / جريمة</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-[color:var(--text-secondary-color)] mb-1">
                      {t.year}
                    </label>
                    <input
                      type="number"
                      value={year}
                      onChange={(e) => setYear(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-black/70 border border-[color:var(--border-color)] text-xs text-[color:var(--text-color)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[color:var(--text-secondary-color)] mb-1">
                      {t.rating} ⭐
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="10"
                      value={rating}
                      onChange={(e) => setRating(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-black/70 border border-[color:var(--border-color)] text-xs text-[color:var(--text-color)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[color:var(--text-secondary-color)] mb-1">
                      {t.quality}
                    </label>
                    <select
                      value={quality}
                      onChange={(e) => setQuality(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-black/70 border border-[color:var(--border-color)] text-xs text-[color:var(--text-color)]"
                    >
                      <option value="4K">4K Ultra HD</option>
                      <option value="1080p">1080p Full HD</option>
                      <option value="HD">HD</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[color:var(--text-secondary-color)] mb-1">
                      Poster URL
                    </label>
                    <input
                      type="text"
                      value={posterUrl}
                      onChange={(e) => setPosterUrl(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-black/70 border border-[color:var(--border-color)] text-xs text-[color:var(--text-color)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[color:var(--text-secondary-color)] mb-1">
                      Backdrop URL
                    </label>
                    <input
                      type="text"
                      value={backdropUrl}
                      onChange={(e) => setBackdropUrl(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-black/70 border border-[color:var(--border-color)] text-xs text-[color:var(--text-color)]"
                    />
                  </div>
                </div>

                {/* 6 VIDEO SERVERS CONFIGURATION */}
                <div className="p-4 rounded-2xl bg-black/60 border border-[color:var(--primary-color)]/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-[color:var(--primary-color)]">
                      <Server className="w-4 h-4" />
                      <span>
                        {lang === "ar"
                          ? "إدارة سيرفرات التشغيل (Server 1 إلى Server 6)"
                          : "Manage 6 Video Servers (Server 1 – Server 6)"}
                      </span>
                    </div>
                    <span className="text-[11px] text-[color:var(--text-secondary-color)]">
                      HLS (.m3u8) / MP4 / External URL
                    </span>
                  </div>

                  <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                    {servers.map((srv, idx) => (
                      <div
                        key={srv.id}
                        className="p-2.5 rounded-xl bg-white/[0.03] border border-[color:var(--border-color)] grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                      >
                        <div className="sm:col-span-2 flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={srv.isEnabled}
                            onChange={(e) =>
                              updateServerField(
                                idx,
                                "isEnabled",
                                e.target.checked
                              )
                            }
                            className="accent-[color:var(--primary-color)]"
                          />
                          <span className="text-xs font-bold text-[color:var(--text-color)]">
                            Server {srv.id}
                          </span>
                        </div>
                        <div className="sm:col-span-5">
                          <input
                            type="text"
                            value={srv.url}
                            onChange={(e) =>
                              updateServerField(idx, "url", e.target.value)
                            }
                            placeholder="https://example.com/video.m3u8 or .mp4"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-black border border-[color:var(--border-color)] text-[11px] text-[color:var(--text-color)]"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <select
                            value={srv.type}
                            onChange={(e) =>
                              updateServerField(
                                idx,
                                "type",
                                e.target.value as "hls" | "mp4" | "external"
                              )
                            }
                            className="w-full px-2 py-1.5 rounded-lg bg-black border border-[color:var(--border-color)] text-[11px] text-[color:var(--text-color)]"
                          >
                            <option value="mp4">MP4 Direct</option>
                            <option value="hls">HLS (.m3u8)</option>
                            <option value="external">External Stream</option>
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <select
                            value={srv.quality}
                            onChange={(e) =>
                              updateServerField(idx, "quality", e.target.value)
                            }
                            className="w-full px-2 py-1.5 rounded-lg bg-black border border-[color:var(--border-color)] text-[11px] text-[color:var(--primary-color)] font-bold"
                          >
                            <option value="4K">4K</option>
                            <option value="1080p">1080p</option>
                            <option value="720p">720p</option>
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* DOWNLOAD LINKS CONFIGURATION (720p / 1080p / 4K) */}
                <div className="p-4 rounded-2xl bg-black/60 border border-[color:var(--border-color)] space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                    <Download className="w-4 h-4" />
                    <span>
                      {lang === "ar"
                        ? "روابط التحميل المباشر (4K / 1080p / 720p)"
                        : "Authorized Download Links (4K / 1080p / 720p)"}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {downloadLinks.map((dl, idx) => (
                      <div
                        key={dl.id}
                        className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                      >
                        <div className="sm:col-span-2 flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={dl.isEnabled}
                            onChange={(e) =>
                              updateDownloadField(
                                idx,
                                "isEnabled",
                                e.target.checked
                              )
                            }
                            className="accent-[color:var(--primary-color)]"
                          />
                          <span className="px-2 py-0.5 rounded bg-[color:var(--primary-color)] text-black text-[11px] font-black">
                            {dl.quality}
                          </span>
                        </div>
                        <div className="sm:col-span-3">
                          <input
                            type="text"
                            value={dl.size}
                            onChange={(e) =>
                              updateDownloadField(idx, "size", e.target.value)
                            }
                            placeholder="2.4 GB"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-black border border-[color:var(--border-color)] text-[11px] text-[color:var(--text-color)]"
                          />
                        </div>
                        <div className="sm:col-span-7">
                          <input
                            type="text"
                            value={dl.url}
                            onChange={(e) =>
                              updateDownloadField(idx, "url", e.target.value)
                            }
                            placeholder="https://cdn.nazmovies.com/downloads/movie.mp4"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-black border border-[color:var(--border-color)] text-[11px] text-[color:var(--text-color)]"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Flags */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-200">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isFeatured}
                      onChange={(e) => setIsFeatured(e.target.checked)}
                      className="accent-[color:var(--primary-color)]"
                    />
                    <span>{t.featured}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isPopular}
                      onChange={(e) => setIsPopular(e.target.checked)}
                      className="accent-[color:var(--primary-color)]"
                    />
                    <span>{t.popular}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isLatest}
                      onChange={(e) => setIsLatest(e.target.checked)}
                      className="accent-[color:var(--primary-color)]"
                    />
                    <span>{t.latest}</span>
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-2xl naz-btn text-black font-black text-sm shadow-[0_0_25px_color-mix(in_srgb,var(--primary-color)_40%,transparent)] hover:brightness-110 transition flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span>
                    {editingMovieId
                      ? lang === "ar"
                        ? "حفظ التعديلات والسيرفرات"
                        : "Save Movie & Servers"
                      : lang === "ar"
                      ? "نشر في المنصة فوراً"
                      : "Publish to NAZMOVIES"}
                  </span>
                </button>
              </form>

              {/* Existing Catalog List Column */}
              <div className="lg:col-span-5 p-5 rounded-2xl bg-white/[0.03] border border-[color:var(--border-color)] space-y-4 max-h-[75vh] overflow-y-auto">
                <h4 className="text-sm font-bold text-[color:var(--text-color)] flex items-center justify-between">
                  <span>
                    {lang === "ar"
                      ? `مكتبة الأفلام (${moviesList.length})`
                      : `Movies Catalog (${moviesList.length})`}
                  </span>
                </h4>
                <div className="space-y-2.5">
                  {moviesList.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-black/60 border border-[color:var(--border-color)] hover:border-[color:var(--primary-color)]/40 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={m.posterUrl}
                          alt={m.titleAr}
                          className="w-10 h-14 object-cover rounded-lg flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[color:var(--text-color)] truncate">
                            {lang === "ar" ? m.titleAr : m.titleEn}
                          </p>
                          <p className="text-[11px] text-[color:var(--text-secondary-color)]">
                            {m.year} • {m.quality} •{" "}
                            {(m.servers || []).length || 6} Servers
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleLoadMovieForEdit(m)}
                          className="p-2 rounded-lg bg-white/5 hover:bg-[color:var(--primary-color)] hover:text-black text-[color:var(--text-secondary-color)] transition"
                          title={t.edit}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMovie(m.id)}
                          className="p-2 rounded-lg bg-white/5 hover:bg-[color:var(--accent-color)] text-[color:var(--text-secondary-color)] hover:text-[color:var(--text-color)] transition"
                          title={t.delete}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <h4 className="text-sm font-bold text-[color:var(--text-color)] pt-4 border-t border-[color:var(--border-color)]">
                  {lang === "ar"
                    ? `مكتبة المسلسلات (${seriesList.length})`
                    : `Series Catalog (${seriesList.length})`}
                </h4>
                <div className="space-y-2.5">
                  {seriesList.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-black/60 border border-[color:var(--border-color)]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={s.posterUrl}
                          alt={s.titleAr}
                          className="w-10 h-14 object-cover rounded-lg flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[color:var(--text-color)] truncate">
                            {lang === "ar" ? s.titleAr : s.titleEn}
                          </p>
                          <p className="text-[11px] text-[color:var(--text-secondary-color)]">
                            {s.seasonsCount} Seasons • {s.quality}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteSeries(s.id)}
                        className="p-2 rounded-lg bg-white/5 hover:bg-[color:var(--accent-color)] text-[color:var(--text-secondary-color)] hover:text-[color:var(--text-color)] transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 3. MOVIE VIEW STATISTICS TAB */}
          {activeTab === "view_stats" && (
            <div className="p-5 rounded-2xl bg-white/[0.03] border border-[color:var(--border-color)] space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-[color:var(--text-color)]">
                    {t.movieViewStats} —{" "}
                    <span className="text-[color:var(--primary-color)]">Most Watched Ranking</span>
                  </h3>
                  <p className="text-xs text-[color:var(--text-secondary-color)]">
                    {lang === "ar"
                      ? "ترتيب الأفلام حسب المشاهدات الحقيقية، المشاهدين الفريدين، وإجمالي وقت المشاهدة"
                      : "Ranked by meaningful video views, unique viewers, and cumulative watch time"}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left rtl:text-right border-collapse">
                  <thead>
                    <tr className="border-b border-[color:var(--border-color)] text-[color:var(--text-secondary-color)]">
                      <th className="py-3 px-3">#</th>
                      <th className="py-3 px-3">
                        {lang === "ar" ? "اسم الفيلم" : "Movie Title"}
                      </th>
                      <th className="py-3 px-3">
                        {lang === "ar" ? "إجمالي المشاهدات" : "Total Views"}
                      </th>
                      <th className="py-3 px-3">
                        {lang === "ar" ? "مشاهدات فريدة" : "Unique Views"}
                      </th>
                      <th className="py-3 px-3">
                        {lang === "ar" ? "وقت المشاهدة" : "Watch Time"}
                      </th>
                      <th className="py-3 px-3">
                        {lang === "ar" ? "آخر مشاهدة" : "Last Viewed"}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {(analyticsData?.mostWatchedMovies || moviesList).map(
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      (m: any, idx: number) => (
                        <tr
                          key={m.id}
                          className="hover:bg-white/[0.02] transition"
                        >
                          <td className="py-3 px-3 font-black text-[color:var(--primary-color)]">
                            #{idx + 1}
                          </td>
                          <td className="py-3 px-3 font-bold text-[color:var(--text-color)] flex items-center gap-2.5">
                            <img
                              src={m.posterUrl}
                              alt=""
                              className="w-8 h-11 rounded object-cover"
                            />
                            <div>
                              <p>{lang === "ar" ? m.titleAr : m.titleEn}</p>
                              <p className="text-[10px] text-[color:var(--text-secondary-color)]">
                                {lang === "ar" ? m.genreAr : m.genreEn}
                              </p>
                            </div>
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-[color:var(--text-color)]">
                            {(m.viewsCount || 0).toLocaleString()}
                          </td>
                          <td className="py-3 px-3 font-mono text-emerald-400">
                            {(
                              m.uniqueViewsCount ||
                              Math.round((m.viewsCount || 1000) * 0.76)
                            ).toLocaleString()}
                          </td>
                          <td className="py-3 px-3 font-mono text-[color:var(--primary-color)]">
                            {Math.round(
                              (m.watchTimeMinutes || 12000) / 60
                            ).toLocaleString()}{" "}
                            {lang === "ar" ? "ساعة" : "hrs"}
                          </td>
                          <td className="py-3 px-3 text-[color:var(--text-secondary-color)]">
                            {m.lastViewedAt
                              ? new Date(m.lastViewedAt).toLocaleString(
                                  lang === "ar" ? "ar-SA" : "en-US"
                                )
                              : lang === "ar"
                              ? "منذ دقائق"
                              : "Just now"}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 4. SEARCH ANALYTICS TAB ("Most Searched") */}
          {activeTab === "search_stats" && (
            <div className="p-5 rounded-2xl bg-white/[0.03] border border-[color:var(--border-color)] space-y-4">
              <div>
                <h3 className="text-base font-bold text-[color:var(--text-color)]">
                  {t.mostSearched} —{" "}
                  <span className="text-[color:var(--primary-color)]">Search Analytics</span>
                </h3>
                <p className="text-xs text-[color:var(--text-secondary-color)]">
                  {lang === "ar"
                    ? "الكلمات والأفلام الأكثر بحثاً من قبل زوار الموقع في الوقت الفعلي"
                    : "Real-time aggregated search queries performed by visitors"}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(analyticsData?.mostSearched || []).map(
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (item: any, index: number) => (
                    <div
                      key={item.id || index}
                      className="flex items-center justify-between p-4 rounded-2xl bg-black/60 border border-[color:var(--border-color)] hover:border-[color:var(--primary-color)]/40 transition"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-xl bg-[color:var(--primary-color)]/15 text-[color:var(--primary-color)] font-black text-xs flex items-center justify-center">
                          #{index + 1}
                        </span>
                        <div>
                          <p className="text-sm font-bold text-[color:var(--text-color)]">
                            {item.query}
                          </p>
                          <p className="text-[11px] text-[color:var(--text-secondary-color)]">
                            {lang === "ar" ? "كلمة بحث نشطة" : "Trending Query"}
                          </p>
                        </div>
                      </div>
                      <span className="px-3 py-1.5 rounded-xl bg-white/5 text-[color:var(--primary-color)] font-mono text-xs font-bold border border-[color:var(--primary-color)]/20">
                        {Number(item.searchCount).toLocaleString()}{" "}
                        {lang === "ar" ? "عملية بحث" : "searches"}
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {/* 5. MOVIE REQUESTS TAB */}
          {activeTab === "movie_requests" && (
            <div className="p-5 rounded-2xl bg-white/[0.03] border border-[color:var(--border-color)] space-y-4">
              <div>
                <h3 className="text-base font-bold text-[color:var(--text-color)]">
                  {t.movieRequests}
                </h3>
                <p className="text-xs text-[color:var(--text-secondary-color)]">
                  {lang === "ar"
                    ? "يتم تجميع الطلبات المتكررة لنفس العمل تلقائياً مع عرض إجمالي عدد الطلبات"
                    : "Duplicate requests for the same title are grouped automatically with total count"}
                </p>
              </div>

              <div className="space-y-3">
                {(analyticsData?.mostRequested || []).map(
                  (req: MovieRequestRecord) => (
                    <div
                      key={req.id}
                      className="p-4 rounded-2xl bg-black/60 border border-[color:var(--border-color)] flex flex-wrap items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-[color:var(--primary-color)] text-black text-[11px] font-black">
                            {req.requestCount}{" "}
                            {lang === "ar" ? "طلب" : "Requests"}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-white/10 text-zinc-200 text-[11px] uppercase">
                            {req.mediaType} • {req.year}
                          </span>
                          <h4 className="text-sm font-bold text-[color:var(--text-color)]">
                            {req.title}
                          </h4>
                        </div>
                        {req.message && (
                          <p className="text-xs text-[color:var(--text-secondary-color)]">{req.message}</p>
                        )}
                        <p className="text-[11px] text-zinc-500">
                          {lang === "ar" ? "مقدم الطلب:" : "Requester:"}{" "}
                          {req.requesterName}{" "}
                          {req.requesterEmail ? `(${req.requesterEmail})` : ""}{" "}
                          •{" "}
                          {new Date(req.createdAt).toLocaleDateString(
                            lang === "ar" ? "ar-SA" : "en-US"
                          )}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {(
                          ["Pending", "Searching", "Added", "Rejected"] as const
                        ).map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() =>
                              handleUpdateRequestStatus(
                                "movie_request",
                                req.id,
                                st
                              )
                            }
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                              req.status === st
                                ? st === "Added"
                                  ? "bg-emerald-500 text-black"
                                  : st === "Rejected"
                                  ? "bg-[color:var(--accent-color)] text-[color:var(--text-color)]"
                                  : "bg-[color:var(--primary-color)] text-black"
                                : "bg-white/5 text-[color:var(--text-secondary-color)] hover:text-[color:var(--text-color)]"
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {/* 6. PREMIUM UPGRADE REQUESTS TAB */}
          {activeTab === "premium_requests" && (
            <div className="p-5 rounded-2xl bg-white/[0.03] border border-[color:var(--border-color)] space-y-4">
              <div>
                <h3 className="text-base font-bold text-[color:var(--text-color)] flex items-center gap-2">
                  <Crown className="w-5 h-5 text-[color:var(--primary-color)]" />
                  <span>{t.premiumRequests}</span>
                </h3>
                <p className="text-xs text-[color:var(--text-secondary-color)]">
                  {lang === "ar"
                    ? "عند الموافقة (Approve) يتحول حساب المستخدم فوراً إلى Premium وتختفي الإعلانات لديه تلقائياً"
                    : "Approving a request immediately upgrades the user account to Premium Ad-Free status"}
                </p>
              </div>

              <div className="space-y-3">
                {(analyticsData?.premiumRequests || []).map(
                  (pr: PremiumRequestRecord) => (
                    <div
                      key={pr.id}
                      className="p-4 rounded-2xl bg-black/60 border border-[color:var(--border-color)] flex flex-wrap items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-[color:var(--text-color)]">
                            {pr.name} (@{pr.username})
                          </span>
                          <span className="text-xs text-[color:var(--primary-color)]">
                            {pr.email}
                          </span>
                        </div>
                        <p className="text-xs text-[color:var(--text-secondary-color)]">
                          {pr.currentPlan} →{" "}
                          <span className="text-[color:var(--primary-color)] font-bold">
                            {pr.requestedPlan}
                          </span>
                        </p>
                        {pr.message && (
                          <p className="text-xs text-[color:var(--text-secondary-color)] italic">
                            &ldquo;{pr.message}&rdquo;
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {(["Pending", "Approved", "Rejected"] as const).map(
                          (st) => (
                            <button
                              key={st}
                              type="button"
                              onClick={() =>
                                handleUpdateRequestStatus(
                                  "premium_upgrade",
                                  pr.id,
                                  st
                                )
                              }
                              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                                pr.status === st
                                  ? st === "Approved"
                                    ? "bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                                    : st === "Rejected"
                                    ? "bg-[color:var(--accent-color)] text-[color:var(--text-color)]"
                                    : "bg-[color:var(--primary-color)] text-black"
                                  : "bg-white/5 text-[color:var(--text-secondary-color)] hover:text-[color:var(--text-color)]"
                              }`}
                            >
                              {st}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {/* 7. ADMIN SETTINGS & AD SETTINGS TAB */}
          {activeTab === "settings" && (
            <div className="space-y-5">
            <PremiumSettingsPanel lang={lang} settings={settings} onSave={onUpdateSettings} showToast={showToast} />
            <div className="p-5 rounded-2xl bg-white/[0.03] border border-[color:var(--border-color)] space-y-6">
              <div>
                <h3 className="text-base font-bold text-[color:var(--text-color)]">
                  {t.adminSettings}
                </h3>
                <p className="text-xs text-[color:var(--text-secondary-color)]">
                  {lang === "ar"
                    ? "تحكم كامل في التحقق، التسجيل، الإعلانات، التحميل، وعدد سيرفرات الفيديو"
                    : "Configure verification, registration, advertisements, downloads, and video servers"}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(
                  [
                    {
                      key: "requireEmailVerification",
                      labelAr: "تفعيل التحقق من البريد الإلكتروني (Email Verification)",
                      labelEn: "Require Email Verification",
                      descAr: "افتراضياً متوقف (OFF) للسماح بالتسجيل الفوري",
                      descEn: "Default OFF so users can register and immediately use the site",
                    },
                    {
                      key: "requirePhoneVerification",
                      labelAr: "تفعيل التحقق من رقم الهاتف (Phone Verification)",
                      labelEn: "Require Phone Verification",
                      descAr: "افتراضياً متوقف (OFF) لتسهيل انضمام الأعضاء",
                      descEn: "Default OFF for frictionless onboarding",
                    },
                    {
                      key: "registrationEnabled",
                      labelAr: "السماح بتسجيل حسابات جديدة (Registration)",
                      labelEn: "Registration Enabled",
                      descAr: "فتح أو إغلاق إنشاء الحسابات للزوار",
                      descEn: "Allow new visitors to create accounts",
                    },
                    {
                      key: "movieRequestsEnabled",
                      labelAr: "نظام طلب الأفلام والمسلسلات (Movie Requests)",
                      labelEn: "Movie Requests Enabled",
                      descAr: "إظهار زر اطلب فيلماً للجمهور",
                      descEn: "Enable public 'Request a Movie' feature",
                    },
                    {
                      key: "downloadsEnabled",
                      labelAr: "خيارات التحميل المباشر (Downloads)",
                      labelEn: "Downloads Enabled",
                      descAr: "إظهار روابط تحميل 4K / 1080p / 720p",
                      descEn: "Show 4K / 1080p / 720p download options",
                    },
                    {
                      key: "adsEnabled",
                      labelAr: "تفعيل نظام الإعلانات العام (Ads Enabled)",
                      labelEn: "Ads Enabled (Master Switch)",
                      descAr: "التحكم الرئيسي في ظهور الإعلانات بالموقع",
                      descEn: "Master switch for platform advertisements",
                    },
                    {
                      key: "adsForFreeUsers",
                      labelAr: "إظهار الإعلانات للمستخدمين المجانيين (Ads for Free Users)",
                      labelEn: "Ads for Free Users",
                      descAr: "افتراضياً مفعل (ON)",
                      descEn: "Default ON for standard free accounts",
                    },
                    {
                      key: "adsForPremiumUsers",
                      labelAr: "إظهار الإعلانات لمشتركي البريميوم (Ads for Premium Users)",
                      labelEn: "Ads for Premium Users",
                      descAr: "افتراضياً متوقف (OFF) لحسابات البريميوم",
                      descEn: "Default OFF so Premium users enjoy Ad-Free streaming",
                    },
                    {
                      key: "premiumFeaturesEnabled",
                      labelAr: "ميزات الترقية للبريميوم (Premium Features)",
                      labelEn: "Premium Features Enabled",
                      descAr: "إتاحة خيار الترقية بدون إعلانات",
                      descEn: "Show Upgrade to Ad-Free options",
                    },
                    {
                      key: "maintenanceMode",
                      labelAr: "وضع الصيانة (Maintenance Mode)",
                      labelEn: "Maintenance Mode",
                      descAr: "إظهار تنبيه الصيانة للزوار غير المديرين",
                      descEn: "Display maintenance banner to non-admin visitors",
                    },
                  ] as const
                ).map((item) => {
                  const val = Boolean(settings[item.key]);
                  return (
                    <div
                      key={item.key}
                      className="flex items-center justify-between p-4 rounded-2xl bg-black/60 border border-[color:var(--border-color)]"
                    >
                      <div className="pr-3">
                        <p className="text-xs font-bold text-[color:var(--text-color)]">
                          {lang === "ar" ? item.labelAr : item.labelEn}
                        </p>
                        <p className="text-[11px] text-[color:var(--text-secondary-color)] mt-0.5">
                          {lang === "ar" ? item.descAr : item.descEn}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateSettings({ [item.key]: !val })
                        }
                        className={`px-4 py-2 rounded-xl text-xs font-black transition ${
                          val
                            ? "bg-[color:var(--primary-color)] text-black shadow-[0_0_15px_color-mix(in_srgb,var(--primary-color)_35%,transparent)]"
                            : "bg-white/10 text-[color:var(--text-secondary-color)]"
                        }`}
                      >
                        {val ? "ON" : "OFF"}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Selectors: Default Language & Max Video Servers (1-6) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-2xl bg-black/60 border border-[color:var(--border-color)] flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-[color:var(--text-color)]">
                      {lang === "ar"
                        ? "اللغة الافتراضية للمنصة"
                        : "Default Platform Language"}
                    </p>
                    <p className="text-[11px] text-[color:var(--text-secondary-color)]">
                      Arabic (RTL) / English (LTR)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {(["ar", "en"] as const).map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() =>
                          onUpdateSettings({ defaultLanguage: l })
                        }
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold ${
                          settings.defaultLanguage === l
                            ? "bg-[color:var(--primary-color)] text-black"
                            : "bg-white/10 text-[color:var(--text-secondary-color)]"
                        }`}
                      >
                        {l === "ar" ? "العربية" : "English"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-black/60 border border-[color:var(--border-color)] flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-[color:var(--text-color)]">
                      {lang === "ar"
                        ? "الحد الأقصى لسيرفرات الفيديو (1–6)"
                        : "Maximum Video Servers (1–6)"}
                    </p>
                    <p className="text-[11px] text-[color:var(--text-secondary-color)]">
                      {lang === "ar"
                        ? "عدد السيرفرات المعروضة داخل المشغل"
                        : "Number of servers shown inside the player"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5, 6].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() =>
                          onUpdateSettings({ maxVideoServers: num })
                        }
                        className={`w-8 h-8 rounded-xl text-xs font-black ${
                          settings.maxVideoServers === num
                            ? "bg-[color:var(--primary-color)] text-black"
                            : "bg-white/10 text-[color:var(--text-secondary-color)]"
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            </div>
          )}

          {/* 8. EDITABLE LEGAL & INFO PAGES TAB (About Us, Privacy Policy, Terms of Service) */}
          {activeTab === "legal_pages" && (
            <div className="p-5 rounded-2xl bg-white/[0.03] border border-[color:var(--border-color)] space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-[color:var(--text-color)]">
                    {t.legalPagesEditor}
                  </h3>
                  <p className="text-xs text-[color:var(--text-secondary-color)]">
                    {lang === "ar"
                      ? "تعديل محتوى صفحات (من نحن، سياسة الخصوصية، الشروط والأحكام) باللغتين العربية والإنجليزية"
                      : "Edit About Us, Privacy Policy, and Terms of Service in both Arabic and English"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({
                      aboutUsAr: aboutAr,
                      aboutUsEn: aboutEn,
                      privacyPolicyAr: privacyAr,
                      privacyPolicyEn: privacyEn,
                      termsOfServiceAr: termsAr,
                      termsOfServiceEn: termsEn,
                    })
                  }
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[color:var(--primary-color)] text-black font-black text-xs shadow-[0_0_20px_color-mix(in_srgb,var(--primary-color)_40%,transparent)] hover:brightness-110 transition"
                >
                  <Save className="w-4 h-4" />
                  <span>{t.saveChanges}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[color:var(--primary-color)] mb-1.5">
                    من نحن (About Us — Arabic)
                  </label>
                  <textarea
                    rows={5}
                    value={aboutAr}
                    onChange={(e) => setAboutAr(e.target.value)}
                    className="w-full p-3 rounded-xl bg-black/70 border border-[color:var(--border-color)] text-xs text-[color:var(--text-color)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[color:var(--primary-color)] mb-1.5">
                    About Us (English)
                  </label>
                  <textarea
                    rows={5}
                    value={aboutEn}
                    onChange={(e) => setAboutEn(e.target.value)}
                    className="w-full p-3 rounded-xl bg-black/70 border border-[color:var(--border-color)] text-xs text-[color:var(--text-color)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[color:var(--primary-color)] mb-1.5">
                    سياسة الخصوصية (Privacy Policy — Arabic)
                  </label>
                  <textarea
                    rows={7}
                    value={privacyAr}
                    onChange={(e) => setPrivacyAr(e.target.value)}
                    className="w-full p-3 rounded-xl bg-black/70 border border-[color:var(--border-color)] text-xs text-[color:var(--text-color)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[color:var(--primary-color)] mb-1.5">
                    Privacy Policy (English)
                  </label>
                  <textarea
                    rows={7}
                    value={privacyEn}
                    onChange={(e) => setPrivacyEn(e.target.value)}
                    className="w-full p-3 rounded-xl bg-black/70 border border-[color:var(--border-color)] text-xs text-[color:var(--text-color)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[color:var(--primary-color)] mb-1.5">
                    الشروط والأحكام (Terms of Service — Arabic)
                  </label>
                  <textarea
                    rows={6}
                    value={termsAr}
                    onChange={(e) => setTermsAr(e.target.value)}
                    className="w-full p-3 rounded-xl bg-black/70 border border-[color:var(--border-color)] text-xs text-[color:var(--text-color)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[color:var(--primary-color)] mb-1.5">
                    Terms of Service (English)
                  </label>
                  <textarea
                    rows={6}
                    value={termsEn}
                    onChange={(e) => setTermsEn(e.target.value)}
                    className="w-full p-3 rounded-xl bg-black/70 border border-[color:var(--border-color)] text-xs text-[color:var(--text-color)]"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
