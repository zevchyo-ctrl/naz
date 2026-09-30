"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Upload, Trash2, RotateCcw, Save, X, Eye, Palette, Send, Film, Tv, Activity } from "lucide-react";
import type { Language } from "@/lib/translations";
import type { PlatformSettingsData, ThemeColors, SectionColors } from "@/db/schema";
import {
  DEFAULT_THEME, EMPTY_SECTIONS, THEME_PRESETS, DEFAULT_SITE_NAME, DEFAULT_TELEGRAM_URL,
  buildThemeCss, isHex, normalizeTheme, normalizeSections, normalizeHex,
} from "@/lib/theme";

export interface SaveResult {
  ok: boolean;
  status?: number;
  error?: string;
  fields?: string[];
}

type L = { ar: string; en: string };
const tr = (lang: Language, l: L) => (lang === "ar" ? l.ar : l.en);

const THEME_FIELDS: { key: keyof ThemeColors; label: L }[] = [
  { key: "primary", label: { ar: "اللون الأساسي", en: "Primary Color" } },
  { key: "secondary", label: { ar: "اللون الثانوي", en: "Secondary Color" } },
  { key: "accent", label: { ar: "لون التمييز", en: "Accent Color" } },
  { key: "background", label: { ar: "لون الخلفية", en: "Background Color" } },
  { key: "card", label: { ar: "خلفية البطاقات", en: "Card Background" } },
  { key: "text", label: { ar: "لون النص", en: "Text Color" } },
  { key: "textSecondary", label: { ar: "النص الثانوي", en: "Secondary Text" } },
  { key: "button", label: { ar: "لون الأزرار", en: "Button Color" } },
  { key: "buttonHover", label: { ar: "لون الأزرار عند التمرير", en: "Button Hover" } },
  { key: "border", label: { ar: "لون الحدود", en: "Border Color" } },
  { key: "header", label: { ar: "لون الهيدر", en: "Header Color" } },
  { key: "footer", label: { ar: "لون الفوتر", en: "Footer Color" } },
];

const SECTION_FIELDS: { key: keyof SectionColors; label: L }[] = [
  { key: "header", label: { ar: "الهيدر", en: "Header" } },
  { key: "navigation", label: { ar: "القائمة", en: "Navigation" } },
  { key: "hero", label: { ar: "قسم الواجهة (Hero)", en: "Hero Section" } },
  { key: "movieSections", label: { ar: "أقسام الأفلام", en: "Movie Sections" } },
  { key: "seriesSections", label: { ar: "أقسام المسلسلات", en: "Series Sections" } },
  { key: "movieCard", label: { ar: "بطاقات الأفلام", en: "Movie Cards" } },
  { key: "seriesCard", label: { ar: "بطاقات المسلسلات", en: "Series Cards" } },
  { key: "searchBar", label: { ar: "شريط البحث", en: "Search Bar" } },
  { key: "buttons", label: { ar: "الأزرار", en: "Buttons" } },
  { key: "footer", label: { ar: "الفوتر", en: "Footer" } },
  { key: "loginPage", label: { ar: "صفحة الدخول", en: "Login Page" } },
  { key: "registerPage", label: { ar: "صفحة التسجيل", en: "Register Page" } },
  { key: "userProfile", label: { ar: "الملف الشخصي", en: "User Profile" } },
];

interface Draft {
  siteName: string;
  logoUrl: string;
  telegramContactUrl: string;
  themePreset: string;
  theme: ThemeColors;
  sections: SectionColors;
}

const fromSettings = (s: PlatformSettingsData): Draft => ({
  siteName: s.siteName || DEFAULT_SITE_NAME,
  logoUrl: s.logoUrl || "",
  telegramContactUrl: s.telegramContactUrl || DEFAULT_TELEGRAM_URL,
  themePreset: s.themePreset || "default",
  theme: normalizeTheme(s.theme, DEFAULT_THEME),
  sections: normalizeSections(s.sections, EMPTY_SECTIONS),
});

const FIELD_LABELS: Record<string, L> = {
  siteName: { ar: "اسم الموقع", en: "Website name" },
  logoUrl: { ar: "الشعار", en: "Logo" },
  telegramContactUrl: { ar: "رابط تيليجرام", en: "Telegram URL" },
  themePreset: { ar: "القالب", en: "Theme preset" },
};
function describeFields(lang: Language, fields: string[] = []) {
  return fields
    .map((f) => {
      const base = f.split("=")[0];
      if (FIELD_LABELS[base]) return tr(lang, FIELD_LABELS[base]);
      const [group, key] = base.split(".");
      const list = group === "sections" ? SECTION_FIELDS : THEME_FIELDS;
      const found = (list as { key: string; label: L }[]).find((x) => x.key === key);
      return found ? tr(lang, found.label) : base;
    })
    .join("، ");
}

const DEFAULT_DRAFT: Draft = {
  siteName: DEFAULT_SITE_NAME, logoUrl: "", telegramContactUrl: DEFAULT_TELEGRAM_URL,
  themePreset: "default", theme: DEFAULT_THEME, sections: EMPTY_SECTIONS,
};

const TG_RE = /^(https:\/\/(t\.me|telegram\.me|telegram\.dog)\/[A-Za-z0-9_+/?=&%-]{1,200}|tg:\/\/resolve\?domain=[A-Za-z0-9_]{3,64})$/i;

function ColorField({ label, value, onChange, allowEmpty, lang, testId }: {
  label: string; value: string; onChange: (v: string) => void; allowEmpty?: boolean; lang: Language; testId?: string;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const pickerValue = isHex(value) && value.length === 7 ? value : "#000000";
  return (
    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-black/50 border border-[color:var(--border-color)]">
      <input
        type="color"
        aria-label={label}
        value={pickerValue}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="w-9 h-9 rounded-lg bg-transparent border border-white/20 cursor-pointer flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold text-[color:var(--text-color)] truncate">{label}</p>
        <input
          type="text"
          data-testid={testId}
          value={text}
          placeholder={allowEmpty ? (lang === "ar" ? "افتراضي" : "Inherit") : "#FFD000"}
          onChange={(e) => {
            const v = e.target.value.trim();
            setText(v);
            if (isHex(v) || (allowEmpty && v === "")) onChange(v.toUpperCase());
          }}
          className={`w-full bg-transparent text-[11px] font-mono outline-none ${text && !isHex(text) ? "text-[color:var(--accent-color)]" : "text-[color:var(--text-secondary-color)]"}`}
        />
      </div>
      {allowEmpty && value && (
        <button type="button" onClick={() => onChange("")} title={lang === "ar" ? "استخدام الافتراضي" : "Use default"} className="p-1 rounded-md text-[color:var(--text-secondary-color)] hover:text-[color:var(--text-color)]">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export function CustomizationPanel({ lang, settings, onSave, showToast }: {
  lang: Language;
  settings: PlatformSettingsData;
  onSave: (partial: Record<string, unknown>) => Promise<SaveResult>;
  showToast: (m: string) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => fromSettings(settings));
  const [saving, setSaving] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [error, setError] = useState("");

  const saved = useMemo(() => fromSettings(settings), [settings]);
  const dirty = JSON.stringify(saved) !== JSON.stringify(draft);
  const previewCss = buildThemeCss(draft, ".naz-preview-scope");

  // Manual edit → switches to "custom" but keeps every other (valid) colour
  const setTheme = (k: keyof ThemeColors, v: string) =>
    setDraft((d) => ({ ...d, themePreset: "custom", theme: normalizeTheme({ ...d.theme, [k]: v }, d.theme) }));

  // Preset → apply its COMPLETE theme + section map (never a partial object)
  const applyPreset = (id: string) => {
    const preset = THEME_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setDraft((d) => ({ ...d, themePreset: preset.id, theme: { ...preset.theme }, sections: { ...preset.sections } }));
  };
  const setSection = (k: keyof SectionColors, v: string) =>
    setDraft((d) => ({ ...d, sections: { ...d.sections, [k]: v } }));

  const handleLogoFile = (file: File | undefined) => {
    setError("");
    if (!file) return;
    const okTypes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
    if (!okTypes.includes(file.type)) {
      setError(lang === "ar" ? "نوع الملف غير مدعوم (PNG, JPG, WEBP, SVG)" : "Unsupported file type (PNG, JPG, WEBP, SVG)");
      return;
    }
    if (file.size > 1.5 * 1024 * 1024) {
      setError(lang === "ar" ? "حجم الشعار يجب ألا يتجاوز 1.5 ميغابايت" : "Logo must be 1.5 MB or smaller");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setDraft((d) => ({ ...d, logoUrl: String(reader.result || "") }));
    reader.readAsDataURL(file);
  };

  const save = async () => {
    setError("");
    // Validate the FINAL values that will be saved
    const finalTheme = normalizeTheme(draft.theme, saved.theme);
    const finalSections = normalizeSections(draft.sections, EMPTY_SECTIONS);
    const badTheme = (Object.keys(DEFAULT_THEME) as (keyof ThemeColors)[]).filter((k) => !normalizeHex(draft.theme[k]));
    const badSections = (Object.keys(EMPTY_SECTIONS) as (keyof SectionColors)[]).filter((k) => draft.sections[k] !== "" && !normalizeHex(draft.sections[k]));
    if (badTheme.length || badSections.length) {
      setError(`${tr(lang, { ar: "قيم ألوان غير صالحة:", en: "Invalid colour values:" })} ${describeFields(lang, [...badTheme.map((k) => `theme.${k}`), ...badSections.map((k) => `sections.${k}`)])}`);
      return;
    }
    if (!draft.siteName.trim() || draft.siteName.length > 40) {
      setError(lang === "ar" ? "اسم الموقع مطلوب (40 حرفاً كحد أقصى)" : "Website name is required (max 40 characters)");
      return;
    }
    const tg = draft.telegramContactUrl.trim();
    if (!TG_RE.test(tg)) {
      setError(lang === "ar" ? "رابط تيليجرام غير صالح. مثال: https://t.me/username" : "Invalid Telegram link. Example: https://t.me/username");
      return;
    }

    // Send only what changed (the logo can be ~2 MB — never resend it for a colour change).
    // Theme & sections are always sent COMPLETE so the server stores a full configuration.
    const payload: Record<string, unknown> = {
      themePreset: draft.themePreset,
      theme: finalTheme,
      sections: finalSections,
    };
    if (draft.siteName.trim() !== saved.siteName) payload.siteName = draft.siteName.trim();
    if (tg !== saved.telegramContactUrl) payload.telegramContactUrl = tg;
    if (draft.logoUrl !== saved.logoUrl) payload.logoUrl = draft.logoUrl;

    setSaving(true);
    const res = await onSave(payload);
    setSaving(false);
    if (res.ok) return;
    console.error("[customization] save failed", { status: res.status, error: res.error, fields: res.fields, payloadKeys: Object.keys(payload) });
    if (res.status === 403) {
      setError(tr(lang, {
        ar: "تم رفض الطلب لأسباب أمنية. حدّث الصفحة ثم حاول مرة أخرى.",
        en: "Request blocked by a security check. Refresh the page and try again.",
      }));
    } else if (res.status === 400) {
      setError(res.fields?.length
        ? `${tr(lang, { ar: "قيم غير صالحة:", en: "Invalid values:" })} ${describeFields(lang, res.fields)}`
        : `${tr(lang, { ar: "طلب غير صالح", en: "Invalid request" })}: ${res.error || ""}`);
    } else if (res.status && res.status >= 500) {
      setError(tr(lang, { ar: "حدث خطأ في الخادم. حاول مرة أخرى.", en: "A server error occurred. Please try again." }));
    } else if (res.status === 413) {
      setError(tr(lang, { ar: "حجم الطلب كبير جداً (الشعار). استخدم شعاراً أصغر.", en: "Request too large (logo). Please use a smaller logo." }));
    } else if (!res.status) {
      setError(tr(lang, { ar: "تعذر الاتصال بالخادم. تحقق من الاتصال وحاول مرة أخرى.", en: "Could not reach the server. Check your connection and try again." }));
    } else {
      setError(`${tr(lang, { ar: "تعذر الحفظ", en: "Could not save" })} (HTTP ${res.status}): ${res.error || ""}`);
    }
  };

  const restoreDefaults = async () => {
    setSaving(true);
    const res = await onSave({ resetBranding: true });
    setSaving(false);
    setConfirmRestore(false);
    if (!res.ok) {
      console.error("[customization] restore failed", res);
      setError(`${tr(lang, { ar: "تعذر الاستعادة", en: "Could not restore" })}${res.status ? ` (HTTP ${res.status})` : ""}`);
    }
    if (res.ok) {
      setDraft(DEFAULT_DRAFT);
      showToast(lang === "ar" ? "تمت استعادة المظهر الافتراضي" : "Default theme restored");
    }
  };

  const logoPreview = (size: string) =>
    draft.logoUrl && draft.logoUrl !== "none" ? (
      <img src={draft.logoUrl} alt="logo" className={`${size} object-contain rounded-xl`} />
    ) : draft.logoUrl === "none" ? null : (
      <div className={`${size} rounded-xl bg-[var(--card-color)] border border-[var(--primary-color)] flex items-center justify-center`}>🍿</div>
    );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 min-w-0 w-full" data-testid="customization-panel">
      <style dangerouslySetInnerHTML={{ __html: previewCss }} />

      {/* Controls */}
      <div className="xl:col-span-7 space-y-5 min-w-0">
        {/* Identity */}
        <section className="p-4 rounded-2xl bg-white/[0.03] border border-[color:var(--border-color)] space-y-4">
          <h4 className="text-sm font-black text-[color:var(--text-color)] flex items-center gap-2"><Palette className="w-4 h-4 text-[color:var(--primary-color)]" />{tr(lang, { ar: "هوية الموقع", en: "Website Identity" })}</h4>
          <div>
            <label className="block text-xs text-[color:var(--text-secondary-color)] mb-1">{tr(lang, { ar: "اسم الموقع", en: "Website Name" })}</label>
            <input
              data-testid="site-name-input"
              value={draft.siteName}
              maxLength={40}
              onChange={(e) => setDraft((d) => ({ ...d, siteName: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-xl bg-black/70 border border-[color:var(--border-color)] text-sm text-[color:var(--text-color)]"
            />
          </div>
          <div>
            <label className="block text-xs text-[color:var(--text-secondary-color)] mb-1.5">{tr(lang, { ar: "شعار الموقع", en: "Website Logo" })}</label>
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-14 h-14 rounded-xl bg-black/60 border border-[color:var(--border-color)] flex items-center justify-center overflow-hidden">
                {logoPreview("w-12 h-12") || <span className="text-[10px] text-zinc-500">—</span>}
              </div>
              <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[color:var(--primary-color)] text-black text-xs font-black cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>{tr(lang, { ar: "رفع شعار", en: "Upload Logo" })}</span>
                <input data-testid="logo-file" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => handleLogoFile(e.target.files?.[0])} />
              </label>
              <button type="button" onClick={() => setDraft((d) => ({ ...d, logoUrl: "none" }))} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-[color:var(--border-color)] text-xs font-bold text-[color:var(--text-color)]">
                <Trash2 className="w-3.5 h-3.5" />{tr(lang, { ar: "إزالة الشعار", en: "Remove Logo" })}
              </button>
              <button type="button" onClick={() => setDraft((d) => ({ ...d, logoUrl: "" }))} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-[color:var(--border-color)] text-xs font-bold text-[color:var(--text-color)]">
                <RotateCcw className="w-3.5 h-3.5" />{tr(lang, { ar: "استعادة الشعار الافتراضي", en: "Restore Default Logo" })}
              </button>
            </div>
            <p className="text-[10px] text-zinc-500 mt-1">PNG • JPG/JPEG • WEBP • SVG — max 1.5 MB</p>
          </div>
          <div>
            <label className="block text-xs text-[color:var(--text-secondary-color)] mb-1 flex items-center gap-1.5"><Send className="w-3.5 h-3.5 text-[#229ED9]" />TELEGRAM_CONTACT_URL</label>
            <input
              data-testid="telegram-input"
              dir="ltr"
              value={draft.telegramContactUrl}
              onChange={(e) => setDraft((d) => ({ ...d, telegramContactUrl: e.target.value }))}
              placeholder="https://t.me/username"
              className="w-full px-3.5 py-2.5 rounded-xl bg-black/70 border border-[color:var(--border-color)] text-sm text-[color:var(--text-color)] font-mono"
            />
          </div>
        </section>

        {/* Presets */}
        <section className="p-4 rounded-2xl bg-white/[0.03] border border-[color:var(--border-color)] space-y-3">
          <h4 className="text-sm font-black text-[color:var(--text-color)]">{tr(lang, { ar: "قوالب الألوان الجاهزة", en: "Theme Presets" })}</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {THEME_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                data-testid={`preset-${p.id}`}
                onClick={() => applyPreset(p.id)}
                className={`p-2.5 rounded-xl border text-start transition ${draft.themePreset === p.id ? "border-[color:var(--primary-color)] bg-[color:var(--primary-color)]/10" : "border-[color:var(--border-color)] bg-black/40 hover:border-white/30"}`}
              >
                <div className="flex gap-1 mb-1.5">
                  {[p.theme.primary, p.theme.secondary, p.theme.accent, p.theme.background].map((c, i) => (
                    <span key={i} className="w-4 h-4 rounded-full border border-white/20" style={{ background: c }} />
                  ))}
                </div>
                <p className="text-[11px] font-bold text-[color:var(--text-color)]">{lang === "ar" ? p.nameAr : p.nameEn}</p>
              </button>
            ))}
            <button
              type="button"
              data-testid="preset-custom"
              onClick={() => setDraft((d) => ({ ...d, themePreset: "custom" }))}
              className={`p-2.5 rounded-xl border text-start ${draft.themePreset === "custom" ? "border-[color:var(--primary-color)] bg-[color:var(--primary-color)]/10" : "border-[color:var(--border-color)] bg-black/40"}`}
            >
              <p className="text-[11px] font-bold text-[color:var(--text-color)]">🎨 {tr(lang, { ar: "مخصص", en: "Custom" })}</p>
              <p className="text-[10px] text-[color:var(--text-secondary-color)]">{tr(lang, { ar: "عدّل أي لون يدوياً", en: "Edit any color manually" })}</p>
            </button>
          </div>
        </section>

        {/* Main colors */}
        <section className="p-4 rounded-2xl bg-white/[0.03] border border-[color:var(--border-color)] space-y-3">
          <h4 className="text-sm font-black text-[color:var(--text-color)]">{tr(lang, { ar: "الألوان الرئيسية", en: "Main Colors" })}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {THEME_FIELDS.map((f) => (
              <ColorField key={f.key} testId={`color-${f.key}`} lang={lang} label={tr(lang, f.label)} value={draft.theme[f.key]} onChange={(v) => setTheme(f.key, v)} />
            ))}
          </div>
        </section>

        {/* Section colors */}
        <section className="p-4 rounded-2xl bg-white/[0.03] border border-[color:var(--border-color)] space-y-3">
          <h4 className="text-sm font-black text-[color:var(--text-color)]">{tr(lang, { ar: "ألوان الأقسام", en: "Section Colors" })}</h4>
          <p className="text-[11px] text-[color:var(--text-secondary-color)]">{tr(lang, { ar: "اترك الحقل فارغاً لاستخدام لون القالب", en: "Leave empty to inherit the theme color" })}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SECTION_FIELDS.map((f) => (
              <ColorField key={f.key} testId={`section-${f.key}`} allowEmpty lang={lang} label={tr(lang, f.label)} value={draft.sections[f.key]} onChange={(v) => setSection(f.key, v)} />
            ))}
          </div>
        </section>
      </div>

      {/* Live preview + actions */}
      <div className="xl:col-span-5 space-y-4 xl:sticky xl:top-0 self-start min-w-0">
        <div className="naz-preview-scope rounded-2xl overflow-hidden border border-[var(--border-color)]" data-testid="live-preview" style={{ background: "var(--background-color)", color: "var(--text-color)" }}>
          <div className="px-2 py-1.5 text-[10px] font-bold flex items-center gap-1.5 bg-black/60 text-[color:var(--text-color)]"><Eye className="w-3 h-3" />{tr(lang, { ar: "معاينة مباشرة", en: "Live Preview" })}</div>
          <div className="flex items-center justify-between px-3 py-2.5" style={{ background: "var(--header-color)" }}>
            <div className="flex items-center gap-2">
              {logoPreview("w-8 h-8")}
              <span data-testid="preview-site-name" className="text-sm font-black" style={{ color: "var(--primary-color)" }}>{draft.siteName || " "}</span>
            </div>
            <div className="flex gap-1.5 text-[10px] px-2 py-1 rounded-lg" style={{ background: "var(--nav-color)", color: "var(--text-secondary-color)" }}>
              <span>{tr(lang, { ar: "الرئيسية", en: "Home" })}</span><span>{tr(lang, { ar: "الأفلام", en: "Movies" })}</span>
            </div>
          </div>
          <div className="px-3 py-4 space-y-2" style={{ background: "var(--hero-color)" }}>
            <p className="text-base font-black">{tr(lang, { ar: "رمال الخلود", en: "Sands of Eternity" })}</p>
            <p className="text-[11px]" style={{ color: "var(--text-secondary-color)" }}>{tr(lang, { ar: "وصف قصير للفيلم المميز", en: "Short featured description" })}</p>
            <div className="flex gap-2">
              <span className="naz-btn px-3 py-1.5 rounded-lg text-[11px] font-black text-black">▶ {tr(lang, { ar: "ابدأ المشاهدة", en: "Watch Now" })}</span>
              <span className="px-3 py-1.5 rounded-lg text-[11px] font-bold border border-[var(--border-color)]" style={{ color: "var(--accent-color)" }}>{tr(lang, { ar: "التفاصيل", en: "Details" })}</span>
            </div>
            <div className="px-2.5 py-1.5 rounded-lg text-[10px]" style={{ background: "var(--search-color)", color: "var(--text-secondary-color)" }}>🔎 {tr(lang, { ar: "ابحث...", en: "Search..." })}</div>
          </div>
          <div className="grid grid-cols-2 gap-2 p-3">
            <div className="p-2 rounded-lg" style={{ background: "var(--movie-section-color)" }}>
              <div className="rounded-lg overflow-hidden border border-[var(--border-color)]" style={{ background: "var(--movie-card-color)" }}>
                <div className="h-14 flex items-center justify-center"><Film className="w-5 h-5" style={{ color: "var(--primary-color)" }} /></div>
                <p className="px-1.5 py-1 text-[10px] font-bold">{tr(lang, { ar: "بطاقة فيلم", en: "Movie card" })}</p>
              </div>
            </div>
            <div className="p-2 rounded-lg" style={{ background: "var(--series-section-color)" }}>
              <div className="rounded-lg overflow-hidden border border-[var(--border-color)]" style={{ background: "var(--series-card-color)" }}>
                <div className="h-14 flex items-center justify-center"><Tv className="w-5 h-5" style={{ color: "var(--accent-color)" }} /></div>
                <p className="px-1.5 py-1 text-[10px] font-bold">{tr(lang, { ar: "بطاقة مسلسل", en: "Series card" })}</p>
              </div>
            </div>
          </div>
          <div className="px-3 py-2 text-[10px]" style={{ background: "var(--footer-color)", color: "var(--text-secondary-color)" }}>© {draft.siteName}</div>
        </div>

        {error && <p className="text-xs font-bold text-[color:var(--accent-color)]" data-testid="customization-error">{error}</p>}
        {dirty && <p className="text-[11px] text-[color:var(--primary-color)]">{tr(lang, { ar: "تغييرات غير محفوظة — لن تظهر للزوار حتى الحفظ", en: "Unsaved changes — not live until you save" })}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button type="button" data-testid="customization-save" disabled={saving || !dirty} onClick={save} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[color:var(--primary-color)] text-black text-xs font-black disabled:opacity-50">
            <Save className="w-3.5 h-3.5" />{saving ? "..." : tr(lang, { ar: "حفظ التغييرات", en: "Save Changes" })}
          </button>
          <button type="button" data-testid="customization-cancel" disabled={!dirty} onClick={() => { setDraft(saved); setError(""); }} className="py-2.5 rounded-xl bg-white/10 text-[color:var(--text-color)] text-xs font-bold disabled:opacity-50">
            {tr(lang, { ar: "إلغاء", en: "Cancel" })}
          </button>
          <button type="button" data-testid="customization-reset" onClick={() => setDraft(DEFAULT_DRAFT)} className="py-2.5 rounded-xl bg-white/10 text-[color:var(--text-color)] text-xs font-bold">
            {tr(lang, { ar: "إعادة للافتراضي", en: "Reset to Default" })}
          </button>
        </div>
        <button type="button" data-testid="restore-default-theme" onClick={() => setConfirmRestore(true)} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[color:var(--accent-color)]/15 border border-[color:var(--accent-color)]/40 text-[color:var(--text-color)] text-xs font-bold hover:bg-[color:var(--accent-color)] transition">
          <RotateCcw className="w-3.5 h-3.5" />{tr(lang, { ar: "استعادة المظهر الافتراضي", en: "Restore Default Theme" })}
        </button>
      </div>

      {confirmRestore && (
        <div className="fixed inset-0 z-[170] bg-black/80 backdrop-blur-md flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-3xl bg-[color:var(--card-color)] border border-[color:var(--accent-color)]/40 p-5 space-y-4">
            <p className="text-sm font-bold text-[color:var(--text-color)] leading-relaxed">
              {tr(lang, { ar: "هل أنت متأكد من استعادة مظهر NAZMOVIES الافتراضي؟", en: "Are you sure you want to restore the default NAZMOVIES theme?" })}
            </p>
            <p className="text-[11px] text-[color:var(--text-secondary-color)]">{tr(lang, { ar: "لن يتم حذف الأفلام أو المسلسلات أو المستخدمين أو سجل المشاهدة.", en: "Movies, series, users and watch history will not be deleted." })}</p>
            <div className="flex gap-2">
              <button type="button" data-testid="confirm-restore" disabled={saving} onClick={restoreDefaults} className="flex-1 py-2.5 rounded-xl bg-[color:var(--accent-color)] text-[color:var(--text-color)] text-xs font-black">{saving ? "..." : tr(lang, { ar: "تأكيد", en: "Confirm" })}</button>
              <button type="button" onClick={() => setConfirmRestore(false)} className="flex-1 py-2.5 rounded-xl bg-white/10 text-[color:var(--text-color)] text-xs font-bold">{tr(lang, { ar: "إلغاء", en: "Cancel" })}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
