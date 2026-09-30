"use client";

import React, { useState } from "react";
import { Play, Trash2, Check, Clock, Heart } from "lucide-react";
import { Language, translations } from "@/lib/translations";
import { ContinueEntry, HistoryItem, percentOf } from "@/lib/history";
import { formatClock } from "@/lib/theme";
import type { MovieRecord, SeriesRecord } from "@/db/schema";

const mins = (sec: number) => Math.max(0, Math.round((sec || 0) / 60));

export function ContinueWatchingCard({
  entry,
  lang,
  onContinue,
}: {
  entry: ContinueEntry;
  lang: Language;
  onContinue: (e: ContinueEntry) => void;
}) {
  const t = translations[lang];
  return (
    <div
      data-testid="continue-card"
      onClick={() => onContinue(entry)}
      className="group cursor-pointer rounded-2xl overflow-hidden border border-[color:var(--border-color)] hover:border-[color:var(--primary-color)] transition bg-[var(--card-color)] flex flex-col"
    >
      <div className="relative aspect-[2/3] overflow-hidden">
        <img src={entry.posterUrl} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
          <div className="w-12 h-12 rounded-full bg-[color:var(--primary-color)] text-black flex items-center justify-center">
            <Play className="w-5 h-5 fill-current" />
          </div>
        </div>
        <div className="absolute bottom-0 inset-x-0 p-3 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-[color:var(--text-color)]">
            <span>{entry.isNextEpisode ? t.continueFromEpisode + " " + entry.episodeNumber : `${entry.percent}%`}</span>
            {!entry.isNextEpisode && <span className="text-[color:var(--text-secondary-color)]">{formatClock(entry.currentTime)}</span>}
          </div>
          <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
            <div className="h-full bg-[color:var(--primary-color)]" style={{ width: `${entry.percent}%` }} />
          </div>
        </div>
      </div>
      <div className="p-3 space-y-1.5">
        <h4 className="text-xs sm:text-sm font-bold text-[color:var(--text-color)] truncate">{lang === "ar" ? entry.titleAr : entry.titleEn}</h4>
        {entry.mediaType === "series" && (
          <p className="text-[11px] text-[color:var(--primary-color)]">
            {t.season} {entry.seasonNumber} • {t.episode} {entry.episodeNumber}
          </p>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onContinue(entry); }}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg naz-btn text-black text-[11px] font-black"
        >
          <Play className="w-3 h-3 fill-current" />
          <span>{t.continueWatching}</span>
        </button>
      </div>
    </div>
  );
}

export function ContinueWatchingGrid({
  entries, lang, onContinue,
}: { entries: ContinueEntry[]; lang: Language; onContinue: (e: ContinueEntry) => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {entries.map((e) => <ContinueWatchingCard key={e.key} entry={e} lang={lang} onContinue={onContinue} />)}
    </div>
  );
}

export function WatchHistoryPanel({
  items, lang, onResume, onClear,
}: {
  items: HistoryItem[];
  lang: Language;
  onResume: (item: HistoryItem) => void;
  onClear: () => Promise<void>;
}) {
  const t = translations[lang];
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-black text-[color:var(--text-color)]">{t.watchHistory} ({items.length})</h4>
        {items.length > 0 && (
          <button
            type="button"
            data-testid="clear-history"
            onClick={() => setConfirmOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[color:var(--accent-color)]/15 border border-[color:var(--accent-color)]/40 text-xs font-bold text-[color:var(--text-color)] hover:bg-[color:var(--accent-color)] transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t.clearHistory}</span>
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-[color:var(--text-secondary-color)] p-6 text-center rounded-2xl bg-black/40 border border-[color:var(--border-color)]">{t.noHistory}</p>
      ) : (
        <div className="space-y-2 max-h-[46vh] overflow-y-auto pr-1" data-testid="history-list">
          {items.map((it) => {
            const pct = it.completed ? 100 : percentOf(it.currentTime, it.duration);
            return (
              <button
                type="button"
                key={it.id}
                onClick={() => onResume(it)}
                className="w-full text-start flex items-center gap-3 p-2.5 rounded-2xl bg-black/50 border border-[color:var(--border-color)] hover:border-[color:var(--primary-color)]/60 transition"
              >
                <img src={it.posterUrl} alt="" className="w-11 h-16 object-cover rounded-lg flex-shrink-0" />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-[color:var(--text-color)] truncate">{lang === "ar" ? it.titleAr : it.titleEn}</p>
                    {it.completed ? (
                      <span className="flex items-center gap-1 text-[10px] font-black text-emerald-400 whitespace-nowrap">
                        <Check className="w-3 h-3" />{t.watchedBadge.replace("✓ ", "")}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-[color:var(--primary-color)]">{pct}%</span>
                    )}
                  </div>
                  {it.mediaType === "series" && (
                    <p className="text-[11px] text-[color:var(--primary-color)]">
                      {t.season} {it.seasonNumber} • {t.episode} {it.episodeNumber}
                    </p>
                  )}
                  <p className="text-[11px] text-[color:var(--text-secondary-color)]">
                    {t.watchedOf.replace("{a}", String(mins(it.completed ? it.duration : it.currentTime))).replace("{b}", String(mins(it.duration)))}
                  </p>
                  <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                    <div className={`h-full ${it.completed ? "bg-emerald-400" : "bg-[color:var(--primary-color)]"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[10px] text-zinc-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {t.lastViewed}: {new Date(it.updatedAt).toLocaleString(lang === "ar" ? "ar-SA" : "en-US")}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {confirmOpen && (
        <div className="fixed inset-0 z-[160] bg-black/80 backdrop-blur-md flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-3xl bg-[var(--card-color)] border border-[color:var(--accent-color)]/40 p-5 space-y-4">
            <h5 className="text-sm font-black text-[color:var(--text-color)]">{t.clearHistory}</h5>
            <p className="text-xs text-[color:var(--text-secondary-color)] leading-relaxed">{t.clearHistoryConfirm}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="confirm-clear-history"
                disabled={busy}
                onClick={async () => { setBusy(true); await onClear(); setBusy(false); setConfirmOpen(false); }}
                className="flex-1 py-2.5 rounded-xl bg-[color:var(--accent-color)] text-[color:var(--text-color)] text-xs font-black disabled:opacity-60"
              >
                {busy ? "..." : t.confirm}
              </button>
              <button type="button" onClick={() => setConfirmOpen(false)} className="flex-1 py-2.5 rounded-xl bg-white/10 text-[color:var(--text-color)] text-xs font-bold">
                {t.cancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function FavoritesPanel({
  lang, favoriteKeys, moviesList, seriesList, onOpen,
}: {
  lang: Language;
  favoriteKeys: string[];
  moviesList: MovieRecord[];
  seriesList: SeriesRecord[];
  onOpen: (type: "movie" | "series", id: number) => void;
}) {
  const t = translations[lang];
  const favs = [
    ...moviesList.filter((m) => favoriteKeys.includes(`movie-${m.id}`)).map((m) => ({ type: "movie" as const, item: m })),
    ...seriesList.filter((s) => favoriteKeys.includes(`series-${s.id}`)).map((s) => ({ type: "series" as const, item: s })),
  ];
  if (favs.length === 0) {
    return <p className="text-xs text-[color:var(--text-secondary-color)] p-6 text-center rounded-2xl bg-black/40 border border-[color:var(--border-color)]">{t.noFavorites}</p>;
  }
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
      {favs.map(({ type, item }) => (
        <button key={`${type}-${item.id}`} type="button" onClick={() => onOpen(type, item.id)} className="text-start rounded-xl overflow-hidden border border-[color:var(--border-color)] hover:border-[color:var(--primary-color)] transition">
          <div className="relative aspect-[2/3]">
            <img src={item.posterUrl} alt="" className="w-full h-full object-cover" />
            <Heart className="absolute top-1.5 end-1.5 w-4 h-4 text-[color:var(--accent-color)] fill-current" />
          </div>
          <p className="p-1.5 text-[11px] font-bold text-[color:var(--text-color)] truncate">{lang === "ar" ? item.titleAr : item.titleEn}</p>
        </button>
      ))}
    </div>
  );
}
