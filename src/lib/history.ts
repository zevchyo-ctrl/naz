import type { EpisodeRecord } from "@/db/schema";

export interface HistoryItem {
  id: number;
  mediaType: "movie" | "series";
  contentId: number;
  episodeId: number;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitleAr: string;
  episodeTitleEn: string;
  currentTime: number;
  duration: number;
  completed: boolean;
  updatedAt: string;
  titleAr: string;
  titleEn: string;
  posterUrl: string;
  backdropUrl: string;
}

export interface ContinueEntry {
  key: string;
  mediaType: "movie" | "series";
  contentId: number;
  episodeId: number;
  seasonNumber: number;
  episodeNumber: number;
  titleAr: string;
  titleEn: string;
  posterUrl: string;
  currentTime: number;
  duration: number;
  percent: number;
  updatedAt: string;
  isNextEpisode: boolean;
}

export function percentOf(ct: number, du: number) {
  if (!du || du <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((ct / du) * 100)));
}

/** Map key for quick lookup: movie-12-0 / series-3-45 */
export function progressKey(mediaType: string, contentId: number, episodeId = 0) {
  return `${mediaType}-${contentId}-${episodeId || 0}`;
}

export function buildContinueWatching(items: HistoryItem[], episodes: EpisodeRecord[]): ContinueEntry[] {
  const out: ContinueEntry[] = [];
  const seenSeries = new Set<number>();
  // items arrive newest first
  for (const it of items) {
    if (it.mediaType === "movie") {
      if (it.completed || it.currentTime < 1) continue;
      out.push({
        key: `m-${it.contentId}`,
        mediaType: "movie",
        contentId: it.contentId,
        episodeId: 0,
        seasonNumber: 0,
        episodeNumber: 0,
        titleAr: it.titleAr,
        titleEn: it.titleEn,
        posterUrl: it.posterUrl,
        currentTime: it.currentTime,
        duration: it.duration,
        percent: percentOf(it.currentTime, it.duration),
        updatedAt: it.updatedAt,
        isNextEpisode: false,
      });
      continue;
    }
    if (seenSeries.has(it.contentId)) continue; // only the latest episode per series
    seenSeries.add(it.contentId);

    if (!it.completed) {
      out.push({
        key: `s-${it.contentId}`,
        mediaType: "series",
        contentId: it.contentId,
        episodeId: it.episodeId,
        seasonNumber: it.seasonNumber,
        episodeNumber: it.episodeNumber,
        titleAr: it.titleAr,
        titleEn: it.titleEn,
        posterUrl: it.posterUrl,
        currentTime: it.currentTime,
        duration: it.duration,
        percent: percentOf(it.currentTime, it.duration),
        updatedAt: it.updatedAt,
        isNextEpisode: false,
      });
      continue;
    }

    // Latest episode finished → suggest the next one
    const list = episodes
      .filter((e) => e.seriesId === it.contentId)
      .sort((a, b) => a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber);
    const idx = list.findIndex((e) => e.id === it.episodeId);
    const next = idx >= 0 ? list[idx + 1] : undefined;
    if (!next) continue;
    out.push({
      key: `s-${it.contentId}`,
      mediaType: "series",
      contentId: it.contentId,
      episodeId: next.id,
      seasonNumber: next.seasonNumber,
      episodeNumber: next.episodeNumber,
      titleAr: it.titleAr,
      titleEn: it.titleEn,
      posterUrl: it.posterUrl,
      currentTime: 0,
      duration: 0,
      percent: 0,
      updatedAt: it.updatedAt,
      isNextEpisode: true,
    });
  }
  return out.slice(0, 20);
}
