"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Megaphone, Save, RotateCcw, AlertTriangle, Code2, MousePointerClick, LayoutPanelTop, Film, PanelBottom, Activity } from "lucide-react";
import type { Language } from "@/lib/translations";
import type { AdConfig, AdSlot, PlatformSettingsData } from "@/db/schema";
import { DEFAULT_AD_CONFIG } from "@/lib/defaults";
import type { SaveResult } from "@/components/AdminExtraPanels";

type L = { ar: string; en: string };
const tr = (lang: Language, l: L) => (lang === "ar" ? l.ar : l.en);

/** Mirror for the spec's localStorage contract (the server copy is what visitors actually load). */
export const AD_CONFIG_KEY = "site_ad_config";

type SlotKey = keyof AdConfig;

const SLOTS: { key: SlotKey; icon: typeof Megaphone; title: L; hint: L; placeholder: string }[] = [
  {
    key: "popup",
    icon: MousePointerClick,
    title: { ar: "إعلان منبثق / Popunder", en: "Pop-up / Popunder Ad" },
    hint: {
      ar: "يُشغَّل عند أول نقرة من الزائر (PopAds, PropellerAds, Adsterra…)",
      en: "Fires on the visitor's first interaction (PopAds, PropellerAds, Adsterra…)",
    },
    placeholder: '<script type="text/javascript" src="//pl123456.example.net/pop.js"></script>',
  },
  {
    key: "bannerHeader",
    icon: LayoutPanelTop,
    title: { ar: "بانر أعلى الصفحة", en: "Header Banner" },
    hint: { ar: "يظهر أسفل القائمة العلوية مباشرة", en: "Shown directly beneath the top navigation" },
    placeholder: '<iframe src="//ads.example.com/728x90" width="728" height="90"></iframe>',
  },
  {
    key: "bannerPlayer",
    icon: Film,
    title: { ar: "بانر أسفل المشغل", en: "Below-Player Banner" },
    hint: { ar: "يظهر أسفل مشغل الفيديو أثناء المشاهدة", en: "Shown under the video player while watching" },
    placeholder: '<ins class="adsbygoogle" data-ad-client="ca-pub-..." data-ad-slot="..."></ins>',
  },
  {
    key: "bannerFooter",
    icon: PanelBottom,
    title: { ar: "بانر الفوتر", en: "Footer Banner" },
    hint: { ar: "يظهر أعلى تذييل الموقع", en: "Shown above the site footer" },
    placeholder: '<script async src="//ads.example.com/banner.js"></script>',
  },
  {
    key: "headerScripts",
    icon: Activity,
    title: { ar: "سكربتات الهيدر / التتبع", en: "Header / Tracking Scripts" },
    hint: {
      ar: "Google Analytics، أكواد تحقق الملكية، سكربتات شبكات الإعلانات",
      en: "Google Analytics, site-verification tags, ad-network loaders",
    },
    placeholder: '<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXX"></script>',
  },
];

const normalize = (cfg?: Partial<AdConfig>): AdConfig => {
  const out = { ...DEFAULT_AD_CONFIG } as AdConfig;
  for (const { key } of SLOTS) {
    const incoming = cfg?.[key] as AdSlot | undefined;
    out[key] = { enabled: Boolean(incoming?.enabled), code: String(incoming?.code ?? "") };
  }
  return out;
};

export default function AdManagementPanel({
  lang,
  settings,
  onSave,
  showToast,
}: {
  lang: Language;
  settings: PlatformSettingsData;
  onSave: (partial: Record<string, unknown>) => Promise<SaveResult>;
  showToast: (m: string) => void;
}) {
  const saved = useMemo(() => normalize(settings.adConfig), [settings.adConfig]);
  const [draft, setDraft] = useState<AdConfig>(saved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setDraft(saved), [saved]);

  const dirty = JSON.stringify(saved) !== JSON.stringify(draft);
  const activeCount = SLOTS.filter((s) => draft[s.key].enabled && draft[s.key].code.trim()).length;

  const patch = (key: SlotKey, next: Partial<AdSlot>) =>
    setDraft((d) => ({ ...d, [key]: { ...d[key], ...next } }));

  const handleSave = async () => {
    setError("");
    setSaving(true);
    const res = await onSave({ adConfig: draft });
    setSaving(false);
    if (res.ok) {
      // Spec contract: mirror to localStorage as well as the server copy.
      try {
        localStorage.setItem(AD_CONFIG_KEY, JSON.stringify(draft));
      } catch {
        /* storage unavailable — the server copy is authoritative anyway */
      }
      showToast(tr(lang, { ar: "✅ تم حفظ إعدادات الإعلانات", en: "✅ Ad settings saved" }));
      return;
    }
    console.error("[ads] save failed", res);
    setError(
      res.status === 400
        ? tr(lang, { ar: "كود الإعلان طويل جداً (الحد 20000 حرف).", en: "Ad code is too long (20,000 character limit)." })
        : res.status && res.status >= 500
        ? tr(lang, { ar: "حدث خطأ في الخادم. حاول مرة أخرى.", en: "A server error occurred. Please try again." })
        : tr(lang, { ar: "تعذر حفظ إعدادات الإعلانات.", en: "Could not save ad settings." })
    );
  };

  return (
    <div className="space-y-5" data-testid="ad-management-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-white/[0.03] border border-[color:var(--border-color)]">
        <div>
          <h3 className="text-base font-black text-[color:var(--text-color)] flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-[color:var(--primary-color)]" />
            {tr(lang, { ar: "إدارة الإعلانات", en: "Ad Management" })}
          </h3>
          <p className="text-[11px] text-[color:var(--text-secondary-color)] mt-0.5">
            {tr(lang, {
              ar: "الصق أكواد الإعلانات الخارجية كما هي. الأكواد المعطّلة لا تُحمَّل إطلاقاً.",
              en: "Paste third-party ad tags as-is. Disabled slots are never loaded.",
            })}
          </p>
        </div>
        <span className="px-3 py-1.5 rounded-xl bg-[color:var(--primary-color)]/15 border border-[color:var(--primary-color)]/40 text-xs font-bold text-[color:var(--primary-color)]">
          {activeCount} {tr(lang, { ar: "مساحة مفعّلة", en: "active slots" })}
        </span>
      </div>

      {!settings.adsEnabled && (
        <div className="flex items-start gap-2 p-3.5 rounded-2xl bg-[color:var(--accent-color)]/10 border border-[color:var(--accent-color)]/40 text-xs text-[color:var(--text-color)]">
          <AlertTriangle className="w-4 h-4 text-[color:var(--accent-color)] flex-shrink-0 mt-0.5" />
          <span>
            {tr(lang, {
              ar: 'المفتاح الرئيسي للإعلانات مغلق في تبويب «إعدادات المنصة»، لذلك لن تظهر أي إعلانات حتى لو فعّلت المساحات هنا.',
              en: 'The master "Ads Enabled" switch is off in Admin Settings, so nothing will display even if slots are enabled here.',
            })}
          </span>
        </div>
      )}

      <div className="space-y-4">
        {SLOTS.map(({ key, icon: Icon, title, hint, placeholder }) => {
          const slot = draft[key];
          return (
            <section
              key={key}
              data-testid={`ad-slot-${key}`}
              className="p-4 rounded-2xl bg-white/[0.03] border border-[color:var(--border-color)] space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <Icon className="w-4 h-4 text-[color:var(--primary-color)] flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-[color:var(--text-color)]">{tr(lang, title)}</h4>
                    <p className="text-[11px] text-[color:var(--text-secondary-color)]">{tr(lang, hint)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  data-testid={`ad-toggle-${key}`}
                  aria-pressed={slot.enabled}
                  onClick={() => patch(key, { enabled: !slot.enabled })}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition flex-shrink-0 ${
                    slot.enabled
                      ? "bg-[color:var(--primary-color)] text-black shadow-[0_0_15px_color-mix(in_srgb,var(--primary-color)_35%,transparent)]"
                      : "bg-white/10 text-[color:var(--text-secondary-color)]"
                  }`}
                >
                  {slot.enabled ? tr(lang, { ar: "مفعّل", en: "Active" }) : tr(lang, { ar: "معطّل", en: "Inactive" })}
                </button>
              </div>

              <textarea
                data-testid={`ad-code-${key}`}
                dir="ltr"
                rows={5}
                spellCheck={false}
                value={slot.code}
                onChange={(e) => patch(key, { code: e.target.value })}
                placeholder={placeholder}
                className="w-full p-3 rounded-xl bg-black/70 border border-[color:var(--border-color)] focus:border-[color:var(--primary-color)] outline-none text-[11px] font-mono text-[color:var(--text-color)] resize-y"
              />
              <div className="flex items-center justify-between text-[10px] text-[color:var(--text-secondary-color)]">
                <span className="flex items-center gap-1">
                  <Code2 className="w-3 h-3" />
                  {slot.code.length.toLocaleString()} / 20,000
                </span>
                {slot.enabled && !slot.code.trim() && (
                  <span className="text-[color:var(--accent-color)]">
                    {tr(lang, { ar: "مفعّل لكن بدون كود", en: "Enabled but empty" })}
                  </span>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {error && (
        <p data-testid="ad-error" className="text-xs font-bold text-[color:var(--accent-color)]">
          {error}
        </p>
      )}
      {dirty && (
        <p className="text-[11px] text-[color:var(--primary-color)]">
          {tr(lang, { ar: "تغييرات غير محفوظة", en: "Unsaved changes" })}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="ad-save"
          disabled={saving || !dirty}
          onClick={handleSave}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl naz-btn text-black font-black text-xs disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? "..." : tr(lang, { ar: "حفظ إعدادات الإعلانات", en: "Save Ad Settings" })}
        </button>
        <button
          type="button"
          disabled={!dirty}
          onClick={() => { setDraft(saved); setError(""); }}
          className="px-5 py-3 rounded-2xl bg-white/10 text-[color:var(--text-color)] text-xs font-bold disabled:opacity-50"
        >
          {tr(lang, { ar: "إلغاء", en: "Cancel" })}
        </button>
        <button
          type="button"
          onClick={() => setDraft(normalize())}
          className="flex items-center gap-1.5 px-5 py-3 rounded-2xl bg-white/10 text-[color:var(--text-color)] text-xs font-bold"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {tr(lang, { ar: "تفريغ كل المساحات", en: "Clear all slots" })}
        </button>
      </div>

      <p className="text-[11px] text-[color:var(--text-secondary-color)] leading-relaxed">
        {tr(lang, {
          ar: "ملاحظة: يتم تنفيذ هذه الأكواد كما هي داخل صفحات الموقع، لذلك استخدم شبكات إعلانية موثوقة فقط — أي كود تضعه هنا يحصل على صلاحية كاملة داخل الصفحة.",
          en: "Note: these tags execute as-is inside your pages, so only paste code from ad networks you trust — anything added here runs with full access to the page.",
        })}
      </p>
    </div>
  );
}
