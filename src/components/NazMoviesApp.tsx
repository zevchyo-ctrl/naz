"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  Play,
  Info,
  Search,
  Plus,
  Check,
  Heart,
  Star,
  ChevronLeft,
  ChevronRight,
  Film,
  Tv,
  Sparkles,
  User,
  Crown,
  Download,
  Server,
  Menu,
  X,
  Globe,
  MessageSquarePlus,
  Bookmark,
  ShieldAlert,
  Clock,
  Calendar,
  MapPin,
  Users as UsersIcon,
  Clapperboard,
  Settings,
} from "lucide-react";
import { Language, translations } from "@/lib/translations";
import {
  MovieRecord,
  SeriesRecord,
  SeasonRecord,
  EpisodeRecord,
  CategoryRecord,
  PlatformSettingsData,
} from "@/db/schema";
import {
  DEFAULT_PLATFORM_SETTINGS,
  buildDefaultServers,
  buildDefaultDownloads,
} from "@/lib/defaults";
import VideoPlayerModal, { PlayableMedia } from "@/components/VideoPlayerModal";
import {
  adminFetch,
  userFetch,
  USER_TOKEN_KEY,
  adminLogout,
  safeGet,
  safeSet,
  safeRemove,
} from "@/lib/clientAuth";
import type { SaveResult } from "@/components/AdminExtraPanels";
import { trackEvent } from "@/lib/track";
import { BannerAd, GlobalAds } from "@/components/AdSlot";
import { buildThemeCss, formatClock } from "@/lib/theme";
import {
  HistoryItem,
  ContinueEntry,
  buildContinueWatching,
  progressKey,
  percentOf,
} from "@/lib/history";
import {
  ContinueWatchingGrid,
  WatchHistoryPanel,
  FavoritesPanel,
} from "@/components/AccountPanels";
import AdminDashboardModal from "@/components/AdminDashboardModal";
import {
  UserAuthModal,
  MovieRequestModal,
  PremiumUpgradeModal,
  LegalPageModal,
  ClientUser,
  ContactModal,
} from "@/components/PublicModals";

type NavSection = "home" | "movies" | "series" | "categories" | "mylist";

export default function NazMoviesApp({
  initialSettings,
}: {
  initialSettings?: PlatformSettingsData;
}) {
  // Language state (Default: Arabic 'ar', persisted in localStorage)
  const [lang, setLang] = useState<Language>("ar");
  const t = translations[lang];

  // Navigation & Views
  const [activeNav, setActiveNav] = useState<NavSection>("home");
  const [selectedCategorySlug, setSelectedCategorySlug] =
    useState<string>("all");
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Data from PostgreSQL API
  const [moviesList, setMoviesList] = useState<MovieRecord[]>([]);
  const [seriesList, setSeriesList] = useState<SeriesRecord[]>([]);
  const [seasonsList, setSeasonsList] = useState<SeasonRecord[]>([]);
  const [episodesList, setEpisodesList] = useState<EpisodeRecord[]>([]);
  const [categoriesList, setCategoriesList] = useState<CategoryRecord[]>([]);
  const [settings, setSettings] = useState<PlatformSettingsData>(
    initialSettings || DEFAULT_PLATFORM_SETTINGS
  );
  const siteName = settings.siteName || "NAZMOVIES";

  // Per-account watch history (server-side, token-scoped)
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [playStartTime, setPlayStartTime] = useState(0);
  const [contactOpen, setContactOpen] = useState(false);
  // False until the saved user session has been checked. Ads stay off until then so a
  // premium (ad-free) visitor never has ad scripts fire during the first render.
  const [authResolved, setAuthResolved] = useState(false);
  const [authInitialTab, setAuthInitialTab] = useState<"continue" | "history" | "favorites" | "settings">("continue");
  const [isLoading, setIsLoading] = useState(true);

  // Hero Slider State
  const [heroIndex, setHeroIndex] = useState(0);

  // Selected Item for Details View (Movie or Series)
  const [detailMovie, setDetailMovie] = useState<MovieRecord | null>(null);
  const [detailSeries, setDetailSeries] = useState<SeriesRecord | null>(null);
  const [activeSeasonNumber, setActiveSeasonNumber] = useState<number>(1);
  const [showDetailDownloads, setShowDetailDownloads] = useState(false);

  // Active Video Player State
  const [playingMedia, setPlayingMedia] = useState<PlayableMedia | null>(null);

  // Search Overlay State
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{
    movies: MovieRecord[];
    series: SeriesRecord[];
  }>({ movies: [], series: [] });
  const [isSearching, setIsSearching] = useState(false);

  // Watchlist & Favorites (localStorage + DB sync)
  const [watchlistKeys, setWatchlistKeys] = useState<string[]>([]);
  const [favoriteKeys, setFavoriteKeys] = useState<string[]>([]);

  // User Auth & Modals
  const [currentUser, setCurrentUser] = useState<ClientUser | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [premiumModalOpen, setPremiumModalOpen] = useState(false);
  const [legalPageModal, setLegalPageModal] = useState<
    "about" | "privacy" | "terms" | null
  >(null);

  // HIDDEN 4-CLICK LOGO ADMIN GESTURE STATE
  const logoClickCountRef = useRef<number>(0);
  const logoClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [adminDashboardOpen, setAdminDashboardOpen] = useState(false);

  /* ----------------------------------------------------------------
   * ADMIN ACCESS IS PERMANENTLY GRANTED (auth disabled for development)
   * Hardcoded true: no password, no token, no session, no expiry check.
   * There is no lifecycle hook, interval or timeout that can revoke it,
   * and no "session expired" message exists anywhere in the UI.
   * ---------------------------------------------------------------- */
  const isAdminAuthenticated = true;
  const isAdminUnlocked = true;

  // Restore whether the dashboard was left open (pure UI preference, not auth)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (safeGet("nazmovies_admin_open") === "1") setAdminDashboardOpen(true);
  }, []);

  const handleOpenAdminDashboard = () => {
    safeSet("nazmovies_admin_open", "1");
    setAdminDashboardOpen(true);
  };

  const handleCloseAdminDashboard = () => {
    safeSet("nazmovies_admin_open", "0");
    setAdminDashboardOpen(false);
  };

  const handleAdminLogout = () => {
    // Admin auth is disabled, so this only closes the dashboard.
    adminLogout();
    safeRemove("nazmovies_admin_open");
    setAdminDashboardOpen(false);
    setActiveNav("home");
    showToast(lang === "ar" ? "تم إغلاق لوحة التحكم" : "Dashboard closed");
  };

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3800);
  };

  // Load saved language, watchlist, and user session on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedLang = safeGet("nazmovies_lang") as Language | null;
    if (savedLang === "ar" || savedLang === "en") {
      setLang(savedLang);
      document.documentElement.lang = savedLang;
      document.documentElement.dir = savedLang === "ar" ? "rtl" : "ltr";
    } else {
      document.documentElement.lang = "ar";
      document.documentElement.dir = "rtl";
    }

    try {
      const savedWl = safeGet("nazmovies_watchlist");
      if (savedWl) setWatchlistKeys(JSON.parse(savedWl));
      const savedFav = safeGet("nazmovies_favorites");
      if (savedFav) setFavoriteKeys(JSON.parse(savedFav));
      const savedUser = safeGet("nazmovies_user");
      if (!savedUser) setAuthResolved(true);
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        setCurrentUser(parsed);
        // Refresh user status from DB using the signed session token
        if (safeGet(USER_TOKEN_KEY)) {
          userFetch("/api/auth")
            .then(async (r) => {
              const d = await r.json().catch(() => ({}));
              if (r.ok && d.user) {
                setCurrentUser(d.user);
                safeSet("nazmovies_user", JSON.stringify(d.user));
              } else if (r.status === 401) {
                // expired / invalid session
                setCurrentUser(null);
                safeRemove("nazmovies_user");
                safeRemove(USER_TOKEN_KEY);
              }
              setAuthResolved(true);
            })
            .catch(() => setAuthResolved(true));
        } else {
          // legacy session without token → require fresh login
          setCurrentUser(null);
          safeRemove("nazmovies_user");
          setAuthResolved(true);
        }
      }
    } catch {
      // Ignore storage parse error
      setAuthResolved(true);
    }
  }, []);

  // Update document direction whenever language changes
  const handleToggleLanguage = (nextLang?: Language) => {
    const target = nextLang || (lang === "ar" ? "en" : "ar");
    setLang(target);
    if (typeof window !== "undefined") {
      safeSet("nazmovies_lang", target);
      document.documentElement.lang = target;
      document.documentElement.dir = target === "ar" ? "rtl" : "ltr";
    }
  };

  // Scroll listener for Sticky Glass Header
  useEffect(() => {
    const onScroll = () => {
      setIsScrolled(window.scrollY > 30);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Load all data from API
  const fetchAllData = async () => {
    try {
      const [moviesRes, seriesRes, catRes, settingsRes] = await Promise.all([
        fetch("/api/movies"),
        fetch("/api/series"),
        fetch("/api/categories"),
        fetch("/api/settings"),
      ]);

      const [moviesData, seriesData, catData, settingsData] = await Promise.all(
        [
          moviesRes.json(),
          seriesRes.json(),
          catRes.json(),
          settingsRes.json(),
        ]
      );

      if (moviesData.movies) setMoviesList(moviesData.movies);
      if (seriesData.series) setSeriesList(seriesData.series);
      if (seriesData.seasons) setSeasonsList(seriesData.seasons);
      if (seriesData.episodes) setEpisodesList(seriesData.episodes);
      if (catData.categories) setCategoriesList(catData.categories);
      if (settingsData.settings) {
        setSettings(settingsData.settings);
      }
    } catch (err) {
      console.error("Failed to load platform data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Update Settings helper for Admin Dashboard
  const handleUpdateSettings = async (
    partial: Record<string, unknown>
  ): Promise<SaveResult> => {
    let res: Response;
    try {
      res = await adminFetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partial),
      });
    } catch (err) {
      console.error("[settings] network error", err);
      return { ok: false, error: String(err) };
    }
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.settings) {
      setSettings(data.settings);
      showToast(
        lang === "ar"
          ? "✅ تم تحديث إعدادات المنصة فوراً"
          : "✅ Platform settings updated"
      );
      return { ok: true, status: res.status };
    }
    console.error("[settings] save rejected", res.status, data);
    return { ok: false, status: res.status, error: data.error, fields: data.fields };
  };

  // ---------------- Real visitor analytics ----------------
  useEffect(() => {
    trackEvent("site_visit", { pageType: "home" });
  }, []);

  useEffect(() => {
    if (detailMovie) trackEvent("page_view", { pageType: "movie_detail", contentType: "movie", contentId: detailMovie.id });
    else if (detailSeries) trackEvent("page_view", { pageType: "series_detail", contentType: "series", contentId: detailSeries.id });
    else trackEvent("page_view", { pageType: activeNav });
  }, [activeNav, detailMovie?.id, detailSeries?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) return;
    const t = setTimeout(() => trackEvent("search", { pageType: "search", query: q }), 1200);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Keep browser title in sync with the central site name
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = `${siteName} | ${lang === "ar" ? "أفلام ومسلسلات" : "Movies & Series"}`;
    }
  }, [siteName, lang]);

  // ---------------- Watch history ----------------
  const fetchHistory = async () => {
    if (!safeGet(USER_TOKEN_KEY)) {
      setHistoryItems([]);
      return;
    }
    try {
      const res = await userFetch("/api/history");
      if (res.ok) {
        const d = await res.json();
        setHistoryItems(d.items || []);
      } else if (res.status === 401) {
        setHistoryItems([]);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (currentUser) fetchHistory();
    else setHistoryItems([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  const progressMap = useMemo(() => {
    const m = new Map<string, HistoryItem>();
    for (const it of historyItems) m.set(progressKey(it.mediaType, it.contentId, it.episodeId), it);
    return m;
  }, [historyItems]);

  const continueEntries = useMemo(
    () => buildContinueWatching(historyItems, episodesList),
    [historyItems, episodesList]
  );

  const resumeTimeFor = (mediaType: "movie" | "series", contentId: number, episodeId = 0) => {
    const it = progressMap.get(progressKey(mediaType, contentId, episodeId));
    if (!it || it.completed) return 0;
    return it.currentTime > 1 ? it.currentTime : 0;
  };

  /** For a series, pick the episode to continue (latest unfinished, else next after latest finished). */
  const continueEpisodeFor = (seriesId: number): EpisodeRecord | undefined => {
    const entry = continueEntries.find((e) => e.mediaType === "series" && e.contentId === seriesId);
    if (!entry) return undefined;
    return episodesList.find((e) => e.id === entry.episodeId);
  };

  const handleContinueEntry = (entry: ContinueEntry) => {
    if (entry.mediaType === "movie") {
      const m = moviesList.find((x) => x.id === entry.contentId);
      if (m) handlePlayMovie(m);
    } else {
      const s = seriesList.find((x) => x.id === entry.contentId);
      const ep = episodesList.find((e) => e.id === entry.episodeId);
      if (s) handlePlaySeries(s, ep);
    }
    setAuthModalOpen(false);
  };

  const handleResumeHistoryItem = (it: HistoryItem) => {
    handleContinueEntry({
      key: String(it.id), mediaType: it.mediaType, contentId: it.contentId, episodeId: it.episodeId,
      seasonNumber: it.seasonNumber, episodeNumber: it.episodeNumber, titleAr: it.titleAr, titleEn: it.titleEn,
      posterUrl: it.posterUrl, currentTime: it.currentTime, duration: it.duration,
      percent: percentOf(it.currentTime, it.duration), updatedAt: it.updatedAt, isNextEpisode: false,
    });
  };

  const handleClearHistory = async () => {
    const res = await userFetch("/api/history", { method: "DELETE" });
    if (res.ok) {
      setHistoryItems([]);
      showToast(translations[lang].historyCleared);
    }
  };

  // 4-CLICK LOGO HIDDEN ADMIN GESTURE HANDLER
  const handleLogoClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    logoClickCountRef.current += 1;
    const count = logoClickCountRef.current;

    // Start the 3-second window on the first click; reset if it expires
    if (count === 1) {
      if (logoClickTimerRef.current) clearTimeout(logoClickTimerRef.current);
      logoClickTimerRef.current = setTimeout(() => {
        logoClickCountRef.current = 0;
        logoClickTimerRef.current = null;
      }, 3000);
    }

    if (count >= 4) {
      logoClickCountRef.current = 0;
      if (logoClickTimerRef.current) {
        clearTimeout(logoClickTimerRef.current);
        logoClickTimerRef.current = null;
      }
      handleOpenAdminDashboard(); // always opens — no password check
      return;
    }

    // Normal logo behavior (return home) only on the first click of a sequence
    if (count === 1) {
      setActiveNav("home");
      setDetailMovie(null);
      setDetailSeries(null);
    }
  };

  // Featured Hero Slides combining featured Movies and Series
  const heroSlides = useMemo(() => {
    const featMovies = moviesList
      .filter((m) => m.isFeatured)
      .map((m) => ({ type: "movie" as const, item: m }));
    const featSeries = seriesList
      .filter((s) => s.isFeatured)
      .map((s) => ({ type: "series" as const, item: s }));
    const combined = [...featMovies, ...featSeries];
    if (combined.length > 0) return combined;
    return moviesList
      .slice(0, 4)
      .map((m) => ({ type: "movie" as const, item: m }));
  }, [moviesList, seriesList]);

  // Auto-advance Hero Carousel every 7 seconds
  useEffect(() => {
    if (heroSlides.length <= 1 || playingMedia || detailMovie || detailSeries)
      return;
    const interval = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroSlides.length);
    }, 7000);
    return () => clearInterval(interval);
  }, [heroSlides.length, playingMedia, detailMovie, detailSeries]);

  // Live Search Effect with Debounce & Search Analytics tracking
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults({ movies: [], series: [] });
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(trimmed)}&track=true`
        );
        const data = await res.json();
        setSearchResults({
          movies: data.movies || [],
          series: data.series || [],
        });
      } catch {
        // Ignore search error
      } finally {
        setIsSearching(false);
      }
    }, 280);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Watchlist & Favorites Toggle
  const toggleWatchlist = async (
    mediaType: "movie" | "series",
    mediaId: number,
    e?: React.MouseEvent
  ) => {
    if (e) e.stopPropagation();
    const key = `${mediaType}-${mediaId}`;
    const exists = watchlistKeys.includes(key);
    const updated = exists
      ? watchlistKeys.filter((k) => k !== key)
      : [...watchlistKeys, key];

    setWatchlistKeys(updated);
    if (typeof window !== "undefined") {
      safeSet("nazmovies_watchlist", JSON.stringify(updated));
    }

    showToast(
      exists
        ? lang === "ar"
          ? "تمت الإزالة من قائمتي"
          : "Removed from My List"
        : lang === "ar"
        ? "⭐ تمت الإضافة إلى قائمتي"
        : "⭐ Added to My List"
    );

    fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientKey: currentUser ? `user-${currentUser.id}` : "guest-default",
        mediaType,
        mediaId,
        listType: "watchlist",
      }),
    }).catch(() => {});
  };

  const toggleFavorite = async (
    mediaType: "movie" | "series",
    mediaId: number,
    e?: React.MouseEvent
  ) => {
    if (e) e.stopPropagation();
    const key = `${mediaType}-${mediaId}`;
    const exists = favoriteKeys.includes(key);
    const updated = exists
      ? favoriteKeys.filter((k) => k !== key)
      : [...favoriteKeys, key];

    setFavoriteKeys(updated);
    if (typeof window !== "undefined") {
      safeSet("nazmovies_favorites", JSON.stringify(updated));
    }

    showToast(
      exists
        ? lang === "ar"
          ? "تمت الإزالة من المفضلة"
          : "Removed from Favorites"
        : lang === "ar"
        ? "❤️ تمت الإضافة إلى المفضلة"
        : "❤️ Added to Favorites"
    );
  };

  // Launch Video Player for a Movie
  const handlePlayMovie = (m: MovieRecord, fromStart = false) => {
    trackEvent("movie_view", { pageType: "player", contentType: "movie", contentId: m.id });
    setPlayStartTime(fromStart ? 0 : resumeTimeFor("movie", m.id));
    setPlayingMedia({
      id: m.id,
      mediaType: "movie",
      titleAr: m.titleAr,
      titleEn: m.titleEn,
      subtitleAr: `${m.year} • ${m.genreAr}`,
      subtitleEn: `${m.year} • ${m.genreEn}`,
      posterUrl: m.posterUrl,
      backdropUrl: m.backdropUrl,
      videoUrl: m.videoUrl,
      hlsUrl: m.hlsUrl,
      quality: m.quality,
      servers: m.servers,
      downloadLinks: m.downloadLinks,
    });
  };

  // Launch Video Player for a Series Episode
  const handlePlaySeries = (s: SeriesRecord, ep?: EpisodeRecord, fromStart = false) => {
    const seriesEps = episodesList.filter((e) => e.seriesId === s.id);
    const targetEp = ep || continueEpisodeFor(s.id) || seriesEps[0];
    trackEvent("series_view", { pageType: "player", contentType: "series", contentId: s.id });
    if (targetEp) trackEvent("episode_view", { pageType: "player", contentType: "episode", contentId: targetEp.id });
    setPlayStartTime(
      fromStart || !targetEp ? 0 : resumeTimeFor("series", s.id, targetEp.id)
    );

    setPlayingMedia({
      id: s.id,
      mediaType: "series",
      titleAr: s.titleAr,
      titleEn: s.titleEn,
      subtitleAr: targetEp
        ? `الموسم ${targetEp.seasonNumber} • ${targetEp.titleAr}`
        : s.genreAr,
      subtitleEn: targetEp
        ? `Season ${targetEp.seasonNumber} • ${targetEp.titleEn}`
        : s.genreEn,
      posterUrl: s.posterUrl,
      backdropUrl: targetEp?.thumbnailUrl || s.backdropUrl,
      videoUrl: targetEp?.videoUrl || s.videoUrl,
      hlsUrl: targetEp?.hlsUrl || s.hlsUrl,
      quality: s.quality,
      servers:
        targetEp?.servers && targetEp.servers.length > 0
          ? targetEp.servers
          : s.servers,
      downloadLinks:
        targetEp?.downloadLinks && targetEp.downloadLinks.length > 0
          ? targetEp.downloadLinks
          : s.downloadLinks,
      episodeId: targetEp?.id,
      seasonNumber: targetEp?.seasonNumber || 1,
      episodeNumber: targetEp?.episodeNumber || 1,
    });
  };

  // Next Episode Handler inside Video Player
  const handleNextEpisode = () => {
    if (!playingMedia || playingMedia.mediaType !== "series") return;
    const parentSeries = seriesList.find((s) => s.id === playingMedia.id);
    if (!parentSeries) return;
    const seriesEps = episodesList.filter(
      (e) => e.seriesId === parentSeries.id
    );
    const currentIdx = seriesEps.findIndex(
      (e) => e.id === playingMedia.episodeId
    );
    if (currentIdx >= 0 && currentIdx + 1 < seriesEps.length) {
      handlePlaySeries(parentSeries, seriesEps[currentIdx + 1]);
    }
  };

  // Determine if Ads should be displayed for the current visitor/user
  const shouldShowAds = useMemo(() => {
    if (!authResolved) return false; // don't run ad tags before we know who the visitor is
    if (!settings.adsEnabled) return false;
    if (currentUser?.isPremium) {
      return Boolean(settings.adsForPremiumUsers);
    }
    return Boolean(settings.adsForFreeUsers);
  }, [
    authResolved,
    settings.adsEnabled,
    settings.adsForFreeUsers,
    settings.adsForPremiumUsers,
    currentUser?.isPremium,
  ]);

  // Organized Movie Sections (10 sections)
  const movieSections = useMemo(
    () => [
      {
        id: "popular-movies",
        title: t.popular,
        icon: "🔥",
        items: [...moviesList].sort((a, b) => b.viewsCount - a.viewsCount),
      },
      {
        id: "latest-movies",
        title: t.latest,
        icon: "✨",
        items: moviesList.filter((m) => m.isLatest),
      },
      {
        id: "top-rated-movies",
        title: t.topRated,
        icon: "🏆",
        items: [...moviesList].sort((a, b) => b.rating - a.rating),
      },
      {
        id: "action-movies",
        title: t.actionMovies,
        icon: "🎬",
        items: moviesList.filter((m) => m.genre === "action"),
      },
      {
        id: "drama-movies",
        title: t.dramaMovies,
        icon: "🎭",
        items: moviesList.filter((m) => m.genre === "drama"),
      },
      {
        id: "scifi-movies",
        title: t.scifiMovies,
        icon: "🚀",
        items: moviesList.filter((m) => m.genre === "scifi"),
      },
      {
        id: "comedy-movies",
        title: t.comedyMovies,
        icon: "😂",
        items: moviesList.filter((m) => m.genre === "comedy"),
      },
      {
        id: "horror-movies",
        title: t.horrorMovies,
        icon: "👻",
        items: moviesList.filter((m) => m.genre === "horror"),
      },
      {
        id: "romance-movies",
        title: t.romanceMovies,
        icon: "❤️",
        items: moviesList.filter((m) => m.genre === "romance"),
      },
      {
        id: "adventure-movies",
        title: t.adventureMovies,
        icon: "🧭",
        items: moviesList.filter(
          (m) => m.genre === "adventure" || m.genre === "mystery"
        ),
      },
    ],
    [moviesList, t]
  );

  // Organized Series Sections (8 sections)
  const seriesSections = useMemo(
    () => [
      {
        id: "popular-series",
        title: t.popularSeries,
        icon: "📺",
        items: [...seriesList].sort((a, b) => b.viewsCount - a.viewsCount),
      },
      {
        id: "latest-series",
        title: t.latestSeries,
        icon: "🌟",
        items: seriesList.filter((s) => s.isLatest),
      },
      {
        id: "top-rated-series",
        title: t.topRatedSeries,
        icon: "🏆",
        items: [...seriesList].sort((a, b) => b.rating - a.rating),
      },
      {
        id: "arabic-series",
        title: t.arabicSeries,
        icon: "🌙",
        items: seriesList.filter((s) => s.originType === "arabic"),
      },
      {
        id: "foreign-series",
        title: t.foreignSeries,
        icon: "🌎",
        items: seriesList.filter((s) => s.originType === "foreign"),
      },
      {
        id: "action-series",
        title: t.actionSeries,
        icon: "🔥",
        items: seriesList.filter((s) => s.genre === "action"),
      },
      {
        id: "crime-series",
        title: t.crimeSeries,
        icon: "🕵️",
        items: seriesList.filter((s) => s.genre === "crime"),
      },
      {
        id: "scifi-series",
        title: t.scifiSeries,
        icon: "🚀",
        items: seriesList.filter((s) => s.genre === "scifi"),
      },
    ],
    [seriesList, t]
  );

  const currentHero = heroSlides[heroIndex] || heroSlides[0];

  return (
    <div
      dir={lang === "ar" ? "rtl" : "ltr"}
      className="min-h-screen bg-[color:var(--background-color)] text-[color:var(--text-color)] flex flex-col pb-20 md:pb-0"
    >
      {/* Maintenance Mode Banner if enabled in Admin Settings */}
      {settings.maintenanceMode && (
        <div className="bg-gradient-to-r from-[#7A0509] via-[color:var(--accent-color)] to-[#7A0509] text-[color:var(--text-color)] text-xs font-bold px-4 py-2 text-center flex items-center justify-center gap-2 z-[90]">
          <ShieldAlert className="w-4 h-4" />
          <span>
            {lang === "ar"
              ? "وضع الصيانة مفعل حالياً — يتم تحديث بعض سيرفرات البث المباشر"
              : "Maintenance Mode is active — Streaming servers are undergoing scheduled upgrades"}
          </span>
        </div>
      )}

      {/* STICKY GLASS HEADER */}
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          isScrolled
            ? "bg-[var(--header-color)]/90 backdrop-blur-2xl border-b border-[color:var(--primary-color)]/20 shadow-[0_10px_40px_rgba(0,0,0,0.85)] py-3"
            : "bg-gradient-to-b from-[var(--header-color)]/90 via-[var(--header-color)]/50 to-transparent backdrop-blur-md border-b border-white/5 py-4"
        }`}
      >
        <div className="max-w-[1440px] mx-auto px-3 sm:px-8 flex items-center justify-between gap-2 sm:gap-4">
          {/* Brand Logo (Click 4 consecutive times for Hidden Admin Access) */}
          <div className="flex items-center gap-6 min-w-0">
            <button
              type="button"
              onClick={handleLogoClick}
              data-testid="naz-logo"
              style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
              className="flex items-center gap-2 sm:gap-3 min-w-0 text-left rtl:text-right group select-none focus:outline-none cursor-pointer"
              title={siteName}
            >
              <SiteLogoMark logoUrl={settings.logoUrl} />
              <div className="min-w-0">
                <div data-testid="site-name" className="text-sm sm:text-2xl font-black tracking-wider bg-gradient-to-r from-white via-[color:var(--primary-color)] to-[color:var(--secondary-color)] bg-clip-text text-transparent truncate">
                  {siteName}
                </div>
                <div className="text-[10px] sm:text-[11px] font-bold text-[color:var(--primary-color)] tracking-widest -mt-0.5 sm:-mt-1 truncate">
                  {t.brandSubtitle}
                </div>
              </div>
            </button>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-1 rounded-2xl px-1 py-1" style={{ background: "var(--nav-color)" }}>
              {(
                [
                  { id: "home", label: t.home },
                  { id: "movies", label: t.movies },
                  { id: "series", label: t.series },
                  { id: "categories", label: t.categories },
                  {
                    id: "mylist",
                    label: `${t.myList} (${watchlistKeys.length})`,
                  },
                ] as const
              ).map((item) => {
                const active =
                  activeNav === item.id && !detailMovie && !detailSeries;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveNav(item.id);
                      setDetailMovie(null);
                      setDetailSeries(null);
                    }}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                      active
                        ? "bg-[color:var(--primary-color)] text-black shadow-[0_0_20px_color-mix(in_srgb,var(--primary-color)_35%,transparent)]"
                        : "text-[color:var(--text-secondary-color)] hover:text-[color:var(--text-color)] hover:bg-white/5"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
              <button
                type="button"
                data-testid="nav-contact"
                onClick={() => setContactOpen(true)}
                className="px-4 py-2 rounded-xl text-sm font-bold text-[color:var(--text-secondary-color)] hover:text-[color:var(--text-color)] hover:bg-white/5 transition-all"
              >
                {t.contactUs}
              </button>
            </nav>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
            {/* Request a Movie Button */}
            {settings.movieRequestsEnabled && (
              <button
                type="button"
                onClick={() => setRequestModalOpen(true)}
                className="hidden xl:flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-[color:var(--border-color)] text-xs font-bold text-zinc-200 hover:border-[color:var(--primary-color)]/50 transition"
              >
                <MessageSquarePlus className="w-4 h-4 text-[color:var(--primary-color)]" />
                <span>{t.requestMovie}</span>
              </button>
            )}

            {/* Upgrade to Ad-Free / Premium Status Button */}
            {settings.premiumFeaturesEnabled && (
              <button
                type="button"
                onClick={() => setPremiumModalOpen(true)}
                className={`hidden md:flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black border transition ${
                  currentUser?.isPremium
                    ? "bg-[color:var(--primary-color)]/20 text-[color:var(--primary-color)] border-[color:var(--primary-color)]/50"
                    : "bg-gradient-to-r from-[color:var(--primary-color)]/15 to-[color:var(--accent-color)]/15 text-[color:var(--primary-color)] border-[color:var(--primary-color)]/40 hover:bg-[color:var(--primary-color)] hover:text-black"
                }`}
              >
                <Crown className="w-4 h-4" />
                <span>
                  {currentUser?.isPremium ? t.premiumBadge : t.upgradeAdFree}
                </span>
              </button>
            )}

            {/* Search Trigger */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-[color:var(--border-color)] text-zinc-200 hover:border-[color:var(--primary-color)]/40 transition"
              title={t.search}
            >
              <Search className="w-4 h-4 text-[color:var(--primary-color)]" />
              <span className="hidden sm:inline text-xs font-semibold">
                {t.search}
              </span>
            </button>

            {/* Instant Language Toggle: single button on phones, AR | EN pills from sm up */}
            <button
              type="button"
              onClick={() => handleToggleLanguage(lang === "ar" ? "en" : "ar")}
              className="sm:hidden px-2.5 py-2 rounded-xl bg-white/5 border border-[color:var(--border-color)] text-[11px] font-black text-[color:var(--primary-color)] flex-shrink-0"
              title={t.language}
            >
              {lang === "ar" ? "EN" : "ع"}
            </button>
            <div className="hidden sm:flex items-center rounded-xl bg-white/5 p-1 border border-[color:var(--border-color)]">
              <button
                type="button"
                onClick={() => handleToggleLanguage("ar")}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition ${
                  lang === "ar"
                    ? "bg-[color:var(--primary-color)] text-black shadow"
                    : "text-[color:var(--text-secondary-color)] hover:text-[color:var(--text-color)]"
                }`}
              >
                العربية
              </button>
              <button
                type="button"
                onClick={() => handleToggleLanguage("en")}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition ${
                  lang === "en"
                    ? "bg-[color:var(--primary-color)] text-black shadow"
                    : "text-[color:var(--text-secondary-color)] hover:text-[color:var(--text-color)]"
                }`}
              >
                EN
              </button>
            </div>

            {/* User Account / Login Button */}
            <button
              type="button"
              onClick={() => {
                setAuthInitialTab("continue");
                setAuthModalOpen(true);
              }}
              className="flex items-center gap-2 px-2.5 sm:px-3.5 py-2 rounded-xl bg-white/5 hover:bg-[color:var(--primary-color)] hover:text-black border border-[color:var(--border-color)] text-xs font-bold text-[color:var(--text-color)] transition"
            >
              <User className="w-4 h-4 text-[color:var(--primary-color)] group-hover:text-black" />
              <span className="hidden sm:inline max-w-[110px] truncate">
                {currentUser ? currentUser.name : t.login}
              </span>
            </button>

            {/* Admin dashboard — always visible and always accessible */}
            <button
              type="button"
              data-testid="admin-open-btn"
              onClick={handleOpenAdminDashboard}
              className="inline-flex p-2 rounded-xl bg-[color:var(--primary-color)] text-black font-black shadow-[0_0_15px_color-mix(in_srgb,var(--primary-color)_50%,transparent)]"
              title={t.adminDashboard}
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl bg-white/5 border border-[color:var(--border-color)] text-[color:var(--text-color)]"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden px-4 pt-3 pb-4 bg-[color:var(--header-color)] border-b border-[color:var(--border-color)] space-y-2 mt-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                data-testid="mobile-contact"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setContactOpen(true);
                }}
                className="col-span-2 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#229ED9]/15 border border-[#229ED9]/40 text-xs font-bold text-[#229ED9]"
              >
                <MessageSquarePlus className="w-4 h-4" />
                <span>{t.contactUs}</span>
              </button>
              {currentUser && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setAuthInitialTab("history");
                    setAuthModalOpen(true);
                  }}
                  className="col-span-2 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 border border-[color:var(--border-color)] text-xs font-bold text-[color:var(--text-color)]"
                >
                  <Clock className="w-4 h-4" />
                  <span>{t.watchHistory}</span>
                </button>
              )}
              {settings.movieRequestsEnabled && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setRequestModalOpen(true);
                  }}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 border border-[color:var(--border-color)] text-xs font-bold text-[color:var(--primary-color)]"
                >
                  <MessageSquarePlus className="w-4 h-4" />
                  <span>{t.requestMovie}</span>
                </button>
              )}
              {settings.premiumFeaturesEnabled && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setPremiumModalOpen(true);
                  }}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[color:var(--primary-color)]/15 border border-[color:var(--primary-color)]/40 text-xs font-bold text-[color:var(--primary-color)]"
                >
                  <Crown className="w-4 h-4" />
                  <span>{t.upgradeAdFree}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Header banner ad */}
      <BannerAd slot={settings.adConfig?.bannerHeader} enabled={shouldShowAds} testId="ad-banner-header" className="py-2" />

      {/* DETAILS VIEW FOR A SELECTED MOVIE OR SERIES */}
      {(detailMovie || detailSeries) && (
        <section className="relative min-h-0 sm:min-h-[82vh] pb-8 sm:pb-16 animate-fadeIn">
          {/* Full Backdrop with Cinematic Vignette */}
          <div className="relative h-[34vh] max-h-[240px] sm:h-[64vh] sm:max-h-none short:h-[38vh] short:max-h-none w-full overflow-hidden">
            <img
              src={detailMovie?.backdropUrl || detailSeries?.backdropUrl}
              alt=""
              className="w-full h-full object-cover scale-105 filter brightness-75"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--background-color)] via-[color:var(--background-color)]/75 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[color:var(--background-color)] via-transparent to-[color:var(--background-color)]/80" />

            <div className="absolute top-3 sm:top-6 left-4 sm:left-8 rtl:left-auto rtl:right-4 sm:rtl:right-8 z-20">
              <button
                type="button"
                onClick={() => {
                  setDetailMovie(null);
                  setDetailSeries(null);
                  setShowDetailDownloads(false);
                }}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl liquid-glass text-[11px] sm:text-xs font-bold text-[color:var(--text-color)] hover:border-[color:var(--primary-color)] transition"
              >
                {lang === "ar" ? (
                  <ChevronRight className="w-4 h-4 text-[color:var(--primary-color)]" />
                ) : (
                  <ChevronLeft className="w-4 h-4 text-[color:var(--primary-color)]" />
                )}
                <span>
                  {lang === "ar" ? "العودة إلى التصفح" : "Back to Catalog"}
                </span>
              </button>
            </div>
          </div>

          {/* Details Content Card */}
          <div className="max-w-[1380px] mx-auto px-3 sm:px-8 -mt-16 sm:-mt-56 short:-mt-12 relative z-20">
            <div className="liquid-glass rounded-2xl sm:rounded-3xl p-4 sm:p-10 shadow-[0_25px_90px_rgba(0,0,0,0.9)] border border-[color:var(--border-color)]">
              <div className="block md:grid md:grid-cols-12 md:gap-8 md:items-start">
                {/* Poster */}
                <div className="float-start w-24 xs:w-28 sm:w-36 me-3 sm:me-5 mb-2 md:float-none md:w-auto md:me-0 md:mb-0 md:col-span-4 lg:col-span-3">
                  <div className="relative rounded-xl sm:rounded-2xl overflow-hidden border-2 border-[color:var(--primary-color)]/40 shadow-[0_0_40px_color-mix(in_srgb,var(--primary-color)_25%,transparent)] aspect-[2/3]">
                    <img
                      src={detailMovie?.posterUrl || detailSeries?.posterUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-1.5 left-1.5 sm:top-3 sm:left-3 px-1.5 sm:px-3 py-0.5 sm:py-1 rounded-md sm:rounded-lg bg-[color:var(--primary-color)] text-black font-black text-[10px] sm:text-xs">
                      {detailMovie?.quality || detailSeries?.quality || "4K"}
                    </div>
                  </div>
                </div>

                {/* Metadata & Actions */}
                <div className="md:col-span-8 lg:col-span-9 space-y-3.5 sm:space-y-6">
                  <div className="space-y-1.5 sm:space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <span className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-[color:var(--accent-color)] text-[color:var(--text-color)] text-[10px] sm:text-xs font-black">
                        {detailMovie ? "MOVIE • فيلم" : "SERIES • مسلسل"}
                      </span>
                      <span className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-[color:var(--primary-color)]/15 border border-[color:var(--primary-color)]/40 text-[color:var(--primary-color)] text-[10px] sm:text-xs font-bold flex items-center gap-1">
                        <Star className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" />
                        {detailMovie?.rating || detailSeries?.rating}
                      </span>
                      <span className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-white/10 text-zinc-200 text-[10px] sm:text-xs font-semibold">
                        {detailMovie?.year || detailSeries?.year}
                      </span>
                      {detailMovie && (
                        <span className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-white/10 text-zinc-200 text-[10px] sm:text-xs font-semibold">
                          {detailMovie.duration}
                        </span>
                      )}
                      {detailSeries && (
                        <span className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-white/10 text-zinc-200 text-[10px] sm:text-xs font-semibold">
                          {detailSeries.seasonsCount} {t.seasons} •{" "}
                          {detailSeries.episodesCount} {t.episodes}
                        </span>
                      )}
                    </div>

                    <h1 className="text-xl sm:text-4xl lg:text-5xl font-black text-[color:var(--text-color)] leading-tight">
                      {lang === "ar"
                        ? detailMovie?.titleAr || detailSeries?.titleAr
                        : detailMovie?.titleEn || detailSeries?.titleEn}
                    </h1>
                    <p className="text-xs sm:text-base font-semibold text-[color:var(--primary-color)] line-clamp-1 sm:line-clamp-none">
                      {lang === "ar"
                        ? detailMovie?.titleEn || detailSeries?.titleEn
                        : detailMovie?.titleAr || detailSeries?.titleAr}
                    </p>
                  </div>

                  <p className="clear-start md:clear-none text-xs sm:text-base text-zinc-200 leading-relaxed max-w-3xl line-clamp-3 sm:line-clamp-none short:line-clamp-2 pt-1 sm:pt-0">
                    {lang === "ar"
                      ? detailMovie?.descriptionAr ||
                        detailSeries?.descriptionAr
                      : detailMovie?.descriptionEn ||
                        detailSeries?.descriptionEn}
                  </p>

                  {/* Metadata Grid: Genre, Country, Director, Cast */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-3 p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-black/50 border border-[color:var(--border-color)] text-[11px] sm:text-xs">
                    <div className="flex items-center gap-2">
                      <Clapperboard className="w-4 h-4 text-[color:var(--primary-color)]" />
                      <span className="text-[color:var(--text-secondary-color)]">{t.genre}:</span>
                      <span className="font-bold text-[color:var(--text-color)]">
                        {lang === "ar"
                          ? detailMovie?.genreAr || detailSeries?.genreAr
                          : detailMovie?.genreEn || detailSeries?.genreEn}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-[color:var(--primary-color)]" />
                      <span className="text-[color:var(--text-secondary-color)]">{t.country}:</span>
                      <span className="font-bold text-[color:var(--text-color)]">
                        {lang === "ar"
                          ? detailMovie?.countryAr || detailSeries?.countryAr
                          : detailMovie?.countryEn || detailSeries?.countryEn}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Film className="w-4 h-4 text-[color:var(--primary-color)]" />
                      <span className="text-[color:var(--text-secondary-color)]">{t.director}:</span>
                      <span className="font-bold text-[color:var(--text-color)]">
                        {lang === "ar"
                          ? detailMovie?.directorAr || detailSeries?.directorAr
                          : detailMovie?.directorEn || detailSeries?.directorEn}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <UsersIcon className="w-4 h-4 text-[color:var(--primary-color)]" />
                      <span className="text-[color:var(--text-secondary-color)]">{t.cast}:</span>
                      <span className="font-bold text-[color:var(--text-color)] truncate">
                        {lang === "ar"
                          ? detailMovie?.castAr || detailSeries?.castAr
                          : detailMovie?.castEn || detailSeries?.castEn}
                      </span>
                    </div>
                  </div>

                  {/* Resume info (per-account progress) */}
                  {(() => {
                    const resumeEp = detailSeries ? continueEpisodeFor(detailSeries.id) : undefined;
                    const resumeAt = detailMovie
                      ? resumeTimeFor("movie", detailMovie.id)
                      : detailSeries && resumeEp
                      ? resumeTimeFor("series", detailSeries.id, resumeEp.id)
                      : 0;
                    if (!currentUser || (!resumeAt && !resumeEp)) return null;
                    return (
                      <div data-testid="resume-banner" className="flex flex-wrap items-center gap-3 p-3.5 rounded-2xl bg-[color:var(--primary-color)]/10 border border-[color:var(--primary-color)]/40">
                        <div className="text-xs font-bold text-[color:var(--text-color)]">
                          {resumeEp && (
                            <span className="text-[color:var(--primary-color)]">
                              {t.season} {resumeEp.seasonNumber} • {t.episode} {resumeEp.episodeNumber}
                              {" — "}
                            </span>
                          )}
                          {resumeAt > 0 ? (
                            <span data-testid="resume-text">{t.continueFrom} {formatClock(resumeAt)}</span>
                          ) : (
                            <span>{t.continueFromEpisode} {resumeEp?.episodeNumber}</span>
                          )}
                        </div>
                        <button
                          type="button"
                          data-testid="continue-watching-btn"
                          onClick={() => (detailMovie ? handlePlayMovie(detailMovie) : detailSeries && handlePlaySeries(detailSeries, resumeEp))}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl naz-btn text-black text-xs font-black"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>{t.continueWatching}</span>
                        </button>
                        {resumeAt > 0 && (
                          <button
                            type="button"
                            onClick={() => (detailMovie ? handlePlayMovie(detailMovie, true) : detailSeries && handlePlaySeries(detailSeries, resumeEp, true))}
                            className="px-3 py-2 rounded-xl bg-white/10 text-[color:var(--text-color)] text-xs font-bold"
                          >
                            {t.startOver}
                          </button>
                        )}
                      </div>
                    );
                  })()}

                  {/* Primary Action Buttons: Watch Now, Add to My List, Favorites, Download */}
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-0.5 sm:pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        detailMovie
                          ? handlePlayMovie(detailMovie)
                          : detailSeries
                          ? handlePlaySeries(detailSeries)
                          : null
                      }
                      className="flex items-center gap-2 sm:gap-2.5 px-5 sm:px-7 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl naz-btn text-black font-black text-xs sm:text-sm shadow-[0_0_30px_color-mix(in_srgb,var(--primary-color)_45%,transparent)] hover:scale-[1.02] transition"
                    >
                      <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                      <span>{t.watchMovieNow}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        detailMovie
                          ? toggleWatchlist("movie", detailMovie.id)
                          : detailSeries
                          ? toggleWatchlist("series", detailSeries.id)
                          : null
                      }
                      className="flex items-center gap-2 px-3.5 sm:px-5 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl bg-white/10 hover:bg-white/15 border border-[color:var(--border-color)] text-[color:var(--text-color)] font-bold text-xs transition"
                    >
                      {watchlistKeys.includes(
                        detailMovie
                          ? `movie-${detailMovie.id}`
                          : `series-${detailSeries?.id}`
                      ) ? (
                        <>
                          <Check className="w-4 h-4 text-[color:var(--primary-color)]" />
                          <span>{t.inMyList}</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 text-[color:var(--primary-color)]" />
                          <span>{t.addToMyList}</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        detailMovie
                          ? toggleFavorite("movie", detailMovie.id)
                          : detailSeries
                          ? toggleFavorite("series", detailSeries.id)
                          : null
                      }
                      className="flex items-center gap-2 px-3.5 sm:px-5 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl bg-white/10 hover:bg-[color:var(--accent-color)]/20 border border-[color:var(--border-color)] text-[color:var(--text-color)] font-bold text-xs transition"
                    >
                      <Heart
                        className={`w-4 h-4 ${
                          favoriteKeys.includes(
                            detailMovie
                              ? `movie-${detailMovie.id}`
                              : `series-${detailSeries?.id}`
                          )
                            ? "text-[color:var(--accent-color)] fill-current"
                            : "text-[color:var(--text-secondary-color)]"
                        }`}
                      />
                      <span>{t.addToFavorites}</span>
                    </button>

                    {settings.downloadsEnabled && (
                      <button
                        type="button"
                        onClick={() =>
                          setShowDetailDownloads(!showDetailDownloads)
                        }
                        className="flex items-center gap-2 px-3.5 sm:px-5 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl bg-[color:var(--primary-color)]/15 hover:bg-[color:var(--primary-color)] text-[color:var(--primary-color)] hover:text-black border border-[color:var(--primary-color)]/40 font-black text-xs transition"
                      >
                        <Download className="w-4 h-4" />
                        <span>{t.download} (4K / 1080p / 720p)</span>
                      </button>
                    )}
                  </div>

                  {/* Direct Download Links Panel inside Details */}
                  {showDetailDownloads && settings.downloadsEnabled && (
                    <div className="p-4 rounded-2xl bg-black/70 border border-[color:var(--primary-color)]/40 space-y-3 animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-[color:var(--primary-color)] flex items-center gap-2">
                          <Download className="w-4 h-4" />
                          <span>{t.downloadOptions}</span>
                        </h4>
                        <span className="text-[11px] text-[color:var(--text-secondary-color)]">
                          {t.authorizedDownloadNote}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {(
                          detailMovie?.downloadLinks ||
                          detailSeries?.downloadLinks ||
                          buildDefaultDownloads(
                            detailMovie?.videoUrl ||
                              detailSeries?.videoUrl ||
                              ""
                          )
                        )
                          .filter((d) => d.isEnabled !== false)
                          .map((dl) => (
                            <a
                              key={dl.id}
                              href={dl.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              download
                              className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-[color:var(--primary-color)]/15 border border-[color:var(--border-color)] hover:border-[color:var(--primary-color)] transition"
                            >
                              <div>
                                <span className="px-2 py-0.5 rounded bg-[color:var(--primary-color)] text-black text-xs font-black">
                                  {dl.quality}
                                </span>
                                <span className="text-xs font-bold text-[color:var(--text-color)] mx-2">
                                  {dl.size}
                                </span>
                                <p className="text-[11px] text-[color:var(--text-secondary-color)] mt-1">
                                  {dl.format}
                                </p>
                              </div>
                              <Download className="w-4 h-4 text-[color:var(--primary-color)]" />
                            </a>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Quick Video Servers Preview Pills (Server 1..6) */}
                  <div className="p-4 rounded-2xl bg-black/50 border border-[color:var(--border-color)] space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-[color:var(--primary-color)]">
                      <Server className="w-4 h-4" />
                      <span>{t.videoServers} (1–{settings.maxVideoServers}):</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {(
                        detailMovie?.servers ||
                        detailSeries?.servers ||
                        buildDefaultServers(
                          detailMovie?.videoUrl || detailSeries?.videoUrl || ""
                        )
                      )
                        .filter((s) => s.isEnabled !== false)
                        .slice(0, settings.maxVideoServers)
                        .map((srv) => (
                          <button
                            key={srv.id}
                            type="button"
                            onClick={() =>
                              detailMovie
                                ? handlePlayMovie(detailMovie)
                                : detailSeries
                                ? handlePlaySeries(detailSeries)
                                : null
                            }
                            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-[color:var(--primary-color)] hover:text-black text-zinc-200 border border-[color:var(--border-color)] text-xs font-bold transition"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>
                              {lang === "ar"
                                ? `سيرفر ${srv.id}`
                                : `Server ${srv.id}`}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-black/30 text-[10px]">
                              {srv.quality}
                            </span>
                          </button>
                        ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* SERIES SEASONS & EPISODES SELECTOR */}
              {detailSeries && (
                <div className="mt-10 pt-8 border-t border-[color:var(--border-color)] space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <h3 className="text-lg sm:text-xl font-black text-[color:var(--text-color)] flex items-center gap-2">
                      <Tv className="w-5 h-5 text-[color:var(--primary-color)]" />
                      <span>
                        {t.seasons} & {t.episodes}
                      </span>
                    </h3>

                    {/* Season Tabs: Season 1, Season 2, Season 3 */}
                    <div className="flex items-center gap-2">
                      {[1, 2, 3].map((sNum) => (
                        <button
                          key={sNum}
                          type="button"
                          onClick={() => setActiveSeasonNumber(sNum)}
                          className={`px-4 py-2 rounded-xl text-xs font-black transition ${
                            activeSeasonNumber === sNum
                              ? "bg-[color:var(--primary-color)] text-black shadow-[0_0_20px_color-mix(in_srgb,var(--primary-color)_35%,transparent)]"
                              : "bg-white/5 text-[color:var(--text-secondary-color)] hover:bg-white/10"
                          }`}
                        >
                          {t.season} {sNum}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Episodes Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {episodesList
                      .filter(
                        (ep) =>
                          ep.seriesId === detailSeries.id &&
                          ep.seasonNumber === activeSeasonNumber
                      )
                      .map((ep) => (
                        <div
                          key={ep.id}
                          onClick={() => handlePlaySeries(detailSeries, ep)}
                          className="group cursor-pointer flex items-center gap-4 p-3.5 rounded-2xl bg-black/60 border border-[color:var(--border-color)] hover:border-[color:var(--primary-color)] transition"
                        >
                          <div className="relative w-36 h-22 rounded-xl overflow-hidden flex-shrink-0">
                            <img
                              src={ep.thumbnailUrl || detailSeries.backdropUrl}
                              alt=""
                              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                            />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                              <div className="w-9 h-9 rounded-full bg-[color:var(--primary-color)] text-black flex items-center justify-center shadow-lg group-hover:scale-110 transition">
                                <Play className="w-4 h-4 fill-current" />
                              </div>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-black text-[color:var(--primary-color)]">
                                {t.episode} {ep.episodeNumber}
                              </span>
                              <span className="text-[11px] text-[color:var(--text-secondary-color)]">
                                {ep.duration}
                              </span>
                            </div>
                            <h4 className="text-sm font-bold text-[color:var(--text-color)] truncate mt-0.5">
                              {lang === "ar" ? ep.titleAr : ep.titleEn}
                            </h4>
                            <p className="text-xs text-[color:var(--text-secondary-color)] line-clamp-2 mt-1">
                              {lang === "ar"
                                ? ep.descriptionAr
                                : ep.descriptionEn}
                            </p>
                            {currentUser && (() => {
                              const pr = progressMap.get(progressKey("series", detailSeries.id, ep.id));
                              const pctv = pr ? (pr.completed ? 100 : percentOf(pr.currentTime, pr.duration)) : 0;
                              return (
                                <div className="mt-2 space-y-1" data-testid={`ep-status-${ep.id}`}>
                                  <span className={`text-[10px] font-black ${pr?.completed ? "text-emerald-400" : pr ? "text-[color:var(--primary-color)]" : "text-zinc-500"}`}>
                                    {pr?.completed ? t.watchedBadge : pr ? `${pctv}% • ${formatClock(pr.currentTime)}` : t.notStarted}
                                  </span>
                                  {pr && (
                                    <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                                      <div className={`h-full ${pr.completed ? "bg-emerald-400" : "bg-[color:var(--primary-color)]"}`} style={{ width: `${pctv}%` }} />
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* MAIN CATALOG VIEW WHEN NO DETAIL PAGE IS OPEN */}
      {!detailMovie && !detailSeries && (
        <main className="flex-1">
          {/* 1. CINEMATIC HERO CAROUSEL (Shown on Home) */}
          {activeNav === "home" && currentHero && (
            <section className="relative h-[62vh] max-h-[480px] min-h-[380px] sm:h-auto sm:max-h-none sm:min-h-[70vh] short:min-h-0 short:max-h-[58vh] w-full flex items-end overflow-hidden">
              {/* Background Image + Film Strip & Glow Overlays */}
              <div className="absolute inset-0 z-0">
                <img
                  src={
                    currentHero.item.backdropUrl ||
                    "/images/hero-cinema-gold.jpg"
                  }
                  alt=""
                  className="w-full h-full object-cover object-center scale-105 transition-all duration-1000 filter brightness-[0.65]"
                />
                {/* Cinematic Gradients */}
                <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--background-color)] via-[color:var(--background-color)]/75 sm:via-[color:var(--background-color)]/50 to-black/40 sm:to-black/60" />
                <div className="absolute inset-0 bg-gradient-to-r from-[color:var(--background-color)] via-[color:var(--background-color)]/70 to-transparent" />
                <div className="absolute inset-0 opacity-40 pointer-events-none" style={{ background: "var(--hero-color)" }} />
                {/* Golden & Crimson Ambient Glows */}
                <div className="absolute -top-24 right-1/4 w-96 h-96 rounded-full bg-[color:var(--primary-color)]/15 blur-[130px] pointer-events-none" />
                <div className="absolute bottom-10 left-1/4 w-96 h-96 rounded-full bg-[color:var(--accent-color)]/15 blur-[140px] pointer-events-none" />
              </div>

              <div className="max-w-[1440px] mx-auto px-4 sm:px-8 w-full relative z-10 pt-6 pb-16 sm:pt-20 sm:pb-24 short:pt-4 short:pb-12">
                <div className="max-w-2xl space-y-2.5 sm:space-y-5">
                  {/* Cinema Decorative Badges */}
                  <div className="hidden sm:inline-flex flex-wrap items-center gap-2 px-4 py-1.5 rounded-full liquid-glass border border-[color:var(--primary-color)]/40 text-xs">
                    <span>🎬</span>
                    <span className="text-[color:var(--text-secondary-color)]">{t.welcomePrefix}</span>
                    <span className="font-black text-[color:var(--primary-color)]">
                      NAZMOVIES
                    </span>
                    <span className="text-[color:var(--text-color)]/40">|</span>
                    <span className="font-bold text-[color:var(--text-color)]">
                      {t.brandSubtitle}
                    </span>
                    <span>🍿</span>
                  </div>

                  {/* Hero Tagline */}
                  <p className="hidden xs:block text-[11px] sm:text-sm font-bold text-[color:var(--primary-color)] tracking-wide line-clamp-1">
                    &ldquo;{t.heroTagline}&rdquo;
                  </p>

                  {/* Active Slide Title */}
                  <h1 className="text-2xl sm:text-5xl lg:text-6xl font-black text-[color:var(--text-color)] leading-tight drop-shadow-[0_10px_30px_rgba(0,0,0,0.9)]">
                    {lang === "ar"
                      ? currentHero.item.titleAr
                      : currentHero.item.titleEn}
                  </h1>

                  {/* Slide Metadata Badges */}
                  <div className="flex flex-nowrap sm:flex-wrap items-center gap-1.5 sm:gap-2.5 text-[11px] sm:text-xs font-bold overflow-hidden">
                    <span className="px-3 py-1 rounded-lg bg-[color:var(--primary-color)] text-black font-black flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      {currentHero.item.rating}
                    </span>
                    <span className="px-3 py-1 rounded-lg bg-[color:var(--accent-color)] text-[color:var(--text-color)] font-black">
                      {currentHero.item.quality}
                    </span>
                    <span className="px-3 py-1 rounded-lg bg-white/10 backdrop-blur-md text-[color:var(--text-color)]">
                      {currentHero.item.year}
                    </span>
                    <span className="px-2.5 sm:px-3 py-1 rounded-lg bg-white/10 backdrop-blur-md text-[color:var(--primary-color)] whitespace-nowrap">
                      {lang === "ar"
                        ? currentHero.item.genreAr
                        : currentHero.item.genreEn}
                    </span>
                    <span className="hidden sm:inline-block px-3 py-1 rounded-lg bg-white/10 backdrop-blur-md text-zinc-200">
                      6 {t.videoServers}
                    </span>
                  </div>

                  {/* Slide Description */}
                  <p className="text-xs sm:text-base text-zinc-200 line-clamp-2 sm:line-clamp-3 short:hidden leading-relaxed">
                    {lang === "ar"
                      ? currentHero.item.descriptionAr
                      : currentHero.item.descriptionEn}
                  </p>

                  {/* Hero CTA Buttons: Watch Now + Details */}
                  <div className="flex flex-nowrap sm:flex-wrap items-center gap-2 sm:gap-3.5 pt-0.5 sm:pt-2">
                    <button
                      type="button"
                      onClick={() =>
                        currentHero.type === "movie"
                          ? handlePlayMovie(currentHero.item as MovieRecord)
                          : handlePlaySeries(currentHero.item as SeriesRecord)
                      }
                      className="flex items-center gap-2 sm:gap-2.5 px-5 sm:px-8 py-2.5 sm:py-4 rounded-xl sm:rounded-2xl naz-btn text-black font-black text-xs sm:text-base shadow-[0_0_35px_color-mix(in_srgb,var(--primary-color)_50%,transparent)] hover:scale-105 transition whitespace-nowrap"
                    >
                      <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                      <span>{t.watchNow}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        currentHero.type === "movie"
                          ? setDetailMovie(currentHero.item as MovieRecord)
                          : setDetailSeries(currentHero.item as SeriesRecord)
                      }
                      className="flex items-center gap-2 sm:gap-2.5 px-4 sm:px-7 py-2.5 sm:py-4 rounded-xl sm:rounded-2xl liquid-glass hover:border-[color:var(--primary-color)] text-[color:var(--text-color)] font-bold text-xs sm:text-base transition whitespace-nowrap"
                    >
                      <Info className="w-4 h-4 sm:w-5 sm:h-5 text-[color:var(--primary-color)]" />
                      <span>{t.details}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Hero Carousel Arrows & Indicator Dots */}
              <div className="absolute bottom-3 sm:bottom-6 left-4 right-4 sm:left-8 sm:right-8 z-20 max-w-[1440px] mx-auto flex items-center justify-between pointer-events-none [&>*]:pointer-events-auto">
                <div className="flex items-center gap-2">
                  {heroSlides.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setHeroIndex(idx)}
                      className={`h-2 rounded-full transition-all ${
                        heroIndex === idx
                          ? "w-8 bg-[color:var(--primary-color)] shadow-[0_0_12px_var(--primary-color)]"
                          : "w-2 bg-white/30 hover:bg-white/60"
                      }`}
                    />
                  ))}
                </div>

                <div className="hidden sm:flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setHeroIndex(
                        (prev) =>
                          (prev - 1 + heroSlides.length) % heroSlides.length
                      )
                    }
                    className="w-10 h-10 rounded-xl liquid-glass hover:border-[color:var(--primary-color)] flex items-center justify-center text-[color:var(--text-color)] transition"
                  >
                    {lang === "ar" ? (
                      <ChevronRight className="w-5 h-5" />
                    ) : (
                      <ChevronLeft className="w-5 h-5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setHeroIndex((prev) => (prev + 1) % heroSlides.length)
                    }
                    className="w-10 h-10 rounded-xl liquid-glass hover:border-[color:var(--primary-color)] flex items-center justify-center text-[color:var(--text-color)] transition"
                  >
                    {lang === "ar" ? (
                      <ChevronLeft className="w-5 h-5" />
                    ) : (
                      <ChevronRight className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* SMART CONFIGURABLE AD BANNER (Hidden for Premium users or when Ads OFF) */}
          {shouldShowAds && (
            <div className="max-w-[1440px] mx-auto px-4 sm:px-8 mt-3 sm:mt-6 short:hidden">
              <div className="p-2.5 sm:p-5 rounded-2xl bg-gradient-to-r from-[#141006] via-[#18090B] to-[#0E0E14] border border-[color:var(--primary-color)]/30 flex flex-nowrap sm:flex-wrap items-center justify-between gap-2 sm:gap-4">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <span className="hidden sm:inline-block px-2.5 py-1 rounded-md bg-white/10 text-[10px] font-bold uppercase text-[color:var(--primary-color)]">
                    AD • إعلان
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] sm:text-sm font-bold text-[color:var(--text-color)] line-clamp-1 sm:line-clamp-none">
                      {lang === "ar"
                        ? "استمتع بمشاهدة خالية تماماً من الإعلانات مع باقة NAZMOVIES Premium الذهبية"
                        : "Enjoy 100% Ad-Free 4K Cinema with NAZMOVIES Golden Premium"}
                    </p>
                    <p className="hidden sm:block text-[11px] text-[color:var(--text-secondary-color)]">
                      {lang === "ar"
                        ? "سيرفرات خاصة فائقة السرعة • شارة بريميوم • بدون فواصل إعلانية"
                        : "Dedicated high-bitrate servers • Golden VIP badge • Zero ads"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPremiumModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-[color:var(--primary-color)] text-black text-[11px] sm:text-xs font-black hover:brightness-110 transition flex-shrink-0 whitespace-nowrap"
                >
                  <Crown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>{t.upgradeAdFree}</span>
                </button>
              </div>
            </div>
          )}

          {/* MAIN CONTENT SECTIONS */}
          <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-5 sm:py-10 space-y-7 sm:space-y-12">
            {/* CONTINUE WATCHING (only for logged-in users with progress) */}
            {activeNav === "home" && currentUser && continueEntries.length > 0 && (
              <section className="space-y-4" data-testid="continue-watching-section">
                <h2 className="text-xl sm:text-2xl font-black text-[color:var(--text-color)] flex items-center gap-2.5">
                  <span className="w-1.5 h-7 rounded-full bg-[color:var(--primary-color)]" />
                  <span>{t.continueWatching}</span>
                </h2>
                <div className="flex items-stretch gap-4 overflow-x-auto no-scrollbar pb-2">
                  {continueEntries.map((entry) => (
                    <div key={entry.key} className="w-[165px] sm:w-[200px] flex-shrink-0">
                      <ContinueWatchingGrid entries={[entry]} lang={lang} onContinue={handleContinueEntry} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* CATEGORIES VIEW (or Quick Categories Strip on Home) */}
            {(activeNav === "categories" || activeNav === "home") && (
              <section className="space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl sm:text-2xl font-black text-[color:var(--text-color)] flex items-center gap-2.5">
                    <span className="w-1.5 h-7 rounded-full bg-[color:var(--primary-color)]" />
                    <span>{t.categories}</span>
                  </h2>
                  {selectedCategorySlug !== "all" && (
                    <button
                      type="button"
                      onClick={() => setSelectedCategorySlug("all")}
                      className="text-xs font-bold text-[color:var(--primary-color)] hover:underline"
                    >
                      {t.allCategories}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
                  {categoriesList.map((cat) => {
                    const isSelected = selectedCategorySlug === cat.slug;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setSelectedCategorySlug(
                            isSelected ? "all" : cat.slug
                          );
                          if (cat.slug === "series") {
                            setActiveNav("series");
                          }
                        }}
                        className={`p-4 rounded-2xl text-right rtl:text-right ltr:text-left transition-all border group ${
                          isSelected
                            ? "bg-gradient-to-br from-[color:var(--primary-color)]/25 to-[color:var(--accent-color)]/20 border-[color:var(--primary-color)] shadow-[0_0_25px_color-mix(in_srgb,var(--primary-color)_30%,transparent)] scale-[1.02]"
                            : "liquid-glass hover:border-[color:var(--primary-color)]/50"
                        }`}
                      >
                        <div className="text-2xl mb-2 group-hover:scale-110 transition-transform inline-block">
                          {cat.icon}
                        </div>
                        <h3 className="text-sm font-black text-[color:var(--text-color)] group-hover:text-[color:var(--primary-color)] transition">
                          {lang === "ar" ? cat.nameAr : cat.nameEn}
                        </h3>
                        <p className="text-[11px] text-[color:var(--text-secondary-color)] line-clamp-1 mt-0.5">
                          {lang === "ar"
                            ? cat.descriptionAr
                            : cat.descriptionEn}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* FILTERED CATEGORY GRID IF USER SELECTED A SPECIFIC CATEGORY */}
            {selectedCategorySlug !== "all" && (
              <section className="space-y-5 animate-fadeIn">
                <h2 className="text-xl font-black text-[color:var(--primary-color)]">
                  {
                    categoriesList.find((c) => c.slug === selectedCategorySlug)
                      ?.[lang === "ar" ? "nameAr" : "nameEn"]
                  }
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
                  {moviesList
                    .filter((m) => {
                      if (selectedCategorySlug === "movies") return true;
                      if (selectedCategorySlug === "top-rated")
                        return m.rating >= 9.0;
                      if (
                        selectedCategorySlug === "arabic" ||
                        selectedCategorySlug === "foreign"
                      )
                        return m.originType === selectedCategorySlug;
                      return (
                        m.genre === selectedCategorySlug ||
                        m.categorySlug === selectedCategorySlug
                      );
                    })
                    .map((m) => (
                      <MediaPosterCard
                        key={`cat-m-${m.id}`}
                        type="movie"
                        item={m}
                        lang={lang}
                        inWatchlist={watchlistKeys.includes(`movie-${m.id}`)}
                        onPlay={() => handlePlayMovie(m)}
                        onDetails={() => setDetailMovie(m)}
                        onToggleWatchlist={(e) =>
                          toggleWatchlist("movie", m.id, e)
                        }
                      />
                    ))}
                </div>
              </section>
            )}

            {/* MY LIST / WATCHLIST VIEW */}
            {activeNav === "mylist" && (
              <section className="space-y-6 animate-fadeIn">
                <div className="flex items-center gap-3">
                  <Bookmark className="w-6 h-6 text-[color:var(--primary-color)]" />
                  <h2 className="text-2xl font-black text-[color:var(--text-color)]">{t.myList}</h2>
                </div>

                {watchlistKeys.length === 0 ? (
                  <div className="p-12 rounded-3xl liquid-glass text-center space-y-4">
                    <div className="text-4xl">🍿</div>
                    <p className="text-sm text-[color:var(--text-secondary-color)]">{t.emptyWatchlist}</p>
                    <button
                      type="button"
                      onClick={() => setActiveNav("home")}
                      className="px-6 py-3 rounded-2xl bg-[color:var(--primary-color)] text-black font-black text-xs"
                    >
                      {t.browseContent}
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
                    {moviesList
                      .filter((m) => watchlistKeys.includes(`movie-${m.id}`))
                      .map((m) => (
                        <MediaPosterCard
                          key={`wl-m-${m.id}`}
                          type="movie"
                          item={m}
                          lang={lang}
                          inWatchlist={true}
                          onPlay={() => handlePlayMovie(m)}
                          onDetails={() => setDetailMovie(m)}
                          onToggleWatchlist={(e) =>
                            toggleWatchlist("movie", m.id, e)
                          }
                        />
                      ))}
                    {seriesList
                      .filter((s) => watchlistKeys.includes(`series-${s.id}`))
                      .map((s) => (
                        <MediaPosterCard
                          key={`wl-s-${s.id}`}
                          type="series"
                          item={s}
                          lang={lang}
                          inWatchlist={true}
                          onPlay={() => handlePlaySeries(s)}
                          onDetails={() => setDetailSeries(s)}
                          onToggleWatchlist={(e) =>
                            toggleWatchlist("series", s.id, e)
                          }
                        />
                      ))}
                  </div>
                )}
              </section>
            )}

            {/* MOVIES HORIZONTAL CAROUSELS */}
            {(activeNav === "home" || activeNav === "movies") &&
              movieSections.map(
                (sec) =>
                  sec.items.length > 0 && (
                    <HorizontalCarouselSection
                      key={sec.id}
                      title={sec.title}
                      icon={sec.icon}
                      lang={lang}
                    >
                      {sec.items.map((m) => (
                        <div
                          key={`${sec.id}-${m.id}`}
                          className="w-[175px] sm:w-[215px] flex-shrink-0"
                        >
                          <MediaPosterCard
                            type="movie"
                            item={m}
                            lang={lang}
                            inWatchlist={watchlistKeys.includes(
                              `movie-${m.id}`
                            )}
                            onPlay={() => handlePlayMovie(m)}
                            onDetails={() => setDetailMovie(m)}
                            onToggleWatchlist={(e) =>
                              toggleWatchlist("movie", m.id, e)
                            }
                          />
                        </div>
                      ))}
                    </HorizontalCarouselSection>
                  )
              )}

            {/* SERIES HORIZONTAL CAROUSELS */}
            {(activeNav === "home" || activeNav === "series") &&
              seriesSections.map(
                (sec) =>
                  sec.items.length > 0 && (
                    <HorizontalCarouselSection
                      variant="series"
                      key={sec.id}
                      title={sec.title}
                      icon={sec.icon}
                      lang={lang}
                    >
                      {sec.items.map((s) => (
                        <div
                          key={`${sec.id}-${s.id}`}
                          className="w-[175px] sm:w-[215px] flex-shrink-0"
                        >
                          <MediaPosterCard
                            type="series"
                            item={s}
                            lang={lang}
                            inWatchlist={watchlistKeys.includes(
                              `series-${s.id}`
                            )}
                            onPlay={() => handlePlaySeries(s)}
                            onDetails={() => setDetailSeries(s)}
                            onToggleWatchlist={(e) =>
                              toggleWatchlist("series", s.id, e)
                            }
                          />
                        </div>
                      ))}
                    </HorizontalCarouselSection>
                  )
              )}
          </div>
        </main>
      )}

      {/* LUXURY FOOTER WITH ABOUT US, PRIVACY POLICY, TERMS OF SERVICE */}
      <BannerAd slot={settings.adConfig?.bannerFooter} enabled={shouldShowAds} testId="ad-banner-footer" className="py-3" />

      <footer className="mt-auto border-t border-[color:var(--border-color)] py-12" style={{ background: "var(--footer-color)" }}>
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 space-y-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <SiteLogoMark logoUrl={settings.logoUrl} />
              <div>
                <div data-testid="footer-site-name" className="text-xl font-black text-[color:var(--text-color)] tracking-wider">
                  {siteName}
                </div>
                <div className="text-xs font-bold text-[color:var(--primary-color)]">
                  {t.brandSubtitle}
                </div>
              </div>
            </div>

            {/* Footer Legal & Feature Links */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-xs font-bold text-[color:var(--text-secondary-color)]">
              <button
                type="button"
                data-testid="footer-contact"
                onClick={() => setContactOpen(true)}
                className="text-[#229ED9] hover:underline"
              >
                {t.contactUs}
              </button>
              <button
                type="button"
                onClick={() => setLegalPageModal("about")}
                className="hover:text-[color:var(--primary-color)] transition"
              >
                {t.aboutUs}
              </button>
              <button
                type="button"
                onClick={() => setLegalPageModal("privacy")}
                className="hover:text-[color:var(--primary-color)] transition"
              >
                {t.privacyPolicy}
              </button>
              <button
                type="button"
                onClick={() => setLegalPageModal("terms")}
                className="hover:text-[color:var(--primary-color)] transition"
              >
                {t.termsOfService}
              </button>
              {settings.movieRequestsEnabled && (
                <button
                  type="button"
                  onClick={() => setRequestModalOpen(true)}
                  className="text-[color:var(--primary-color)] hover:underline"
                >
                  {t.requestMovie}
                </button>
              )}
              {settings.premiumFeaturesEnabled && (
                <button
                  type="button"
                  onClick={() => setPremiumModalOpen(true)}
                  className="text-[color:var(--primary-color)] hover:underline flex items-center gap-1"
                >
                  <Crown className="w-3.5 h-3.5" />
                  <span>{t.upgradeAdFree}</span>
                </button>
              )}
            </div>
          </div>

          <div className="pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-500">
            <p>© {new Date().getFullYear()} {t.rightsReserved}</p>
            <p>{t.authorizedNotice}</p>
          </div>
        </div>
      </footer>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-[#07070A]/95 backdrop-blur-2xl border-t border-[color:var(--border-color)] px-3 py-2 flex items-center justify-around">
        {[
          { id: "home", icon: Film, label: t.home },
          { id: "movies", icon: Clapperboard, label: t.movies },
          { id: "series", icon: Tv, label: t.series },
          { id: "categories", icon: Sparkles, label: t.categories },
          { id: "mylist", icon: Bookmark, label: t.myList },
        ].map((nav) => {
          const Icon = nav.icon;
          const active = activeNav === nav.id && !detailMovie && !detailSeries;
          return (
            <button
              key={nav.id}
              type="button"
              onClick={() => {
                setActiveNav(nav.id as NavSection);
                setDetailMovie(null);
                setDetailSeries(null);
              }}
              className={`flex flex-col items-center gap-1 px-2 py-1 rounded-xl text-[10px] font-bold ${
                active ? "text-[color:var(--primary-color)]" : "text-[color:var(--text-secondary-color)]"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{nav.label}</span>
            </button>
          );
        })}
      </div>

      {/* GLASS SEARCH OVERLAY */}
      {searchOpen && (
        <div className="fixed inset-0 z-[115] bg-black/90 backdrop-blur-2xl p-4 sm:p-8 overflow-y-auto animate-fadeIn">
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-black text-[color:var(--primary-color)]">
                <Search className="w-5 h-5" />
                <span>{siteName} — {t.search}</span>
              </div>
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="p-2.5 rounded-2xl bg-white/10 hover:bg-[color:var(--accent-color)] text-[color:var(--text-color)] transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-6 h-6 text-[color:var(--primary-color)] absolute top-4 left-5 rtl:left-auto rtl:right-5" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                style={{ backgroundColor: "var(--search-color)" }}
                className="w-full pl-14 rtl:pl-5 rtl:pr-14 pr-5 py-4 rounded-3xl bg-white/[0.06] border-2 border-[color:var(--primary-color)]/40 focus:border-[color:var(--primary-color)] outline-none text-base sm:text-lg text-[color:var(--text-color)] placeholder-zinc-500 shadow-[0_0_40px_color-mix(in_srgb,var(--primary-color)_15%,transparent)]"
              />
            </div>

            {/* Quick Search Suggestions */}
            {!searchQuery && (
              <div className="flex flex-wrap items-center gap-2">
                {[
                  "رمال الخلود",
                  "تاج الأندلس",
                  "Midnight Syndicate",
                  "Sci-Fi",
                  "2026",
                  "Action",
                ].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSearchQuery(tag)}
                    className="px-3.5 py-1.5 rounded-full bg-white/5 hover:bg-[color:var(--primary-color)] hover:text-black text-xs text-[color:var(--text-secondary-color)] border border-[color:var(--border-color)] transition"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}

            {/* Search Results Grid */}
            {searchQuery.trim() !== "" && (
              <div className="space-y-6">
                {isSearching ? (
                  <p className="text-sm text-[color:var(--text-secondary-color)]">...</p>
                ) : searchResults.movies.length === 0 &&
                  searchResults.series.length === 0 ? (
                  <div className="p-10 rounded-3xl bg-white/5 border border-[color:var(--border-color)] text-center space-y-3">
                    <p className="text-sm text-[color:var(--text-secondary-color)]">{t.noResults}</p>
                    {settings.movieRequestsEnabled && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchOpen(false);
                          setRequestModalOpen(true);
                        }}
                        className="px-5 py-2.5 rounded-xl bg-[color:var(--primary-color)] text-black font-bold text-xs"
                      >
                        {t.requestMovie}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
                    {searchResults.movies.map((m) => (
                      <MediaPosterCard
                        key={`sr-m-${m.id}`}
                        type="movie"
                        item={m}
                        lang={lang}
                        inWatchlist={watchlistKeys.includes(`movie-${m.id}`)}
                        onPlay={() => {
                          setSearchOpen(false);
                          handlePlayMovie(m);
                        }}
                        onDetails={() => {
                          setSearchOpen(false);
                          setDetailMovie(m);
                        }}
                        onToggleWatchlist={(e) =>
                          toggleWatchlist("movie", m.id, e)
                        }
                      />
                    ))}
                    {searchResults.series.map((s) => (
                      <MediaPosterCard
                        key={`sr-s-${s.id}`}
                        type="series"
                        item={s}
                        lang={lang}
                        inWatchlist={watchlistKeys.includes(`series-${s.id}`)}
                        onPlay={() => {
                          setSearchOpen(false);
                          handlePlaySeries(s);
                        }}
                        onDetails={() => {
                          setSearchOpen(false);
                          setDetailSeries(s);
                        }}
                        onToggleWatchlist={(e) =>
                          toggleWatchlist("series", s.id, e)
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIDEO PLAYER MODAL */}
      {playingMedia && (
        <VideoPlayerModal
          media={playingMedia}
          lang={lang}
          maxVideoServers={settings.maxVideoServers}
          downloadsEnabled={settings.downloadsEnabled}
          onClose={() => {
            setPlayingMedia(null);
            // allow the final keepalive save to land, then refresh
            setTimeout(fetchHistory, 600);
          }}
          hasNextEpisode={playingMedia.mediaType === "series"}
          onNextEpisode={handleNextEpisode}
          onMeaningfulViewRecorded={fetchAllData}
          adSlot={shouldShowAds ? settings.adConfig?.bannerPlayer : undefined}
          startTime={playStartTime}
          progressEnabled={Boolean(currentUser)}
          onProgressSaved={fetchHistory}
        />
      )}

      {/* FULL ADMIN DASHBOARD — no auth gate, opens whenever requested */}
      {adminDashboardOpen && (
        <AdminDashboardModal
          lang={lang}
          moviesList={moviesList}
          seriesList={seriesList}
          settings={settings}
          onClose={handleCloseAdminDashboard}
          onLogout={handleAdminLogout}
          onRefreshData={fetchAllData}
          onUpdateSettings={handleUpdateSettings}
          showToast={showToast}
        />
      )}

      {/* USER EMAIL LOGIN / REGISTER / PROFILE MODAL */}
      {authModalOpen && (
        <UserAuthModal
          lang={lang}
          currentUser={currentUser}
          settings={settings}
          onClose={() => setAuthModalOpen(false)}
          initialTab={authInitialTab}
          onAuthSuccess={(u, token) => {
            if (typeof window !== "undefined") {
              if (token) safeSet(USER_TOKEN_KEY, token);
              safeSet("nazmovies_user", JSON.stringify(u));
            }
            setCurrentUser(u);
          }}
          renderAccountTab={(tab) =>
            tab === "continue" ? (
              continueEntries.length ? (
                <ContinueWatchingGrid entries={continueEntries} lang={lang} onContinue={handleContinueEntry} />
              ) : (
                <p className="text-xs text-[color:var(--text-secondary-color)] p-6 text-center rounded-2xl bg-black/40 border border-[color:var(--border-color)]">{t.noHistory}</p>
              )
            ) : tab === "history" ? (
              <WatchHistoryPanel items={historyItems} lang={lang} onResume={handleResumeHistoryItem} onClear={handleClearHistory} />
            ) : (
              <FavoritesPanel
                lang={lang}
                favoriteKeys={favoriteKeys}
                moviesList={moviesList}
                seriesList={seriesList}
                onOpen={(type, id) => {
                  setAuthModalOpen(false);
                  if (type === "movie") setDetailMovie(moviesList.find((m) => m.id === id) || null);
                  else setDetailSeries(seriesList.find((x) => x.id === id) || null);
                }}
              />
            )
          }
          onLogout={() => {
            setCurrentUser(null);
            setHistoryItems([]);
            if (typeof window !== "undefined") {
              safeRemove("nazmovies_user");
              safeRemove(USER_TOKEN_KEY);
            }
            showToast(
              lang === "ar" ? "تم تسجيل الخروج" : "Signed out successfully"
            );
          }}
          onOpenPremiumModal={() => setPremiumModalOpen(true)}
          showToast={showToast}
        />
      )}

      {/* REQUEST A MOVIE MODAL */}
      {requestModalOpen && (
        <MovieRequestModal
          lang={lang}
          currentUser={currentUser}
          onClose={() => setRequestModalOpen(false)}
          showToast={showToast}
        />
      )}

      {/* PREMIUM AD-FREE UPGRADE MODAL */}
      {premiumModalOpen && (
        <PremiumUpgradeModal
          lang={lang}
          currentUser={currentUser}
          settings={settings}
          onClose={() => setPremiumModalOpen(false)}
          showToast={showToast}
        />
      )}

      {/* LEGAL PAGES MODAL (About Us, Privacy Policy, Terms of Service) */}
      {legalPageModal && (
        <LegalPageModal
          page={legalPageModal}
          lang={lang}
          settings={settings}
          onClose={() => setLegalPageModal(null)}
        />
      )}

      {/* CONTACT ADMINISTRATION (Telegram) */}
      {contactOpen && (
        <ContactModal
          lang={lang}
          siteName={siteName}
          telegramUrl={settings.telegramContactUrl}
          onClose={() => setContactOpen(false)}
        />
      )}

      {/* Tracking / header scripts + pop-under (fires on first interaction) */}
      <GlobalAds adConfig={settings.adConfig} enabled={shouldShowAds} />

      {/* Live theme variables (server also injects these for first paint) */}
      <style id="naz-theme-live" dangerouslySetInnerHTML={{ __html: buildThemeCss(settings) }} />

      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-20 md:bottom-8 right-4 sm:right-8 z-[150] px-5 py-3.5 rounded-2xl bg-[#0D0D12]/95 border border-[color:var(--primary-color)] text-[color:var(--text-color)] text-xs sm:text-sm font-bold shadow-[0_0_35px_color-mix(in_srgb,var(--primary-color)_35%,transparent)] flex items-center gap-2.5 animate-fadeIn">
          <Sparkles className="w-4 h-4 text-[color:var(--primary-color)]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

// HORIZONTAL CAROUSEL COMPONENT
function HorizontalCarouselSection({
  title,
  icon,
  lang,
  children,
  variant = "movie",
}: {
  title: string;
  icon: string;
  lang: Language;
  children: React.ReactNode;
  variant?: "movie" | "series";
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const scrollByAmount = (dir: "prev" | "next") => {
    const el = scrollRef.current;
    if (!el) return;
    const delta = dir === "next" ? 660 : -660;
    el.scrollBy({
      left: lang === "ar" ? -delta : delta,
      behavior: "smooth",
    });
  };

  return (
    <section
      className="space-y-3 sm:space-y-4 rounded-3xl -mx-3 px-3 py-1 sm:py-2"
      style={{ background: variant === "series" ? "var(--series-section-color)" : "var(--movie-section-color)" }}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg sm:text-xl font-black text-[color:var(--text-color)] flex items-center gap-2.5">
          <span>{icon}</span>
          <span>{title}</span>
        </h2>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => scrollByAmount("prev")}
            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-[color:var(--primary-color)] hover:text-black border border-[color:var(--border-color)] flex items-center justify-center text-[color:var(--text-secondary-color)] transition"
          >
            {lang === "ar" ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => scrollByAmount("next")}
            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-[color:var(--primary-color)] hover:text-black border border-[color:var(--border-color)] flex items-center justify-center text-[color:var(--text-secondary-color)] transition"
          >
            {lang === "ar" ? (
              <ChevronLeft className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex items-stretch gap-4 overflow-x-auto no-scrollbar pb-2 pt-1"
      >
        {children}
      </div>
    </section>
  );
}

// LUXURY MOVIE / SERIES CARD COMPONENT
function MediaPosterCard({
  type,
  item,
  lang,
  inWatchlist,
  onPlay,
  onDetails,
  onToggleWatchlist,
}: {
  type: "movie" | "series";
  item: MovieRecord | SeriesRecord;
  lang: Language;
  inWatchlist: boolean;
  onPlay: () => void;
  onDetails: () => void;
  onToggleWatchlist: (e: React.MouseEvent) => void;
}) {
  const badgeText =
    type === "series" ? "SERIES" : item.badge || item.quality || "4K";

  return (
    <div
      onClick={onDetails}
      style={{ backgroundColor: type === "series" ? "var(--series-card-color)" : "var(--movie-card-color)" }}
      className="group relative rounded-2xl overflow-hidden border border-[color:var(--border-color)] hover:border-[color:var(--primary-color)] transition-all duration-300 cursor-pointer hover:shadow-[0_0_30px_color-mix(in_srgb,var(--primary-color)_28%,transparent)] hover:-translate-y-1 flex flex-col"
    >
      {/* Poster Container */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-zinc-900">
        <img
          src={item.posterUrl}
          alt={lang === "ar" ? item.titleAr : item.titleEn}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />

        {/* Top Badges */}
        <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between pointer-events-none">
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-black shadow ${
              badgeText === "SERIES" || badgeText === "NEW"
                ? "bg-[color:var(--accent-color)] text-[color:var(--text-color)]"
                : "bg-[color:var(--primary-color)] text-black"
            }`}
          >
            {badgeText}
          </span>

          <span className="px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md border border-[color:var(--border-color)] text-[color:var(--primary-color)] text-[11px] font-bold flex items-center gap-1">
            <Star className="w-3 h-3 fill-current" />
            {item.rating}
          </span>
        </div>

        {/* Hover Gradient Overlay + Controls */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3.5">
          <div className="flex items-center justify-center gap-2.5 mb-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPlay();
              }}
              className="w-11 h-11 rounded-full bg-[color:var(--primary-color)] text-black flex items-center justify-center shadow-[0_0_25px_color-mix(in_srgb,var(--primary-color)_60%,transparent)] hover:scale-110 transition"
            >
              <Play className="w-5 h-5 fill-current" />
            </button>

            <button
              type="button"
              onClick={onToggleWatchlist}
              className={`w-10 h-10 rounded-full border flex items-center justify-center transition ${
                inWatchlist
                  ? "bg-[color:var(--primary-color)]/20 border-[color:var(--primary-color)] text-[color:var(--primary-color)]"
                  : "bg-black/70 border-white/25 text-[color:var(--text-color)] hover:border-[color:var(--primary-color)]"
              }`}
            >
              {inWatchlist ? (
                <Check className="w-4 h-4" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
            </button>
          </div>

          <p className="text-[11px] text-center text-[color:var(--primary-color)] font-semibold">
            6 {lang === "ar" ? "سيرفرات • تحميل مباشر" : "Servers • Direct DL"}
          </p>
        </div>
      </div>

      {/* Card Footer Metadata */}
      <div className="p-3 space-y-1 bg-[color:var(--card-color)]">
        <h3 className="text-xs sm:text-sm font-bold text-[color:var(--text-color)] truncate group-hover:text-[color:var(--primary-color)] transition">
          {lang === "ar" ? item.titleAr : item.titleEn}
        </h3>
        <div className="flex items-center justify-between text-[11px] text-[color:var(--text-secondary-color)]">
          <span>{item.year}</span>
          <span className="truncate max-w-[100px]">
            {lang === "ar" ? item.genreAr : item.genreEn}
          </span>
        </div>
      </div>
    </div>
  );
}

// Central logo mark: default popcorn reel, custom uploaded image, or none
function SiteLogoMark({ logoUrl }: { logoUrl?: string }) {
  if (logoUrl === "none") return null;
  if (logoUrl) {
    return (
      <img
        data-testid="site-logo-img"
        src={logoUrl}
        alt="logo"
        className="w-10 h-10 sm:w-11 sm:h-11 object-contain rounded-xl flex-shrink-0"
      />
    );
  }
  return (
    <div className="relative w-10 h-10 sm:w-11 sm:h-11 flex-shrink-0 rounded-2xl bg-gradient-to-br from-[color:var(--primary-color)] via-[color:var(--secondary-color)] to-[color:var(--accent-color)] p-[1px] shadow-[0_0_25px_color-mix(in_srgb,var(--primary-color)_40%,transparent)] group-hover:scale-105 transition">
      <div className="w-full h-full rounded-2xl bg-[#070709] flex items-center justify-center text-xl">
        🍿
      </div>
      <span className="absolute -bottom-1 -right-1 text-xs">🎞️</span>
    </div>
  );
}
