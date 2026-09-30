"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, Users, Globe2, Film, Tv, Clapperboard, Search, RefreshCw, AlertTriangle, Clock, MousePointerClick, BarChart3 } from "lucide-react";
import type { Language } from "@/lib/translations";
import { adminFetch } from "@/lib/clientAuth";

type Period = "daily" | "weekly" | "monthly";
type L = { ar: string; en: string };
const tr = (lang: Language, l: L) => (lang === "ar" ? l.ar : l.en);

interface StatsResponse {
  period: Period;
  generatedAt: string;
  hasAnyData: boolean;
  summary: {
    visits: number; uniqueVisitors: number; pageViews: number; movieViews: number; seriesViews: number;
    episodeViews: number; contentViews: number; searches: number; countries: number; events: number;
  };
  topCountries: { rank: number; countryCode: string; visits: number; visitors: number; percent: number }[];
  unknownCountryVisits: number;
  chart: { unit: "hour" | "day"; points: { bucket: string; visits: number; visitors: number; views: number }[] };
  topContent: { contentType: string; contentId: number; views: number; viewers: number; titleAr: string; titleEn: string; posterUrl: string }[];
}

const PERIODS: { id: Period; label: L }[] = [
  { id: "daily", label: { ar: "يومي", en: "Daily" } },
  { id: "weekly", label: { ar: "أسبوعي", en: "Weekly" } },
  { id: "monthly", label: { ar: "شهري", en: "Monthly" } },
];

const REFRESH_MS = 30_000;

function flagEmoji(code: string) {
  if (!/^[A-Z]{2}$/.test(code)) return "🏳️";
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

function countryName(code: string, lang: Language) {
  try {
    return new Intl.DisplayNames([lang === "ar" ? "ar" : "en"], { type: "region" }).of(code) || code;
  } catch {
    return code;
  }
}

function fmtNum(n: number, lang: Language) {
  return n.toLocaleString(lang === "ar" ? "ar-EG" : "en-US");
}

function ActivityChart({ data, lang }: { data: StatsResponse["chart"]; lang: Language }) {
  const [hover, setHover] = useState<number | null>(null);
  const pts = data.points;
  const max = Math.max(1, ...pts.map((p) => Math.max(p.visits, p.visitors)));
  const W = 720, H = 220, padL = 34, padB = 28, padT = 12;
  const innerW = W - padL - 8, innerH = H - padB - padT;
  const bw = innerW / Math.max(1, pts.length);
  const label = (b: string) => {
    const d = new Date(`${b}:00`);
    if (data.unit === "hour") return `${String(d.getHours()).padStart(2, "0")}:00`;
    return d.toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", { day: "numeric", month: "short" });
  };
  const every = pts.length > 14 ? Math.ceil(pts.length / 10) : pts.length > 8 ? 2 : 1;
  const ticks = [0, Math.ceil(max / 2), max];
  const linePts = pts.map((p, i) => `${padL + i * bw + bw / 2},${padT + innerH - (p.visitors / max) * innerH}`).join(" ");

  return (
    <div className="relative" dir="ltr">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={tr(lang, { ar: "نشاط الزوار", en: "Visitor activity" })} data-testid="activity-chart">
        {ticks.map((t) => {
          const y = padT + innerH - (t / max) * innerH;
          return (
            <g key={t}>
              <line x1={padL} x2={W - 8} y1={y} y2={y} stroke="currentColor" strokeOpacity={0.08} />
              <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="10" fill="currentColor" opacity={0.5}>{t}</text>
            </g>
          );
        })}
        {pts.map((p, i) => {
          const h = (p.visits / max) * innerH;
          const x = padL + i * bw;
          return (
            <g key={p.bucket} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={x} y={padT} width={bw} height={innerH} fill="transparent" />
              <rect
                x={x + bw * 0.18}
                y={padT + innerH - h}
                width={bw * 0.64}
                height={Math.max(h, p.visits ? 2 : 0)}
                rx={Math.min(4, bw * 0.2)}
                fill="var(--primary-color)"
                opacity={hover === null || hover === i ? 0.9 : 0.45}
              />
              {i % every === 0 && (
                <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="currentColor" opacity={0.55}>{label(p.bucket)}</text>
              )}
            </g>
          );
        })}
        <polyline points={linePts} fill="none" stroke="var(--accent-color)" strokeWidth={2} strokeLinejoin="round" opacity={0.9} />
      </svg>
      {hover !== null && pts[hover] && (
        <div className="absolute top-1 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-xl bg-black/85 border border-white/15 text-[11px] text-white whitespace-nowrap pointer-events-none" dir={lang === "ar" ? "rtl" : "ltr"}>
          <b>{label(pts[hover].bucket)}</b> — {tr(lang, { ar: "زيارات", en: "Visits" })}: {pts[hover].visits} • {tr(lang, { ar: "زوار", en: "Visitors" })}: {pts[hover].visitors} • {tr(lang, { ar: "مشاهدات", en: "Views" })}: {pts[hover].views}
        </div>
      )}
      <div className="flex items-center gap-4 mt-1 text-[11px] text-[color:var(--text-secondary-color)]" dir={lang === "ar" ? "rtl" : "ltr"}>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: "var(--primary-color)" }} />{tr(lang, { ar: "الزيارات", en: "Visits" })}</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-0.5" style={{ background: "var(--accent-color)" }} />{tr(lang, { ar: "الزوار الفريدون", en: "Unique visitors" })}</span>
      </div>
    </div>
  );
}

export default function VisitorStatsPanel({ lang }: { lang: Language }) {
  const [period, setPeriod] = useState<Period>("daily");
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const reqId = useRef(0);

  const load = useCallback(async (p: Period, silent = false) => {
    const id = ++reqId.current;
    if (!silent) setLoading(true);
    setError("");
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const res = await adminFetch(`/api/analytics/visitors?period=${p}&tz=${encodeURIComponent(tz)}`);
      const body = await res.json().catch(() => ({}));
      if (id !== reqId.current) return; // a newer request superseded this one
      if (!res.ok) {
        console.error("[visitor-stats] load failed", res.status, body);
        setError(`${tr(lang, { ar: "تعذر تحميل الإحصائيات", en: "Could not load statistics" })} (HTTP ${res.status})`);
        return;
      }
      setData(body as StatsResponse);
      setLastUpdated(new Date());
    } catch (e) {
      if (id !== reqId.current) return;
      console.error("[visitor-stats] network error", e);
      setError(tr(lang, { ar: "تعذر الاتصال بالخادم لتحميل الإحصائيات", en: "Could not reach the server to load statistics" }));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [lang]);

  useEffect(() => { load(period); }, [period, load]);

  // Auto-refresh while visible
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === "visible") load(period, true); }, REFRESH_MS);
    return () => clearInterval(t);
  }, [period, load]);

  const s = data?.summary;
  const noData = !!data && data.summary.events === 0;

  const cards = useMemo(() => s ? [
    { icon: Eye, label: { ar: "إجمالي الزيارات", en: "Total Visits" }, value: s.visits, testid: "stat-visits" },
    { icon: Users, label: { ar: "الزوار الفريدون", en: "Unique Visitors" }, value: s.uniqueVisitors, testid: "stat-unique" },
    { icon: Globe2, label: { ar: "الدول التي زارت الموقع", en: "Countries" }, value: s.countries, testid: "stat-countries" },
    { icon: Clapperboard, label: { ar: "مشاهدات الأفلام والمسلسلات", en: "Movie & Series Views" }, value: s.contentViews, testid: "stat-content" },
  ] : [], [s]);

  const breakdown = s ? [
    { icon: MousePointerClick, label: { ar: "مشاهدات الصفحات", en: "Page Views" }, value: s.pageViews, testid: "stat-pageviews" },
    { icon: Users, label: { ar: "زوار فريدون", en: "Unique Visitors" }, value: s.uniqueVisitors, testid: "stat-unique-2" },
    { icon: Film, label: { ar: "مشاهدات الأفلام", en: "Movie Views" }, value: s.movieViews, testid: "stat-movie" },
    { icon: Tv, label: { ar: "مشاهدات المسلسلات", en: "Series Views" }, value: s.seriesViews, testid: "stat-series" },
    { icon: Clapperboard, label: { ar: "مشاهدات الحلقات", en: "Episode Views" }, value: s.episodeViews, testid: "stat-episode" },
    { icon: Search, label: { ar: "عمليات البحث", en: "Searches" }, value: s.searches, testid: "stat-search" },
  ] : [];

  return (
    <div className="space-y-5" data-testid="viewing-stats">
      {/* Header: period selector + last updated */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-white/[0.03] border border-[color:var(--border-color)]">
        <div>
          <h3 className="text-base font-black text-[color:var(--text-color)] flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[color:var(--primary-color)]" />
            {tr(lang, { ar: "إحصائيات المشاهدة", en: "Viewing Statistics" })}
          </h3>
          <p className="text-[11px] text-[color:var(--text-secondary-color)] flex items-center gap-1 mt-0.5" data-testid="stats-last-updated">
            <Clock className="w-3 h-3" />
            {tr(lang, { ar: "آخر تحديث", en: "Last updated" })}:{" "}
            {lastUpdated ? lastUpdated.toLocaleString(lang === "ar" ? "ar-EG" : "en-US") : "—"}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              data-testid={`period-${p.id}`}
              onClick={() => setPeriod(p.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${period === p.id ? "bg-[color:var(--primary-color)] text-black" : "bg-white/5 text-[color:var(--text-secondary-color)] hover:bg-white/10"}`}
            >
              {tr(lang, p.label)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => load(period)}
            title={tr(lang, { ar: "تحديث", en: "Refresh" })}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-[color:var(--text-secondary-color)]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && (
        <div data-testid="stats-error" className="flex items-center gap-2 p-4 rounded-2xl bg-[color:var(--accent-color)]/10 border border-[color:var(--accent-color)]/40 text-sm text-[color:var(--text-color)]">
          <AlertTriangle className="w-4 h-4 text-[color:var(--accent-color)]" />
          <span>{error}</span>
        </div>
      )}

      {loading && !data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="stats-loading">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-white/[0.04] animate-pulse" />)}
          <div className="col-span-2 sm:col-span-4 h-56 rounded-2xl bg-white/[0.04] animate-pulse" />
        </div>
      )}

      {data && noData && !error && (
        <div data-testid="stats-empty" className="p-10 rounded-2xl bg-white/[0.03] border border-[color:var(--border-color)] text-center space-y-2">
          <BarChart3 className="w-8 h-8 mx-auto text-[color:var(--text-secondary-color)]" />
          <p className="text-sm font-bold text-[color:var(--text-color)]">لا توجد بيانات مشاهدة كافية حتى الآن</p>
          {lang === "en" && <p className="text-xs text-[color:var(--text-secondary-color)]">Not enough viewing data yet</p>}
        </div>
      )}

      {data && s && !noData && (
        <div className={`space-y-5 transition-opacity ${loading ? "opacity-60" : ""}`}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {cards.map((c) => (
              <div key={c.testid} className="p-4 rounded-2xl bg-white/[0.03] border border-[color:var(--border-color)] hover:border-[color:var(--primary-color)]/40 transition">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-[color:var(--text-secondary-color)]">{tr(lang, c.label)}</p>
                  <c.icon className="w-4 h-4 text-[color:var(--primary-color)]" />
                </div>
                <p className="text-2xl font-black text-[color:var(--primary-color)] mt-1.5" data-testid={c.testid}>{fmtNum(c.value, lang)}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {breakdown.map((b) => (
              <div key={b.testid} className="p-3 rounded-xl bg-black/40 border border-[color:var(--border-color)] flex items-center gap-2.5">
                <b.icon className="w-4 h-4 text-[color:var(--text-secondary-color)] flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-[color:var(--text-secondary-color)] truncate">{tr(lang, b.label)}</p>
                  <p className="text-sm font-black text-[color:var(--text-color)]" data-testid={b.testid}>{fmtNum(b.value, lang)}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3 p-4 rounded-2xl bg-white/[0.03] border border-[color:var(--border-color)] space-y-3 text-[color:var(--text-color)]">
              <h4 className="text-sm font-black">
                {tr(lang, { ar: "نشاط الزوار", en: "Visitor Activity" })}
                <span className="text-[11px] font-normal text-[color:var(--text-secondary-color)] mx-2">
                  {period === "daily" ? tr(lang, { ar: "اليوم حسب الساعة", en: "Today by hour" }) : period === "weekly" ? tr(lang, { ar: "آخر 7 أيام", en: "Last 7 days" }) : tr(lang, { ar: "آخر 30 يوماً", en: "Last 30 days" })}
                </span>
              </h4>
              <ActivityChart data={data.chart} lang={lang} />
            </div>

            <div className="lg:col-span-2 p-4 rounded-2xl bg-white/[0.03] border border-[color:var(--border-color)] space-y-3">
              <h4 className="text-sm font-black text-[color:var(--text-color)] flex items-center gap-2">
                <Globe2 className="w-4 h-4 text-[color:var(--primary-color)]" />
                {tr(lang, { ar: "الدول الأكثر زيارة", en: "Most Visited Countries" })}
              </h4>
              {data.topCountries.length === 0 ? (
                <p className="text-xs text-[color:var(--text-secondary-color)] py-6 text-center">
                  {tr(lang, { ar: "لم يتم تحديد دول الزوار بعد في هذه الفترة", en: "No visitor countries identified in this period yet" })}
                </p>
              ) : (
                <ol className="space-y-2" data-testid="top-countries">
                  {data.topCountries.map((c) => (
                    <li key={c.countryCode} className="space-y-1" data-testid="country-row" data-code={c.countryCode} data-visits={c.visits}>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="w-5 text-center font-black text-[color:var(--primary-color)]">{c.rank}</span>
                          <span className="text-base leading-none">{flagEmoji(c.countryCode)}</span>
                          <span className="font-bold text-[color:var(--text-color)] truncate">{countryName(c.countryCode, lang)}</span>
                        </span>
                        <span className="font-mono text-[color:var(--text-secondary-color)] whitespace-nowrap">
                          {fmtNum(c.visits, lang)} • {c.percent}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.max(3, c.percent)}%`, background: "var(--primary-color)" }} />
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              {data.unknownCountryVisits > 0 && (
                <p className="text-[10px] text-[color:var(--text-secondary-color)]">
                  {tr(lang, { ar: "زيارات بدون دولة محددة", en: "Visits with unknown country" })}: {fmtNum(data.unknownCountryVisits, lang)}
                </p>
              )}
            </div>
          </div>

          {data.topContent.length > 0 && (
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-[color:var(--border-color)] space-y-3">
              <h4 className="text-sm font-black text-[color:var(--text-color)]">{tr(lang, { ar: "الأكثر مشاهدة في هذه الفترة", en: "Most Viewed in This Period" })}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(["movie", "series", "episode"] as const).map((type) => {
                  const items = data.topContent.filter((c) => c.contentType === type);
                  const heading = type === "movie" ? { ar: "الأفلام", en: "Movies" } : type === "series" ? { ar: "المسلسلات", en: "Series" } : { ar: "الحلقات", en: "Episodes" };
                  return (
                    <div key={type} className="space-y-2">
                      <p className="text-[11px] font-bold text-[color:var(--primary-color)]">{tr(lang, heading)}</p>
                      {items.length === 0 ? (
                        <p className="text-[11px] text-[color:var(--text-secondary-color)]">—</p>
                      ) : items.map((c, i) => (
                        <div key={`${type}-${c.contentId}`} className="flex items-center gap-2 p-2 rounded-xl bg-black/40 border border-[color:var(--border-color)]">
                          <span className="text-[11px] font-black text-[color:var(--primary-color)] w-4">{i + 1}</span>
                          <img src={c.posterUrl} alt="" className="w-7 h-10 object-cover rounded" />
                          <span className="flex-1 min-w-0 text-[11px] font-bold text-[color:var(--text-color)] truncate">{lang === "ar" ? c.titleAr : c.titleEn}</span>
                          <span className="text-[11px] font-mono text-[color:var(--text-secondary-color)]">{fmtNum(c.views, lang)}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <p className="text-[11px] text-[color:var(--text-secondary-color)]">
            {tr(lang, { ar: "جميع البيانات حقيقية ومجمّعة من زيارات الموقع الفعلية، ولا تتضمن عناوين IP أو أي معلومات شخصية.", en: "All figures are real, aggregated from actual site traffic, and contain no IP addresses or personal information." })}
          </p>
        </div>
      )}
    </div>
  );
}
