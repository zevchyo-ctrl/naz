"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Crown, Save, Send, AlertTriangle } from "lucide-react";
import type { Language } from "@/lib/translations";
import type { PlatformSettingsData, PremiumSettings } from "@/db/schema";
import { DEFAULT_PREMIUM_SETTINGS } from "@/lib/defaults";
import type { SaveResult } from "@/components/AdminExtraPanels";

type L = { ar: string; en: string };
const tr = (lang: Language, l: L) => (lang === "ar" ? l.ar : l.en);

/** Mirror for the spec's localStorage contract (the server copy is what users load). */
export const PREMIUM_SETTINGS_KEY = "site_premium_settings";

const TG_USER_RE = /^@?[A-Za-z0-9_]{4,32}$/;

export default function PremiumSettingsPanel({
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
  const saved = useMemo<PremiumSettings>(
    () => ({ ...DEFAULT_PREMIUM_SETTINGS, ...(settings.premiumSettings || {}) }),
    [settings.premiumSettings]
  );
  const [draft, setDraft] = useState<PremiumSettings>(saved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setDraft(saved), [saved]);
  const dirty = JSON.stringify(saved) !== JSON.stringify(draft);

  const handleSave = async () => {
    setError("");
    if (draft.telegramUsername && !TG_USER_RE.test(draft.telegramUsername.trim())) {
      setError(tr(lang, {
        ar: "اسم مستخدم تليجرام غير صالح. مثال: @NazAdmin (4–32 حرفاً، حروف وأرقام و _ فقط)",
        en: "Invalid Telegram username. Example: @NazAdmin (4–32 chars: letters, numbers, underscore)",
      }));
      return;
    }
    setSaving(true);
    const res = await onSave({ premiumSettings: draft });
    setSaving(false);
    if (res.ok) {
      try {
        localStorage.setItem(PREMIUM_SETTINGS_KEY, JSON.stringify(draft));
      } catch { /* storage unavailable */ }
      showToast(tr(lang, { ar: "✅ تم حفظ إعدادات الاشتراك", en: "✅ Subscription settings saved" }));
      return;
    }
    console.error("[premium-settings] save failed", res);
    setError(
      res.fields?.length
        ? tr(lang, { ar: "تحقق من اسم مستخدم تليجرام.", en: "Please check the Telegram username." })
        : tr(lang, { ar: "تعذر الحفظ. حاول مرة أخرى.", en: "Could not save. Please try again." })
    );
  };

  const handle = draft.telegramUsername.replace(/^@/, "");

  return (
    <div className="space-y-4" data-testid="premium-settings-panel">
      <div className="p-4 rounded-2xl bg-white/[0.03] border border-[color:var(--border-color)]">
        <h3 className="text-base font-black text-[color:var(--text-color)] flex items-center gap-2">
          <Crown className="w-4 h-4 text-[color:var(--primary-color)]" />
          {tr(lang, { ar: "إعدادات الاشتراك المميز", en: "Premium Subscription Settings" })}
        </h3>
        <p className="text-[11px] text-[color:var(--text-secondary-color)] mt-0.5">
          {tr(lang, {
            ar: "تظهر هذه البيانات للمستخدم في صفحة الترقية، ويُرسَل التأكيد إلى حسابك على تليجرام.",
            en: "These details appear on the user's upgrade page, and confirmations are sent to your Telegram.",
          })}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-[color:var(--text-secondary-color)] mb-1">
            {tr(lang, { ar: "سعر الاشتراك", en: "Subscription Price" })}
          </label>
          <input
            data-testid="premium-price"
            value={draft.price}
            maxLength={60}
            onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
            placeholder="$5 / Month"
            className="w-full px-3.5 py-2.5 rounded-xl bg-black/70 border border-[color:var(--border-color)] focus:border-[color:var(--primary-color)] outline-none text-sm text-[color:var(--text-color)]"
          />
        </div>
        <div>
          <label className="block text-xs text-[color:var(--text-secondary-color)] mb-1 flex items-center gap-1.5">
            <Send className="w-3.5 h-3.5 text-[#229ED9]" />
            {tr(lang, { ar: "حساب تليجرام للإدارة", en: "Admin Telegram Username" })}
          </label>
          <input
            data-testid="premium-telegram"
            dir="ltr"
            value={draft.telegramUsername}
            onChange={(e) => setDraft((d) => ({ ...d, telegramUsername: e.target.value }))}
            placeholder="@YourTelegramHandler"
            className="w-full px-3.5 py-2.5 rounded-xl bg-black/70 border border-[color:var(--border-color)] focus:border-[color:var(--primary-color)] outline-none text-sm font-mono text-[color:var(--text-color)]"
          />
          {handle && (
            <p className="text-[10px] text-[color:var(--text-secondary-color)] mt-1" dir="ltr">
              https://t.me/{handle}
            </p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-xs text-[color:var(--text-secondary-color)] mb-1">
          {tr(lang, { ar: "طرق الدفع وتعليمات التحويل", en: "Payment Methods & Instructions" })}
        </label>
        <textarea
          data-testid="premium-instructions"
          rows={8}
          value={draft.paymentInstructions}
          maxLength={5000}
          onChange={(e) => setDraft((d) => ({ ...d, paymentInstructions: e.target.value }))}
          placeholder={tr(lang, {
            ar: "فودافون كاش / PayPal / USDT / تحويل بنكي...",
            en: "Vodafone Cash / PayPal / USDT wallet / bank transfer…",
          })}
          className="w-full p-3 rounded-xl bg-black/70 border border-[color:var(--border-color)] focus:border-[color:var(--primary-color)] outline-none text-xs text-[color:var(--text-color)] leading-relaxed resize-y"
        />
        <p className="text-[10px] text-[color:var(--text-secondary-color)] mt-1">
          {draft.paymentInstructions.length.toLocaleString()} / 5,000
        </p>
      </div>

      {error && (
        <p data-testid="premium-settings-error" className="flex items-center gap-1.5 text-xs font-bold text-[color:var(--accent-color)]">
          <AlertTriangle className="w-3.5 h-3.5" />
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
          data-testid="premium-settings-save"
          disabled={saving || !dirty}
          onClick={handleSave}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl naz-btn text-black font-black text-xs disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? "..." : tr(lang, { ar: "حفظ إعدادات الاشتراك", en: "Save Subscription Settings" })}
        </button>
        <button
          type="button"
          disabled={!dirty}
          onClick={() => { setDraft(saved); setError(""); }}
          className="px-5 py-3 rounded-2xl bg-white/10 text-[color:var(--text-color)] text-xs font-bold disabled:opacity-50"
        >
          {tr(lang, { ar: "إلغاء", en: "Cancel" })}
        </button>
      </div>
    </div>
  );
}
