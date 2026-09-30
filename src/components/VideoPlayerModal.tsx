"use client";

import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  X,
  Server,
  Download,
  Subtitles,
  Gauge,
  SkipForward,
  Check,
  Sparkles,
  Film,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { Language, translations } from "@/lib/translations";
import { VideoServerItem, DownloadLinkItem } from "@/db/schema";
import { buildDefaultServers, buildDefaultDownloads } from "@/lib/defaults";
import { userFetch, safeGet, safeSet } from "@/lib/clientAuth";
import { formatClock } from "@/lib/theme";
import { BannerAd } from "@/components/AdSlot";
import type { AdSlot as AdSlotData } from "@/db/schema";

type FsDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
};
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
type FsVideo = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
  webkitDisplayingFullscreen?: boolean;
};

function getFullscreenElement(): Element | null {
  if (typeof document === "undefined") return null;
  const d = document as FsDocument;
  return d.fullscreenElement || d.webkitFullscreenElement || null;
}

export interface PlayableMedia {
  id: number;
  mediaType: "movie" | "series";
  titleAr: string;
  titleEn: string;
  subtitleAr?: string;
  subtitleEn?: string;
  posterUrl: string;
  backdropUrl: string;
  videoUrl: string;
  hlsUrl: string;
  quality: string;
  servers?: VideoServerItem[];
  downloadLinks?: DownloadLinkItem[];
  episodeId?: number;
  seasonNumber?: number;
  episodeNumber?: number;
}

interface VideoPlayerModalProps {
  media: PlayableMedia | null;
  lang: Language;
  maxVideoServers: number;
  downloadsEnabled: boolean;
  onClose: () => void;
  onNextEpisode?: () => void;
  hasNextEpisode?: boolean;
  onMeaningfulViewRecorded?: () => void;
  /** Saved position (seconds) to resume from */
  startTime?: number;
  /** Persist progress to the logged-in account */
  progressEnabled?: boolean;
  onProgressSaved?: () => void;
  /** Banner shown under the player (already gated by the ad settings) */
  adSlot?: AdSlotData;
}

export default function VideoPlayerModal({
  media,
  lang,
  maxVideoServers = 6,
  downloadsEnabled = true,
  onClose,
  onNextEpisode,
  hasNextEpisode = false,
  onMeaningfulViewRecorded,
  startTime = 0,
  progressEnabled = false,
  onProgressSaved,
  adSlot,
}: VideoPlayerModalProps) {
  const t = translations[lang];
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const meaningfulViewSentRef = useRef<string | null>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [selectedQuality, setSelectedQuality] = useState("4K");
  const [subtitleLang, setSubtitleLang] = useState<"ar" | "en" | "off">("ar");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeServerNumber, setActiveServerNumber] = useState<number>(1);
  const [streamMode, setStreamMode] = useState<"mp4" | "hls">("mp4");
  const [showDownloadsPanel, setShowDownloadsPanel] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  const [serverError, setServerError] = useState(false);
  const [resumeNotice, setResumeNotice] = useState<string | null>(null);

  // Progress tracking refs (refs survive unmount cleanup, unlike videoRef)
  const mediaRef = useRef(media);
  mediaRef.current = media;
  const lastTimeRef = useRef(0);
  const lastDurationRef = useRef(0);
  const lastSavedAtRef = useRef(0);
  const resumeTargetRef = useRef<number>(startTime > 1 ? startTime : 0);
  const progressEnabledRef = useRef(progressEnabled);
  progressEnabledRef.current = progressEnabled;
  const onSavedRef = useRef(onProgressSaved);
  onSavedRef.current = onProgressSaved;

  const saveProgress = (completed = false) => {
    const m = mediaRef.current;
    if (!m || !progressEnabledRef.current) return;
    const du = lastDurationRef.current;
    const ct = lastTimeRef.current;
    if (!isFinite(du) || du <= 0) return;
    if (ct < 1 && !completed) return;
    lastSavedAtRef.current = Date.now();
    userFetch("/api/history", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mediaType: m.mediaType,
        contentId: m.id,
        episodeId: m.episodeId || 0,
        currentTime: completed ? du : ct,
        duration: du,
        completed,
      }),
    })
      .then(() => onSavedRef.current?.())
      .catch(() => {});
  };

  // New media (e.g. next episode) → reset resume target
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    resumeTargetRef.current = startTime > 1 ? startTime : 0;
    lastTimeRef.current = 0;
    lastDurationRef.current = 0;
  }, [media?.id, media?.episodeId, startTime]);

  // Periodic auto-save while playing + save when tab hides / page closes / player unmounts
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const interval = setInterval(() => {
      const v = videoRef.current;
      if (v && !v.paused && !v.ended) saveProgress(false);
    }, 10000);
    const onHide = () => {
      if (document.visibilityState === "hidden") saveProgress(false);
    };
    const onPageHide = () => saveProgress(false);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      saveProgress(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media?.id, media?.episodeId]);

  // Keep the fullscreen icon in sync with the real browser state
  // (covers Esc key, system gestures, iOS native player exit, etc.)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(getFullscreenElement()));
    const video = videoRef.current as FsVideo | null;
    const onIosBegin = () => setIsFullscreen(true);
    const onIosEnd = () => setIsFullscreen(false);
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    video?.addEventListener("webkitbeginfullscreen", onIosBegin);
    video?.addEventListener("webkitendfullscreen", onIosEnd);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
      video?.removeEventListener("webkitbeginfullscreen", onIosBegin);
      video?.removeEventListener("webkitendfullscreen", onIosEnd);
      // Leave fullscreen if the player closes while fullscreen
      const d = document as FsDocument;
      if (getFullscreenElement()) {
        (d.exitFullscreen?.() ?? d.webkitExitFullscreen?.())?.catch?.(() => {});
      }
    };
  }, [media?.id, media?.episodeId]);

  if (!media) return null;

  // Compute available servers (1..maxVideoServers)
  const rawServers =
    Array.isArray(media.servers) && media.servers.length > 0
      ? media.servers
      : buildDefaultServers(media.videoUrl, media.hlsUrl);

  const availableServers = rawServers
    .filter((s) => s.isEnabled !== false)
    .slice(0, Math.max(1, Math.min(6, maxVideoServers)));

  const activeServer =
    availableServers.find((s) => s.id === activeServerNumber) ||
    availableServers[0] || {
      id: 1,
      nameAr: "سيرفر ناز 1",
      nameEn: "Server 1",
      url: media.videoUrl,
      hlsUrl: media.hlsUrl,
      type: "mp4" as const,
      quality: media.quality || "4K",
      isEnabled: true,
    };

  const downloadItems = (
    Array.isArray(media.downloadLinks) && media.downloadLinks.length > 0
      ? media.downloadLinks
      : buildDefaultDownloads(media.videoUrl)
  ).filter((d) => d.isEnabled !== false);

  const effectiveStreamUrl =
    streamMode === "hls" || activeServer.type === "hls"
      ? activeServer.hlsUrl || media.hlsUrl || activeServer.url
      : activeServer.url || media.videoUrl;

  // Attach video source (HLS or MP4) whenever server or mode changes
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !effectiveStreamUrl) return;

    setServerError(false);
    if (video.currentTime > 1) resumeTargetRef.current = video.currentTime;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const isHlsSource =
      effectiveStreamUrl.includes(".m3u8") ||
      streamMode === "hls" ||
      activeServer.type === "hls";

    if (isHlsSource && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        xhrSetup: (xhr) => {
          xhr.withCredentials = false;
        },
      });
      hlsRef.current = hls;
      hls.loadSource(effectiveStreamUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setServerError(true);
        }
      });
    } else {
      video.src = effectiveStreamUrl;
      video
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [effectiveStreamUrl, activeServer.id, streamMode, media.id, media.episodeId]);

  // Record meaningful video view after 3.5 seconds of active playback
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const viewKey = `${media.mediaType}-${media.id}-${media.episodeId || 0}`;
    if (meaningfulViewSentRef.current === viewKey) return;

    const timer = setTimeout(() => {
      meaningfulViewSentRef.current = viewKey;
      const seenStorageKey = `naz_viewed_${viewKey}`;
      const isUnique =
        typeof window !== "undefined" && !safeGet(seenStorageKey);
      if (typeof window !== "undefined") {
        safeSet(seenStorageKey, "1");
      }

      fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaType: media.mediaType,
          mediaId: media.id,
          episodeId: media.episodeId || 0,
          watchMinutes: 15,
          isUnique,
        }),
      })
        .then(() => {
          if (onMeaningfulViewRecorded) onMeaningfulViewRecorded();
        })
        .catch(() => {});
    }, 3500);

    return () => clearTimeout(timer);
  }, [media.id, media.mediaType, media.episodeId, onMeaningfulViewRecorded]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (val: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = val;
    setVolume(val);
    setIsMuted(val === 0);
  };

  const handleSeek = (val: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = val;
    setCurrentTime(val);
  };

  const handleSpeedChange = (rate: number) => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = rate;
    }
    setPlaybackRate(rate);
    setShowSpeedMenu(false);
  };

  const toggleFullscreen = async () => {
    const el = containerRef.current as FsElement | null;
    const video = videoRef.current as FsVideo | null;
    if (!el) return;
    const doc = document as FsDocument;

    try {
      if (getFullscreenElement()) {
        // Exit (standard, then WebKit-prefixed)
        if (doc.exitFullscreen) await doc.exitFullscreen();
        else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
        return;
      }

      // Enter: fullscreen the player container so our custom controls/servers stay visible
      if (el.requestFullscreen) {
        await el.requestFullscreen({ navigationUI: "hide" });
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen();
      } else if (video?.webkitEnterFullscreen) {
        // iPhone Safari: element fullscreen unsupported → native video fullscreen
        video.webkitEnterFullscreen();
        return;
      } else {
        throw new Error("Fullscreen API not supported");
      }

      // Best-effort landscape lock on mobile (ignored where unsupported)
      const orientation = screen.orientation as ScreenOrientation & {
        lock?: (o: string) => Promise<void>;
      };
      orientation?.lock?.("landscape").catch(() => {});
    } catch (err) {
      // e.g. iOS where container fullscreen fails, or a permissions-policy restriction
      if (video?.webkitEnterFullscreen && !getFullscreenElement()) {
        try {
          video.webkitEnterFullscreen();
          return;
        } catch {
          /* fall through */
        }
      }
      console.warn("Fullscreen request failed:", err);
    }
  };

  const formatTime = (sec: number) => {
    if (!sec || isNaN(sec)) return "00:00";
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const switchToNextServer = () => {
    const currentIndex = availableServers.findIndex(
      (s) => s.id === activeServer.id
    );
    const nextServer =
      availableServers[(currentIndex + 1) % availableServers.length];
    if (nextServer) {
      setActiveServerNumber(nextServer.id);
      setSelectedQuality(nextServer.quality || "4K");
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-2 sm:p-6 overflow-y-auto">
      <div
        ref={containerRef}
        data-testid="player-container"
        className="naz-player relative w-full max-w-6xl rounded-3xl border border-[color:var(--primary-color)]/30 bg-[color:var(--background-color)] shadow-[0_0_90px_color-mix(in_srgb,var(--primary-color)_18%,transparent)] overflow-hidden flex flex-col"
      >
        {/* Top Bar: Title + Stream Type + Close */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 bg-gradient-to-b from-black/95 to-black/60 border-b border-[color:var(--border-color)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[color:var(--primary-color)] to-[color:var(--secondary-color)] flex items-center justify-center text-black font-black shadow-[0_0_20px_color-mix(in_srgb,var(--primary-color)_50%,transparent)]">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-[color:var(--text-color)]">
                  {lang === "ar" ? media.titleAr : media.titleEn}
                </h3>
                <span className="px-2 py-0.5 text-[11px] font-black rounded-md bg-[color:var(--primary-color)] text-black">
                  {selectedQuality}
                </span>
              </div>
              {(media.subtitleAr || media.subtitleEn) && (
                <p className="text-xs text-[color:var(--primary-color)]">
                  {lang === "ar" ? media.subtitleAr : media.subtitleEn}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Stream protocol toggle */}
            <div className="hidden sm:flex items-center rounded-xl bg-white/5 p-1 border border-[color:var(--border-color)]">
              <button
                type="button"
                onClick={() => setStreamMode("mp4")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  streamMode === "mp4"
                    ? "bg-[color:var(--primary-color)] text-black shadow"
                    : "text-[color:var(--text-secondary-color)] hover:text-[color:var(--text-color)]"
                }`}
              >
                {t.mp4Stream}
              </button>
              <button
                type="button"
                onClick={() => setStreamMode("hls")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  streamMode === "hls"
                    ? "bg-[color:var(--accent-color)] text-[color:var(--text-color)] shadow"
                    : "text-[color:var(--text-secondary-color)] hover:text-[color:var(--text-color)]"
                }`}
              >
                {t.hlsStream}
              </button>
            </div>

            {downloadsEnabled && (
              <button
                type="button"
                onClick={() => setShowDownloadsPanel(!showDownloadsPanel)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition ${
                  showDownloadsPanel
                    ? "bg-[color:var(--primary-color)] text-black border-[color:var(--primary-color)]"
                    : "bg-white/5 text-[color:var(--primary-color)] border-[color:var(--primary-color)]/40 hover:bg-[color:var(--primary-color)]/15"
                }`}
              >
                <Download className="w-4 h-4" />
                <span>{t.download}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-[color:var(--accent-color)] text-[color:var(--text-color)] transition"
              title={t.closePlayer}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MULTIPLE VIDEO SERVERS BAR (Server 1 .. Server 6) */}
        <div className="px-4 sm:px-6 py-3 bg-[#0B0B0E] border-b border-[color:var(--border-color)] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-[color:var(--primary-color)]">
            <Server className="w-4 h-4 text-[color:var(--primary-color)]" />
            <span>{t.videoServers}:</span>
            <span className="text-[color:var(--text-secondary-color)] font-normal hidden md:inline">
              ({t.selectServerHint})
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
            {availableServers.map((srv, idx) => {
              const isSelected = activeServer.id === srv.id;
              return (
                <button
                  key={srv.id || idx}
                  type="button"
                  onClick={() => {
                    setActiveServerNumber(srv.id);
                    setSelectedQuality(srv.quality || "4K");
                    if (srv.type === "hls") {
                      setStreamMode("hls");
                    } else {
                      setStreamMode("mp4");
                    }
                  }}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border transition-all ${
                    isSelected
                      ? "naz-btn text-black border-[color:var(--primary-color)] shadow-[0_0_20px_color-mix(in_srgb,var(--primary-color)_40%,transparent)] scale-[1.02]"
                      : "bg-white/5 text-zinc-200 border-[color:var(--border-color)] hover:border-[color:var(--primary-color)]/50 hover:text-[color:var(--text-color)]"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-current opacity-80" />
                  <span>
                    {lang === "ar"
                      ? `سيرفر ${srv.id}`
                      : `Server ${srv.id}`}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] ${
                      isSelected
                        ? "bg-black/20 text-black font-black"
                        : "bg-white/10 text-[color:var(--primary-color)]"
                    }`}
                  >
                    {srv.quality || "4K"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Download Options Drawer inside Player */}
        {showDownloadsPanel && downloadsEnabled && (
          <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-[#12100B] via-[#150A0C] to-[#0D0D11] border-b border-[color:var(--primary-color)]/30 animate-fadeIn">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4 text-[color:var(--primary-color)]" />
                <h4 className="text-sm font-bold text-[color:var(--text-color)]">
                  {t.downloadOptions} —{" "}
                  <span className="text-[color:var(--primary-color)]">
                    {lang === "ar" ? media.titleAr : media.titleEn}
                  </span>
                </h4>
              </div>
              <span className="text-xs text-[color:var(--text-secondary-color)]">
                {t.authorizedDownloadNote}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {downloadItems.map((dl) => (
                <a
                  key={dl.id}
                  href={dl.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="flex items-center justify-between p-3 rounded-2xl bg-black/60 border border-[color:var(--border-color)] hover:border-[color:var(--primary-color)] hover:bg-[color:var(--primary-color)]/10 transition group"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-[color:var(--primary-color)] text-black text-xs font-black">
                        {dl.quality}
                      </span>
                      <span className="text-xs font-bold text-[color:var(--text-color)]">
                        {dl.size}
                      </span>
                    </div>
                    <p className="text-[11px] text-[color:var(--text-secondary-color)] mt-1">
                      {dl.format}
                    </p>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-[color:var(--primary-color)]/20 group-hover:bg-[color:var(--primary-color)] text-[color:var(--primary-color)] group-hover:text-black flex items-center justify-center transition">
                    <Download className="w-4 h-4" />
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Video Canvas */}
        <div className="naz-player-canvas relative bg-black aspect-video w-full flex items-center justify-center overflow-hidden group">
          <video
            ref={videoRef}
            poster={media.backdropUrl || media.posterUrl}
            crossOrigin="anonymous"
            playsInline
            onClick={togglePlay}
            onDoubleClick={toggleFullscreen}
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              setCurrentTime(v.currentTime);
              lastTimeRef.current = v.currentTime;
              if (isFinite(v.duration)) lastDurationRef.current = v.duration;
            }}
            onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              setDuration(v.duration);
              if (isFinite(v.duration)) lastDurationRef.current = v.duration;
              const target = resumeTargetRef.current;
              if (target > 1 && isFinite(v.duration) && target < v.duration - 3) {
                v.currentTime = target;
                lastTimeRef.current = target;
                setResumeNotice(`${t.continueFrom} ${formatClock(target)}`);
                setTimeout(() => setResumeNotice(null), 4000);
              }
              resumeTargetRef.current = 0;
            }}
            onPause={() => saveProgress(false)}
            onEnded={() => {
              lastTimeRef.current = lastDurationRef.current;
              saveProgress(true);
            }}
            data-testid="naz-video"
            onError={() => setServerError(true)}
            className="w-full h-full object-contain cursor-pointer"
          >
            {subtitleLang !== "off" && (
              <track
                kind="subtitles"
                src={`/api/subtitles?lang=${subtitleLang}`}
                srcLang={subtitleLang}
                label={subtitleLang === "ar" ? "العربية" : "English"}
                default
              />
            )}
          </video>

          {resumeNotice && (
            <div data-testid="resume-notice" className="absolute top-4 left-4 z-10 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur-md border border-[color:var(--primary-color)]/40 text-xs font-bold text-[color:var(--primary-color)]">
              ▶ {resumeNotice}
            </div>
          )}

          {/* Active Server Watermark Badge */}
          <div className="absolute top-4 right-4 pointer-events-none flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-[color:var(--border-color)] text-xs text-zinc-200">
            <Sparkles className="w-3.5 h-3.5 text-[color:var(--primary-color)]" />
            <span>
              {lang === "ar" ? activeServer.nameAr : activeServer.nameEn}
            </span>
          </div>

          {/* Failover Banner if a stream encounters CORS or network error */}
          {serverError && (
            <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
              <AlertCircle className="w-12 h-12 text-[color:var(--accent-color)] mb-3" />
              <p className="text-base font-bold text-[color:var(--text-color)] mb-1">
                {lang === "ar"
                  ? "تعذر الاتصال بهذا السيرفر حالياً"
                  : "Current streaming server is temporarily busy"}
              </p>
              <p className="text-xs text-[color:var(--text-secondary-color)] mb-4">
                {lang === "ar"
                  ? "يمكنك الانتقال فوراً إلى السيرفر الاحتياطي التالي بضغطة واحدة"
                  : "Switch to the next redundant NAZMOVIES server with one click"}
              </p>
              <button
                type="button"
                onClick={switchToNextServer}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[color:var(--primary-color)] text-black font-bold text-sm hover:bg-[color:var(--secondary-color)] transition"
              >
                <RefreshCw className="w-4 h-4" />
                <span>
                  {lang === "ar"
                    ? "التبديل إلى السيرفر التالي"
                    : "Switch to Next Server"}
                </span>
              </button>
            </div>
          )}

          {/* On-screen Subtitle Preview Bar */}
          {subtitleLang !== "off" && isPlaying && (
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-xl bg-black/75 backdrop-blur-md border border-[color:var(--border-color)] text-center pointer-events-none">
              <p className="text-xs sm:text-sm font-medium text-[color:var(--primary-color)]">
                {subtitleLang === "ar"
                  ? "🎬 بث سينمائي فائق الدقة عبر خوادم NAZMOVIES — أفلام ناز"
                  : "🎬 Streaming in Ultra HD via NAZMOVIES Multi-Server Cinema"}
              </p>
            </div>
          )}
        </div>

        {/* Below-player banner ad */}
        <BannerAd slot={adSlot} enabled={Boolean(adSlot)} testId="ad-banner-player" className="bg-black/60 py-2" />

        {/* Bottom Player Controls */}
        <div className="px-4 sm:px-6 py-4 bg-gradient-to-t from-black via-[#08080A] to-[color:var(--card-color)] border-t border-[color:var(--border-color)] space-y-3">
          {/* Progress Bar */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-[color:var(--text-secondary-color)] w-12 text-center">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={(e) => handleSeek(Number(e.target.value))}
              className="w-full h-1.5 bg-white/15 rounded-lg appearance-none cursor-pointer accent-[color:var(--primary-color)]"
            />
            <span className="text-xs font-mono text-[color:var(--text-secondary-color)] w-12 text-center">
              {formatTime(duration)}
            </span>
          </div>

          {/* Control Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={togglePlay}
                className="w-10 h-10 rounded-xl bg-[color:var(--primary-color)] hover:bg-[color:var(--secondary-color)] text-black flex items-center justify-center transition shadow-[0_0_20px_color-mix(in_srgb,var(--primary-color)_40%,transparent)]"
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 fill-current" />
                ) : (
                  <Play className="w-5 h-5 fill-current" />
                )}
              </button>

              {hasNextEpisode && onNextEpisode && (
                <button
                  type="button"
                  onClick={onNextEpisode}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-[color:var(--primary-color)] hover:text-black text-[color:var(--text-color)] text-xs font-bold transition"
                >
                  <SkipForward className="w-4 h-4" />
                  <span>{t.nextEpisode}</span>
                </button>
              )}

              {/* Volume */}
              <div className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-xl border border-[color:var(--border-color)]">
                <button
                  type="button"
                  onClick={toggleMute}
                  className="text-zinc-200 hover:text-[color:var(--primary-color)]"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4 text-[color:var(--accent-color)]" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(Number(e.target.value))}
                  className="w-16 sm:w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[color:var(--primary-color)]"
                />
              </div>
            </div>

            {/* Right Controls: Subtitles, Speed, Quality, Fullscreen */}
            <div className="flex items-center gap-2 relative">
              {/* Subtitles Selector */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowSubtitleMenu(!showSubtitleMenu);
                    setShowSpeedMenu(false);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                    subtitleLang !== "off"
                      ? "bg-[color:var(--primary-color)]/15 text-[color:var(--primary-color)] border-[color:var(--primary-color)]/40"
                      : "bg-white/5 text-[color:var(--text-secondary-color)] border-[color:var(--border-color)]"
                  }`}
                >
                  <Subtitles className="w-4 h-4" />
                  <span className="hidden sm:inline">{t.subtitles}:</span>
                  <span>
                    {subtitleLang === "ar"
                      ? "AR"
                      : subtitleLang === "en"
                      ? "EN"
                      : t.subtitlesOff}
                  </span>
                </button>
                {showSubtitleMenu && (
                  <div className="absolute bottom-12 right-0 w-40 rounded-2xl bg-[#0E0E12] border border-[color:var(--border-color)] shadow-2xl p-1.5 z-30">
                    {(
                      [
                        { id: "ar", label: "العربية (Arabic)" },
                        { id: "en", label: "English" },
                        { id: "off", label: t.subtitlesOff },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setSubtitleLang(opt.id);
                          setShowSubtitleMenu(false);
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left hover:bg-white/10 text-zinc-200"
                      >
                        <span>{opt.label}</span>
                        {subtitleLang === opt.id && (
                          <Check className="w-3.5 h-3.5 text-[color:var(--primary-color)]" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Speed Selector */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowSpeedMenu(!showSpeedMenu);
                    setShowSubtitleMenu(false);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-200 text-xs font-semibold border border-[color:var(--border-color)]"
                >
                  <Gauge className="w-4 h-4 text-[color:var(--primary-color)]" />
                  <span>{playbackRate}x</span>
                </button>
                {showSpeedMenu && (
                  <div className="absolute bottom-12 right-0 w-32 rounded-2xl bg-[#0E0E12] border border-[color:var(--border-color)] shadow-2xl p-1.5 z-30">
                    {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => handleSpeedChange(rate)}
                        className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs hover:bg-white/10 text-zinc-200"
                      >
                        <span>{rate}x</span>
                        {playbackRate === rate && (
                          <Check className="w-3.5 h-3.5 text-[color:var(--primary-color)]" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Quality Pill */}
              <div className="hidden md:flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-[color:var(--border-color)]">
                {["4K", "1080p", "720p"].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setSelectedQuality(q)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                      selectedQuality === q
                        ? "bg-[color:var(--primary-color)] text-black"
                        : "text-[color:var(--text-secondary-color)] hover:text-[color:var(--text-color)]"
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={toggleFullscreen}
                data-testid="fullscreen-btn"
                aria-label={isFullscreen ? (lang === "ar" ? "إنهاء ملء الشاشة" : "Exit fullscreen") : (lang === "ar" ? "ملء الشاشة" : "Fullscreen")}
                title={isFullscreen ? (lang === "ar" ? "إنهاء ملء الشاشة" : "Exit fullscreen") : (lang === "ar" ? "ملء الشاشة" : "Fullscreen")}
                className="flex-shrink-0 p-2.5 rounded-xl bg-white/5 hover:bg-white/15 text-[color:var(--text-color)] border border-[color:var(--border-color)] transition"
              >
                {isFullscreen ? (
                  <Minimize className="w-4 h-4" />
                ) : (
                  <Maximize className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
