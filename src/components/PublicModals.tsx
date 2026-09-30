"use client";

import React, { useState } from "react";
import {
  X,
  Lock,
  Mail,
  User,
  Phone,
  Crown,
  Sparkles,
  CheckCircle2,
  Send,
  Film,
  ShieldCheck,
  KeyRound,
  LogOut,
  FileText,
} from "lucide-react";
import { Language, translations } from "@/lib/translations";
import { PlatformSettingsData } from "@/db/schema";
import { userFetch } from "@/lib/clientAuth";

export interface ClientUser {
  id: number;
  name: string;
  username: string;
  email: string;
  phone?: string;
  role: string;
  bio?: string;
  preferredLang: string;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  isPremium: boolean;
  plan: string;
}

// 1. HIDDEN 4-CLICK ADMIN LOGIN MODAL
export function AdminLoginModal({
  lang,
  siteName = "NAZMOVIES",
  onClose,
  onSuccess,
  showToast,
}: {
  lang: Language;
  siteName?: string;
  onClose: () => void;
  onSuccess: () => void;
  showToast: (msg: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    setError("");
    if (!password.trim()) {
      setError(lang === "ar" ? "كلمة المرور غير صحيحة" : "Incorrect password");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin", // receive + store the HttpOnly session cookie
        cache: "no-store",
        body: JSON.stringify({ password: password.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.authenticated) {
        setSuccess(true);
        showToast(lang === "ar" ? "تم تسجيل الدخول بنجاح" : "Login successful");
        onSuccess();
      } else {
        setPassword("");
        setError(lang === "ar" ? "كلمة المرور غير صحيحة" : "Incorrect password");
      }
    } catch {
      setError(lang === "ar" ? "تعذر الاتصال بالخادم" : "Connection error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] bg-black/85 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl bg-[color:var(--card-color)] border border-[color:var(--primary-color)]/40 shadow-[0_0_60px_color-mix(in_srgb,var(--primary-color)_20%,transparent)] p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[color:var(--primary-color)]/15 border border-[color:var(--primary-color)]/40 flex items-center justify-center text-[color:var(--primary-color)]">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-[color:var(--text-color)]">
                {lang === "ar"
                  ? `بوابة الإدارة السرية — ${siteName}`
                  : `${siteName} — Hidden Admin Access`}
              </h3>
              <p className="text-xs text-[color:var(--text-secondary-color)]">
                {lang === "ar"
                  ? "أدخل رمز المرور الخاص بالمدير للمتابعة"
                  : "Enter administrator access credential to continue"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-[color:var(--text-secondary-color)] hover:text-[color:var(--text-color)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[color:var(--text-secondary-color)] mb-1.5">
              {lang === "ar" ? "كلمة مرور الإدارة" : "Administrator Password"}
            </label>
            <input
              type="password"
              autoFocus
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-2xl bg-black border border-[color:var(--border-color)] focus:border-[color:var(--primary-color)] outline-none text-sm text-[color:var(--text-color)] tracking-widest"
            />
          </div>

          {error && (
            <p data-testid="admin-login-error" className="text-xs text-[color:var(--accent-color)] font-semibold">{error}</p>
          )}
          {success && (
            <p className="text-xs text-emerald-400 font-semibold">
              {lang === "ar" ? "تم تسجيل الدخول بنجاح" : "Login successful"}
            </p>
          )}

          <button
            type="submit"
            data-testid="admin-login-submit"
            disabled={loading}
            className="w-full py-3 rounded-2xl naz-btn text-black font-black text-sm shadow-[0_0_25px_color-mix(in_srgb,var(--primary-color)_35%,transparent)] hover:brightness-110 transition disabled:opacity-70"
          >
            {loading
              ? "..."
              : lang === "ar"
              ? "تسجيل الدخول"
              : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}

// 2. USER EMAIL AUTH / REGISTER / RESET / PROFILE MODAL
export function UserAuthModal({
  lang,
  currentUser,
  settings,
  onClose,
  onAuthSuccess,
  onLogout,
  onOpenPremiumModal,
  showToast,
  renderAccountTab,
  initialTab = "continue",
}: {
  lang: Language;
  currentUser: ClientUser | null;
  settings: PlatformSettingsData;
  onClose: () => void;
  onAuthSuccess: (u: ClientUser, token?: string) => void;
  onLogout: () => void;
  onOpenPremiumModal: () => void;
  showToast: (msg: string) => void;
  renderAccountTab?: (tab: "continue" | "history" | "favorites") => React.ReactNode;
  initialTab?: "continue" | "history" | "favorites" | "settings";
}) {
  const t = translations[lang];
  const siteName = settings.siteName || "NAZMOVIES";
  const [accountTab, setAccountTab] = useState<"continue" | "history" | "favorites" | "settings">(initialTab);
  const [mode, setMode] = useState<"login" | "register" | "reset" | "profile">(
    currentUser ? "profile" : "login"
  );

  const [email, setEmail] = useState(currentUser?.email || "");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [name, setName] = useState(currentUser?.name || "");
  const [username, setUsername] = useState(currentUser?.username || "");
  const [phone, setPhone] = useState(currentUser?.phone || "");
  const [bio, setBio] = useState(currentUser?.bio || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const actionMap = {
        login: "login",
        register: "register",
        reset: "reset_password",
        profile: "edit_profile",
      };

      const res = await userFetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: actionMap[mode],
          email,
          password,
          newPassword,
          name,
          username,
          phone,
          bio,
          preferredLang: lang,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Authentication error");
      } else if (data.user) {
        onAuthSuccess(data.user, data.token);
        showToast(
          mode === "register"
            ? lang === "ar"
              ? "🎉 تم إنشاء حسابك بنجاح! يمكنك استخدام الموقع فوراً"
              : "🎉 Account created! You have immediate access"
            : mode === "reset"
            ? lang === "ar"
              ? "✅ تم تحديث كلمة المرور بنجاح"
              : "✅ Password reset successfully"
            : mode === "profile"
            ? lang === "ar"
              ? "✅ تم حفظ التغييرات في ملفك الشخصي"
              : "✅ Profile updated successfully"
            : lang === "ar"
            ? `👋 مرحباً بعودتك، ${data.user.name}`
            : `👋 Welcome back, ${data.user.name}`
        );
        if (mode !== "profile") {
          onClose();
        }
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[125] bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto">
      <div
        data-testid="auth-modal"
        style={{ backgroundColor: currentUser ? "var(--profile-color)" : mode === "register" ? "var(--register-color)" : "var(--login-color)" }}
        className={`w-full ${currentUser ? "max-w-3xl" : "max-w-lg"} rounded-3xl border border-[color:var(--border-color)] shadow-[0_0_70px_color-mix(in_srgb,var(--primary-color)_15%,transparent)] p-4 sm:p-6 space-y-5 max-h-[94vh] overflow-y-auto`}
      >
        <div className="flex items-center justify-between border-b border-[color:var(--border-color)] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[color:var(--primary-color)] to-[color:var(--secondary-color)] text-black flex items-center justify-center font-black">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-[color:var(--text-color)]">
                {currentUser
                  ? t.editProfile
                  : mode === "login"
                  ? t.login
                  : mode === "register"
                  ? t.register
                  : t.resetPassword}
              </h3>
              <p className="text-xs text-[color:var(--text-secondary-color)]">
                {siteName} — {t.brandSubtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-[color:var(--text-secondary-color)] hover:text-[color:var(--text-color)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!currentUser && (
          <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-2xl border border-[color:var(--border-color)]">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError("");
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
                mode === "login"
                  ? "bg-[color:var(--primary-color)] text-black"
                  : "text-[color:var(--text-secondary-color)] hover:text-[color:var(--text-color)]"
              }`}
            >
              {t.login}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError("");
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
                mode === "register"
                  ? "bg-[color:var(--primary-color)] text-black"
                  : "text-[color:var(--text-secondary-color)] hover:text-[color:var(--text-color)]"
              }`}
            >
              {t.register}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("reset");
                setError("");
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
                mode === "reset"
                  ? "bg-[color:var(--primary-color)] text-black"
                  : "text-[color:var(--text-secondary-color)] hover:text-[color:var(--text-color)]"
              }`}
            >
              {t.resetPassword}
            </button>
          </div>
        )}

        {/* Verification status badge when registering */}
        {!currentUser && mode === "register" && (
          <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
            <ShieldCheck className="w-4 h-4 flex-shrink-0" />
            <span>
              {!settings.requireEmailVerification &&
              !settings.requirePhoneVerification
                ? t.noVerificationRequiredNote
                : lang === "ar"
                ? "ملاحظة: التحقق مفعل حالياً من إعدادات الإدارة"
                : "Note: Verification is currently enabled by Admin settings"}
            </span>
          </div>
        )}

        {/* Logged-in user summary banner */}
        {currentUser && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-[#161308] to-[#14090B] border border-[color:var(--primary-color)]/30 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-[color:var(--text-color)]">
                  {currentUser.name}
                </span>
                {currentUser.isPremium ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-[color:var(--primary-color)] text-black text-[11px] font-black flex items-center gap-1">
                    <Crown className="w-3 h-3" /> {t.premiumBadge}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-white/10 text-[color:var(--text-secondary-color)] text-[11px]">
                    Free Plan
                  </span>
                )}
              </div>
              <p className="text-xs text-[color:var(--text-secondary-color)] mt-0.5">
                @{currentUser.username} • {currentUser.email}
              </p>
            </div>
            {!currentUser.isPremium && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPremiumModal();
                }}
                className="px-3 py-1.5 rounded-xl bg-[color:var(--primary-color)] text-black text-xs font-bold hover:brightness-110 transition"
              >
                {t.upgradeAdFree}
              </button>
            )}
          </div>
        )}

        {currentUser && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-white/5 p-1.5 rounded-2xl border border-[color:var(--border-color)]">
            {([
              ["continue", t.continueWatching],
              ["history", t.watchHistory],
              ["favorites", t.favorites],
              ["settings", t.accountSettings],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                data-testid={`account-tab-${id}`}
                onClick={() => setAccountTab(id)}
                className={`flex-1 whitespace-nowrap px-3 py-2 rounded-xl text-xs font-bold transition ${
                  accountTab === id ? "bg-[color:var(--primary-color)] text-black" : "text-[color:var(--text-secondary-color)] hover:text-[color:var(--text-color)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {currentUser && accountTab !== "settings" && renderAccountTab && (
          <div>{renderAccountTab(accountTab)}</div>
        )}

        {(!currentUser || accountTab === "settings") && (
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {(mode === "register" || mode === "profile") && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[color:var(--text-secondary-color)] mb-1">
                  {t.fullName}
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black border border-[color:var(--border-color)] text-xs text-[color:var(--text-color)]"
                />
              </div>
              <div>
                <label className="block text-xs text-[color:var(--text-secondary-color)] mb-1">
                  {t.username}
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black border border-[color:var(--border-color)] text-xs text-[color:var(--text-color)]"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs text-[color:var(--text-secondary-color)] mb-1">
              {t.email}
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-500 absolute top-3 left-3.5 rtl:left-auto rtl:right-3.5" />
              <input
                type="email"
                required
                disabled={mode === "profile"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full pl-10 rtl:pl-3.5 rtl:pr-10 pr-3.5 py-2.5 rounded-xl bg-black border border-[color:var(--border-color)] text-xs text-[color:var(--text-color)] disabled:opacity-60"
              />
            </div>
          </div>

          {(mode === "login" || mode === "register") && (
            <div>
              <label className="block text-xs text-[color:var(--text-secondary-color)] mb-1">
                {t.password}
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-zinc-500 absolute top-3 left-3.5 rtl:left-auto rtl:right-3.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 rtl:pl-3.5 rtl:pr-10 pr-3.5 py-2.5 rounded-xl bg-black border border-[color:var(--border-color)] text-xs text-[color:var(--text-color)]"
                />
              </div>
            </div>
          )}

          {mode === "reset" && (
            <div>
              <label className="block text-xs text-[color:var(--text-secondary-color)] mb-1">{t.username}</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-black border border-[color:var(--border-color)] text-xs text-[color:var(--text-color)]"
              />
            </div>
          )}
          {mode === "reset" && (
            <div>
              <label className="block text-xs text-[color:var(--text-secondary-color)] mb-1">
                {t.newPassword}
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl bg-black border border-[color:var(--border-color)] text-xs text-[color:var(--text-color)]"
              />
            </div>
          )}

          {(mode === "register" || mode === "profile") && (
            <div>
              <label className="block text-xs text-[color:var(--text-secondary-color)] mb-1">
                {t.phone}
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-zinc-500 absolute top-3 left-3.5 rtl:left-auto rtl:right-3.5" />
                <input
                  type="text"
                  required={settings.requirePhoneVerification}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+966 50 000 0000"
                  className="w-full pl-10 rtl:pl-3.5 rtl:pr-10 pr-3.5 py-2.5 rounded-xl bg-black border border-[color:var(--border-color)] text-xs text-[color:var(--text-color)]"
                />
              </div>
            </div>
          )}

          {mode === "profile" && (
            <div>
              <label className="block text-xs text-[color:var(--text-secondary-color)] mb-1">
                {t.bio}
              </label>
              <textarea
                rows={2}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-black border border-[color:var(--border-color)] text-xs text-[color:var(--text-color)]"
              />
            </div>
          )}

          {error && (
            <p className="text-xs text-[color:var(--accent-color)] font-semibold">{error}</p>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 rounded-2xl naz-btn text-black font-black text-xs shadow-[0_0_25px_color-mix(in_srgb,var(--primary-color)_35%,transparent)] hover:brightness-110 transition"
            >
              {loading
                ? "..."
                : mode === "login"
                ? t.login
                : mode === "register"
                ? t.register
                : mode === "reset"
                ? t.resetPassword
                : t.saveChanges}
            </button>

            {currentUser && (
              <button
                type="button"
                onClick={() => {
                  onLogout();
                  onClose();
                }}
                className="flex items-center gap-1.5 px-4 py-3 rounded-2xl bg-[color:var(--accent-color)]/20 hover:bg-[color:var(--accent-color)] text-[color:var(--text-color)] text-xs font-bold border border-[color:var(--accent-color)]/40 transition"
              >
                <LogOut className="w-4 h-4" />
                <span>{t.logout}</span>
              </button>
            )}
          </div>
        </form>
        )}

        {currentUser && accountTab !== "settings" && (
          <button
            type="button"
            onClick={() => { onLogout(); onClose(); }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[color:var(--accent-color)]/20 hover:bg-[color:var(--accent-color)] text-[color:var(--text-color)] text-xs font-bold border border-[color:var(--accent-color)]/40 transition"
          >
            <LogOut className="w-4 h-4" />
            <span>{t.logout}</span>
          </button>
        )}
      </div>
    </div>
  );
}

// CONTACT ADMINISTRATION (Telegram)
export function ContactModal({
  lang,
  siteName,
  telegramUrl,
  onClose,
}: {
  lang: Language;
  siteName: string;
  telegramUrl: string;
  onClose: () => void;
}) {
  const t = translations[lang];
  return (
    <div className="fixed inset-0 z-[125] bg-black/85 backdrop-blur-xl flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div data-testid="contact-modal" className="w-full max-w-lg rounded-3xl bg-[color:var(--card-color)] border border-[color:var(--primary-color)]/35 shadow-[0_0_70px_color-mix(in_srgb,var(--primary-color)_18%,transparent)] p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#229ED9]/15 border border-[#229ED9]/50 flex items-center justify-center">
              <Send className="w-5 h-5 text-[#229ED9]" />
            </div>
            <h3 className="text-base sm:text-lg font-black text-[color:var(--text-color)]">{t.contactTitle.replace("{site}", siteName)}</h3>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-[color:var(--text-secondary-color)] hover:text-[color:var(--text-color)]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-[color:var(--text-secondary-color)] leading-relaxed">{t.contactDesc}</p>
        <a
          data-testid="telegram-link"
          href={telegramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-[#229ED9] hover:brightness-110 text-[color:var(--text-color)] font-black text-sm transition"
        >
          <Send className="w-4 h-4" />
          <span>{t.contactTelegram}</span>
        </a>
      </div>
    </div>
  );
}

// 3. REQUEST A MOVIE / SERIES MODAL ("اطلب فيلمًا" / "Request a Movie")
export function MovieRequestModal({
  lang,
  currentUser,
  onClose,
  showToast,
}: {
  lang: Language;
  currentUser: ClientUser | null;
  onClose: () => void;
  showToast: (msg: string) => void;
}) {
  const t = translations[lang];
  const [title, setTitle] = useState("");
  const [year, setYear] = useState(2026);
  const [mediaType, setMediaType] = useState<"movie" | "series">("movie");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [message, setMessage] = useState("");
  const [requesterName, setRequesterName] = useState(currentUser?.name || "");
  const [requesterEmail, setRequesterEmail] = useState(
    currentUser?.email || ""
  );
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await userFetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "movie_request",
          title,
          year,
          mediaType,
          referenceUrl,
          message,
          requesterName: requesterName || currentUser?.name || "زائر",
          requesterEmail: requesterEmail || currentUser?.email || "",
          userId: currentUser?.id,
        }),
      });
      if (res.ok) {
        showToast(
          lang === "ar"
            ? "🎬 تم استلام طلبك بنجاح! سيظهر في لوحة الإدارة لتوفيره قريباً"
            : "🎬 Your movie request has been submitted to our curation team!"
        );
        onClose();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[125] bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-3xl bg-[color:var(--card-color)] border border-[color:var(--primary-color)]/35 shadow-[0_0_70px_color-mix(in_srgb,var(--primary-color)_18%,transparent)] p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-[color:var(--border-color)] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[color:var(--primary-color)]/15 border border-[color:var(--primary-color)]/40 text-[color:var(--primary-color)] flex items-center justify-center">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-[color:var(--text-color)]">
                {t.requestModalTitle}
              </h3>
              <p className="text-xs text-[color:var(--text-secondary-color)]">{t.requestModalSubtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-[color:var(--text-secondary-color)] hover:text-[color:var(--text-color)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs text-[color:var(--text-secondary-color)] mb-1">
                {t.requestedTitle} *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  lang === "ar"
                    ? "مثال: Oppenheimer / الحشاشين"
                    : "e.g. Interstellar / Breaking Bad"
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-black border border-[color:var(--border-color)] text-xs text-[color:var(--text-color)]"
              />
            </div>
            <div>
              <label className="block text-xs text-[color:var(--text-secondary-color)] mb-1">
                {t.year}
              </label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-black border border-[color:var(--border-color)] text-xs text-[color:var(--text-color)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-[color:var(--text-secondary-color)] mb-1">
              {t.requestType}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMediaType("movie")}
                className={`py-2.5 rounded-xl text-xs font-bold border transition ${
                  mediaType === "movie"
                    ? "bg-[color:var(--primary-color)] text-black border-[color:var(--primary-color)]"
                    : "bg-black text-[color:var(--text-secondary-color)] border-[color:var(--border-color)]"
                }`}
              >
                🎬 {t.movies}
              </button>
              <button
                type="button"
                onClick={() => setMediaType("series")}
                className={`py-2.5 rounded-xl text-xs font-bold border transition ${
                  mediaType === "series"
                    ? "bg-[color:var(--primary-color)] text-black border-[color:var(--primary-color)]"
                    : "bg-black text-[color:var(--text-secondary-color)] border-[color:var(--border-color)]"
                }`}
              >
                📺 {t.series}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs text-[color:var(--text-secondary-color)] mb-1">
              {t.referenceLink}
            </label>
            <input
              type="text"
              value={referenceUrl}
              onChange={(e) => setReferenceUrl(e.target.value)}
              placeholder="https://www.imdb.com/title/..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-black border border-[color:var(--border-color)] text-xs text-[color:var(--text-color)]"
            />
          </div>

          {!currentUser && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[color:var(--text-secondary-color)] mb-1">
                  {t.fullName} ({lang === "ar" ? "اختياري" : "Optional"})
                </label>
                <input
                  type="text"
                  value={requesterName}
                  onChange={(e) => setRequesterName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-black border border-[color:var(--border-color)] text-xs text-[color:var(--text-color)]"
                />
              </div>
              <div>
                <label className="block text-xs text-[color:var(--text-secondary-color)] mb-1">
                  {t.email} ({lang === "ar" ? "اختياري" : "Optional"})
                </label>
                <input
                  type="email"
                  value={requesterEmail}
                  onChange={(e) => setRequesterEmail(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-black border border-[color:var(--border-color)] text-xs text-[color:var(--text-color)]"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs text-[color:var(--text-secondary-color)] mb-1">
              {t.yourMessage}
            </label>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                lang === "ar"
                  ? "يرجى توفيره بجودة 4K مع الترجمة العربية..."
                  : "Preferred in 4K Ultra HD with Arabic & English subtitles..."
              }
              className="w-full px-3.5 py-2 rounded-xl bg-black border border-[color:var(--border-color)] text-xs text-[color:var(--text-color)]"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-2xl naz-btn text-black font-black text-xs shadow-[0_0_25px_color-mix(in_srgb,var(--primary-color)_35%,transparent)] hover:brightness-110 transition flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" />
            <span>{submitting ? "..." : t.submitRequest}</span>
          </button>
        </form>
      </div>
    </div>
  );
}

// 4. PREMIUM AD-FREE UPGRADE MODAL ("الترقية بدون إعلانات" / "Upgrade to Ad-Free")
export function PremiumUpgradeModal({
  lang,
  currentUser,
  settings,
  onClose,
  showToast,
}: {
  lang: Language;
  currentUser: ClientUser | null;
  settings: PlatformSettingsData;
  onClose: () => void;
  showToast: (msg: string) => void;
}) {
  const t = translations[lang];
  const premium = settings.premiumSettings || {
    price: "",
    telegramUsername: "",
    paymentInstructions: "",
  };
  const price = premium.price || "—";
  const handle = (premium.telegramUsername || "").replace(/^@/, "");

  const [name, setName] = useState(currentUser?.name || currentUser?.username || "");
  const [email, setEmail] = useState(currentUser?.email || "");
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const benefits =
    lang === "ar"
      ? [
          "مشاهدة نقية 100% بدون أي إعلانات ترويجية",
          "شارة حساب Premium ذهبية مميزة في ملفك الشخصي",
          "أولوية الاتصال بسيرفرات 4K Ultra HD السريعة",
          "أولوية تلبية طلبات الأفلام والدعم الفني المباشر",
        ]
      : [
          "100% uninterrupted streaming with zero advertisements",
          "Exclusive Golden Premium badge on your profile",
          "Priority access to high-bitrate 4K Ultra HD servers",
          "Priority movie requests & dedicated support",
        ];

  /** Opens Telegram with a pre-filled, formatted subscription message. */
  const sendViaTelegram = async () => {
    setError("");
    if (!handle) {
      setError(
        lang === "ar"
          ? "لم يتم ضبط حساب تليجرام للإدارة بعد. يرجى التواصل مع مالك الموقع."
          : "The admin Telegram account has not been configured yet."
      );
      return;
    }
    if (!name.trim() || !email.trim() || !method.trim()) {
      setError(
        lang === "ar"
          ? "يرجى إدخال الاسم والبريد الإلكتروني وطريقة الدفع."
          : "Please fill in your name, email and payment method."
      );
      return;
    }

    const now = new Date().toLocaleString(lang === "ar" ? "ar-EG" : "en-US");
    const message =
      lang === "ar"
        ? `طلب اشتراك بريميوم جديد:
- اسم المستخدم: ${name.trim()}
- البريد الإلكتروني: ${email.trim()}
- السعر / الباقة: ${price}
- طريقة الدفع: ${method.trim()}${reference.trim() ? `
- رقم/ملاحظة التحويل: ${reference.trim()}` : ""}
- تاريخ الطلب: ${now}`
        : `New premium subscription request:
- Username: ${name.trim()}
- Email: ${email.trim()}
- Plan / Price: ${price}
- Payment method: ${method.trim()}${reference.trim() ? `
- Transfer reference: ${reference.trim()}` : ""}
- Request date: ${now}`;

    const url = `https://t.me/${handle}?text=${encodeURIComponent(message)}`;
    // Open Telegram first so it is tied to the click (avoids pop-up blocking)
    window.open(url, "_blank", "noopener,noreferrer");

    // Also record the request in the dashboard so the admin has a durable copy
    setSending(true);
    try {
      await userFetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "premium_upgrade",
          userId: currentUser?.id,
          name: name.trim(),
          email: email.trim(),
          username: currentUser?.username || name.trim(),
          currentPlan: currentUser?.isPremium ? "Premium" : "Free",
          requestedPlan: price,
          message: `${method.trim()}${reference.trim() ? ` — ${reference.trim()}` : ""}`,
        }),
      });
    } catch {
      /* Telegram already opened; the dashboard copy is a convenience */
    } finally {
      setSending(false);
    }

    showToast(
      lang === "ar"
        ? "📨 تم فتح تليجرام بالرسالة الجاهزة — أرسلها لتأكيد اشتراكك"
        : "📨 Telegram opened with your pre-filled message — send it to confirm"
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[125] bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto">
      <div
        data-testid="premium-modal"
        className="w-full max-w-xl rounded-3xl bg-gradient-to-b from-[#120F07] via-[color:var(--card-color)] to-[color:var(--background-color)] border border-[color:var(--primary-color)]/50 shadow-[0_0_80px_color-mix(in_srgb,var(--primary-color)_22%,transparent)] p-5 sm:p-6 space-y-5 max-h-[94vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[color:var(--border-color)] pb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 flex-shrink-0 rounded-2xl naz-btn text-black flex items-center justify-center shadow-[0_0_25px_color-mix(in_srgb,var(--primary-color)_50%,transparent)]">
              <Crown className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-black text-[color:var(--text-color)]">{t.premiumModalTitle}</h3>
              <p className="text-xs text-[color:var(--primary-color)]">{t.premiumModalSubtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-[color:var(--text-secondary-color)] hover:text-[color:var(--text-color)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Price */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-[color:var(--primary-color)]/10 border border-[color:var(--primary-color)]/40">
          <span className="text-xs font-bold text-[color:var(--text-color)]">
            {lang === "ar" ? "سعر الاشتراك" : "Subscription price"}
          </span>
          <span data-testid="premium-price-display" className="text-xl font-black text-[color:var(--primary-color)]">
            {price}
          </span>
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {benefits.map((b, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 p-3 rounded-2xl bg-white/[0.04] border border-[color:var(--primary-color)]/20 text-xs text-[color:var(--text-color)]"
            >
              <CheckCircle2 className="w-4 h-4 text-[color:var(--primary-color)] flex-shrink-0" />
              <span>{b}</span>
            </div>
          ))}
        </div>

        {/* Payment instructions from the admin */}
        {premium.paymentInstructions?.trim() && (
          <div className="p-4 rounded-2xl bg-black/50 border border-[color:var(--border-color)] space-y-2">
            <h4 className="text-xs font-black text-[color:var(--primary-color)]">
              {lang === "ar" ? "طرق الدفع وتعليمات التحويل" : "Payment methods & instructions"}
            </h4>
            <p
              data-testid="premium-instructions-display"
              className="text-xs text-[color:var(--text-color)] leading-relaxed whitespace-pre-line"
            >
              {premium.paymentInstructions}
            </p>
          </div>
        )}

        {/* Confirmation form */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-[color:var(--primary-color)]">
            <Sparkles className="w-4 h-4" />
            <span>{lang === "ar" ? "بيانات تأكيد التحويل" : "Transfer confirmation details"}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-[color:var(--text-secondary-color)] mb-1">{t.fullName} *</label>
              <input
                data-testid="premium-form-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-black border border-[color:var(--border-color)] text-xs text-[color:var(--text-color)]"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[color:var(--text-secondary-color)] mb-1">{t.email} *</label>
              <input
                data-testid="premium-form-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-black border border-[color:var(--border-color)] text-xs text-[color:var(--text-color)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-[color:var(--text-secondary-color)] mb-1">
                {lang === "ar" ? "طريقة الدفع المستخدمة" : "Payment method used"} *
              </label>
              <input
                data-testid="premium-form-method"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                placeholder={lang === "ar" ? "فودافون كاش / PayPal / USDT" : "Vodafone Cash / PayPal / USDT"}
                className="w-full px-3 py-2 rounded-xl bg-black border border-[color:var(--border-color)] text-xs text-[color:var(--text-color)]"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[color:var(--text-secondary-color)] mb-1">
                {lang === "ar" ? "رقم العملية / ملاحظة" : "Transfer reference / note"}
              </label>
              <input
                data-testid="premium-form-reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-black border border-[color:var(--border-color)] text-xs text-[color:var(--text-color)]"
              />
            </div>
          </div>

          {error && (
            <p data-testid="premium-form-error" className="text-xs font-bold text-[color:var(--accent-color)]">
              {error}
            </p>
          )}

          <button
            type="button"
            data-testid="premium-telegram-send"
            disabled={sending}
            onClick={sendViaTelegram}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-[#229ED9] hover:brightness-110 text-white font-black text-sm transition disabled:opacity-60"
          >
            <Send className="w-4 h-4" />
            <span>{lang === "ar" ? "إرسال تأكيد التحويل عبر تليجرام" : "Send confirmation via Telegram"}</span>
          </button>

          <p className="text-[10px] text-[color:var(--text-secondary-color)] text-center">
            {lang === "ar"
              ? "سيتم فتح تليجرام برسالة جاهزة تحتوي بياناتك — راجعها ثم اضغط إرسال."
              : "Telegram opens with a pre-filled message containing your details — review it and press send."}
          </p>
        </div>
      </div>
    </div>
  );
}

// 5. DEDICATED LEGAL / INFO MODAL (About Us, Privacy Policy, Terms of Service)
export function LegalPageModal({
  page,
  lang,
  settings,
  onClose,
}: {
  page: "about" | "privacy" | "terms";
  lang: Language;
  settings: PlatformSettingsData;
  onClose: () => void;
}) {
  const t = translations[lang];

  const title =
    page === "about"
      ? t.aboutUs
      : page === "privacy"
      ? t.privacyPolicy
      : t.termsOfService;

  const content =
    page === "about"
      ? lang === "ar"
        ? settings.aboutUsAr
        : settings.aboutUsEn
      : page === "privacy"
      ? lang === "ar"
        ? settings.privacyPolicyAr
        : settings.privacyPolicyEn
      : lang === "ar"
      ? settings.termsOfServiceAr
      : settings.termsOfServiceEn;

  return (
    <div className="fixed inset-0 z-[125] bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-3xl rounded-3xl bg-[color:var(--card-color)] border border-[color:var(--primary-color)]/30 shadow-[0_0_70px_color-mix(in_srgb,var(--primary-color)_15%,transparent)] p-6 sm:p-8 space-y-5 max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-[color:var(--border-color)] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[color:var(--primary-color)]/15 border border-[color:var(--primary-color)]/40 text-[color:var(--primary-color)] flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-[color:var(--text-color)]">{title}</h2>
              <p className="text-xs text-[color:var(--primary-color)]">
                {settings.siteName || "NAZMOVIES"} — {t.brandSubtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-[color:var(--text-secondary-color)] hover:text-[color:var(--text-color)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 space-y-4 text-sm text-zinc-200 leading-relaxed whitespace-pre-line">
          {content}
        </div>
      </div>
    </div>
  );
}
