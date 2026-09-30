"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users as UsersIcon, UserPlus, Crown, UserRound, Search, Trash2, Ban, CheckCircle2,
  RefreshCw, AlertTriangle, KeyRound, Eye, EyeOff, ShieldAlert,
} from "lucide-react";
import type { Language } from "@/lib/translations";
import { adminFetch } from "@/lib/clientAuth";

type L = { ar: string; en: string };
const tr = (lang: Language, l: L) => (lang === "ar" ? l.ar : l.en);

/** Mirror for the spec's localStorage contract (PostgreSQL remains the source of truth). */
export const USERS_DB_KEY = "site_users_db";

interface AdminUser {
  id: number;
  name: string;
  username: string;
  email: string;
  password: string;
  hasPassword: boolean;
  role: string;
  isPremium: boolean;
  plan: string;
  isBlocked: boolean;
  createdAt: string;
}
interface Stats { total: number; today: number; premium: number; free: number; blocked: number }

export default function UsersPanel({ lang, showToast }: { lang: Language; showToast: (m: string) => void }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [plaintextCapture, setPlaintextCapture] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [showPasswords, setShowPasswords] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null);
  const [pwTarget, setPwTarget] = useState<AdminUser | null>(null);
  const [pwValue, setPwValue] = useState("");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const res = await adminFetch(`/api/admin/users?tzOffset=${new Date().getTimezoneOffset()}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("[users] load failed", res.status, body);
        setError(`${tr(lang, { ar: "تعذر تحميل المستخدمين", en: "Could not load users" })} (HTTP ${res.status})`);
        return;
      }
      setUsers(body.users || []);
      setStats(body.stats || null);
      setPlaintextCapture(body.plaintextCapture !== false);
      try {
        localStorage.setItem(USERS_DB_KEY, JSON.stringify(body.users || []));
      } catch { /* storage unavailable */ }
    } catch (e) {
      console.error("[users] network error", e);
      setError(tr(lang, { ar: "تعذر الاتصال بالخادم.", en: "Could not reach the server." }));
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => { load(); }, [load]);

  const act = async (u: AdminUser, action: string, password?: string) => {
    setBusyId(u.id);
    try {
      const res = await adminFetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: u.id, action, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(body.error || tr(lang, { ar: "فشل تنفيذ العملية", en: "Action failed" }));
        return false;
      }
      setUsers((prev) => prev.map((x) => (x.id === u.id ? body.user : x)));
      await load(true);
      return true;
    } finally {
      setBusyId(null);
    }
  };

  const removeUser = async (u: AdminUser) => {
    setBusyId(u.id);
    try {
      const res = await adminFetch(`/api/admin/users?id=${u.id}`, { method: "DELETE" });
      if (res.ok) {
        setUsers((prev) => prev.filter((x) => x.id !== u.id));
        await load(true);
        showToast(tr(lang, { ar: "🗑️ تم حذف الحساب", en: "🗑️ Account deleted" }));
      } else {
        showToast(tr(lang, { ar: "تعذر حذف الحساب", en: "Could not delete account" }));
      }
    } finally {
      setBusyId(null);
      setConfirmDelete(null);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const plan = u.isPremium ? "premium مميز" : "free مجاني";
      const status = u.isBlocked ? "blocked محظور" : "active نشط";
      return [u.username, u.name, u.email, plan, status, String(u.id)].join(" ").toLowerCase().includes(q);
    });
  }, [users, query]);

  const cards = stats ? [
    { icon: UsersIcon, label: { ar: "إجمالي المستخدمين", en: "Total Users" }, value: stats.total, testid: "users-total" },
    { icon: UserPlus, label: { ar: "مسجلون اليوم", en: "Registered Today" }, value: stats.today, testid: "users-today" },
    { icon: Crown, label: { ar: "حسابات مميزة", en: "Premium Users" }, value: stats.premium, testid: "users-premium" },
    { icon: UserRound, label: { ar: "حسابات مجانية", en: "Free Users" }, value: stats.free, testid: "users-free" },
  ] : [];

  const fmtDate = (d: string) =>
    new Date(d).toLocaleString(lang === "ar" ? "ar-EG" : "en-US", {
      year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });

  return (
    <div className="space-y-5" data-testid="users-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-white/[0.03] border border-[color:var(--border-color)]">
        <div>
          <h3 className="text-base font-black text-[color:var(--text-color)] flex items-center gap-2">
            <UsersIcon className="w-4 h-4 text-[color:var(--primary-color)]" />
            {tr(lang, { ar: "إدارة المستخدمين", en: "User Management" })}
          </h3>
          <p className="text-[11px] text-[color:var(--text-secondary-color)] mt-0.5">
            {tr(lang, { ar: "ترقية، حظر، حذف، وتعيين كلمات المرور", en: "Upgrade, block, delete and set passwords" })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-[color:var(--text-secondary-color)]"
          title={tr(lang, { ar: "تحديث", en: "Refresh" })}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Summary counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.testid} className="p-4 rounded-2xl bg-white/[0.03] border border-[color:var(--border-color)]">
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-[color:var(--text-secondary-color)]">{tr(lang, c.label)}</p>
              <c.icon className="w-4 h-4 text-[color:var(--primary-color)]" />
            </div>
            <p className="text-2xl font-black text-[color:var(--primary-color)] mt-1.5" data-testid={c.testid}>
              {c.value.toLocaleString(lang === "ar" ? "ar-EG" : "en-US")}
            </p>
          </div>
        ))}
      </div>

      {stats && stats.blocked > 0 && (
        <p className="text-[11px] text-[color:var(--text-secondary-color)]">
          <Ban className="w-3 h-3 inline mx-1 text-[color:var(--accent-color)]" />
          {stats.blocked} {tr(lang, { ar: "حساب محظور حالياً", en: "account(s) currently blocked" })}
        </p>
      )}

      {/* Search + password visibility */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-[color:var(--primary-color)] absolute top-3 start-3.5 pointer-events-none" />
          <input
            data-testid="users-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tr(lang, {
              ar: "ابحث باسم المستخدم أو البريد أو نوع الحساب...",
              en: "Search by username, email or account type...",
            })}
            className="w-full ps-10 pe-3.5 py-2.5 rounded-xl bg-black/60 border border-[color:var(--border-color)] focus:border-[color:var(--primary-color)] outline-none text-xs text-[color:var(--text-color)]"
          />
        </div>
        <button
          type="button"
          data-testid="toggle-passwords"
          onClick={() => setShowPasswords((v) => !v)}
          className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/5 border border-[color:var(--border-color)] text-xs font-bold text-[color:var(--text-color)]"
        >
          {showPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {showPasswords
            ? tr(lang, { ar: "إخفاء كلمات المرور", en: "Hide passwords" })
            : tr(lang, { ar: "إظهار كلمات المرور", en: "Show passwords" })}
        </button>
        <span className="text-[11px] text-[color:var(--text-secondary-color)]">
          {filtered.length} / {users.length}
        </span>
      </div>

      {error && (
        <div data-testid="users-error" className="flex items-center gap-2 p-4 rounded-2xl bg-[color:var(--accent-color)]/10 border border-[color:var(--accent-color)]/40 text-sm text-[color:var(--text-color)]">
          <AlertTriangle className="w-4 h-4 text-[color:var(--accent-color)]" />
          <span>{error}</span>
        </div>
      )}

      {loading && users.length === 0 && (
        <div className="space-y-2" data-testid="users-loading">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl bg-white/[0.04] animate-pulse" />)}
        </div>
      )}

      {!loading && users.length === 0 && !error && (
        <p className="p-10 text-center text-sm text-[color:var(--text-secondary-color)] rounded-2xl bg-white/[0.03] border border-[color:var(--border-color)]">
          {tr(lang, { ar: "لا يوجد مستخدمون مسجلون بعد", en: "No registered users yet" })}
        </p>
      )}

      {/* Users table (scrolls horizontally on small screens) */}
      {users.length > 0 && (
        <div className="rounded-2xl bg-white/[0.03] border border-[color:var(--border-color)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start" data-testid="users-table">
              <thead>
                <tr className="border-b border-[color:var(--border-color)] text-[color:var(--text-secondary-color)]">
                  <th className="py-3 px-3 text-start font-bold">ID</th>
                  <th className="py-3 px-3 text-start font-bold">{tr(lang, { ar: "اسم المستخدم", en: "Username" })}</th>
                  <th className="py-3 px-3 text-start font-bold">{tr(lang, { ar: "البريد الإلكتروني", en: "Email" })}</th>
                  <th className="py-3 px-3 text-start font-bold">{tr(lang, { ar: "كلمة المرور", en: "Password" })}</th>
                  <th className="py-3 px-3 text-start font-bold whitespace-nowrap">{tr(lang, { ar: "تاريخ التسجيل", en: "Registered" })}</th>
                  <th className="py-3 px-3 text-start font-bold">{tr(lang, { ar: "الحالة", en: "Status" })}</th>
                  <th className="py-3 px-3 text-start font-bold">{tr(lang, { ar: "الإجراءات", en: "Actions" })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((u) => (
                  <tr key={u.id} data-testid={`user-row-${u.id}`} className={`hover:bg-white/[0.02] transition ${u.isBlocked ? "opacity-60" : ""}`}>
                    <td className="py-3 px-3 font-mono text-[color:var(--text-secondary-color)]">{u.id}</td>
                    <td className="py-3 px-3">
                      <p className="font-bold text-[color:var(--text-color)] whitespace-nowrap">{u.name}</p>
                      <p className="text-[10px] text-[color:var(--text-secondary-color)]">@{u.username}</p>
                    </td>
                    <td className="py-3 px-3 text-[color:var(--text-secondary-color)] whitespace-nowrap">{u.email}</td>
                    <td className="py-3 px-3 font-mono" data-testid={`user-pw-${u.id}`}>
                      {u.password ? (
                        <span className="text-[color:var(--text-color)]">{showPasswords ? u.password : "••••••••"}</span>
                      ) : (
                        <span className="text-[10px] text-[color:var(--text-secondary-color)]" title={tr(lang, {
                          ar: "كلمة المرور مخزّنة مشفّرة ولا يمكن استرجاعها — استخدم «تعيين كلمة مرور»",
                          en: "Stored hashed and not reversible — use “Set password”",
                        })}>
                          {tr(lang, { ar: "مشفّرة", en: "hashed" })}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-[color:var(--text-secondary-color)] whitespace-nowrap">{fmtDate(u.createdAt)}</td>
                    <td className="py-3 px-3">
                      <div className="flex flex-col gap-1">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black w-fit ${
                          u.isPremium ? "bg-[color:var(--primary-color)] text-black" : "bg-white/10 text-[color:var(--text-secondary-color)]"
                        }`}>
                          {u.isPremium ? tr(lang, { ar: "مميز", en: "Premium" }) : tr(lang, { ar: "مجاني", en: "Free" })}
                        </span>
                        {u.isBlocked && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black w-fit bg-[color:var(--accent-color)] text-white">
                            {tr(lang, { ar: "محظور", en: "Blocked" })}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          data-testid={`user-plan-${u.id}`}
                          disabled={busyId === u.id}
                          onClick={() => act(u, u.isPremium ? "free" : "premium")}
                          title={u.isPremium ? tr(lang, { ar: "إرجاع إلى مجاني", en: "Downgrade to Free" }) : tr(lang, { ar: "ترقية إلى مميز", en: "Upgrade to Premium" })}
                          className={`p-2 rounded-lg transition disabled:opacity-40 ${
                            u.isPremium ? "bg-white/10 text-[color:var(--text-secondary-color)] hover:bg-white/20" : "bg-[color:var(--primary-color)]/20 text-[color:var(--primary-color)] hover:bg-[color:var(--primary-color)] hover:text-black"
                          }`}
                        >
                          <Crown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          data-testid={`user-block-${u.id}`}
                          disabled={busyId === u.id}
                          onClick={() => act(u, u.isBlocked ? "unblock" : "block")}
                          title={u.isBlocked ? tr(lang, { ar: "رفع الحظر", en: "Unblock" }) : tr(lang, { ar: "حظر", en: "Block" })}
                          className={`p-2 rounded-lg transition disabled:opacity-40 ${
                            u.isBlocked ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-black" : "bg-white/10 text-[color:var(--text-secondary-color)] hover:bg-[color:var(--accent-color)] hover:text-white"
                          }`}
                        >
                          {u.isBlocked ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          data-testid={`user-setpw-${u.id}`}
                          disabled={busyId === u.id}
                          onClick={() => { setPwTarget(u); setPwValue(""); }}
                          title={tr(lang, { ar: "تعيين كلمة مرور", en: "Set password" })}
                          className="p-2 rounded-lg bg-white/10 text-[color:var(--text-secondary-color)] hover:bg-white/20 transition disabled:opacity-40"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          data-testid={`user-delete-${u.id}`}
                          disabled={busyId === u.id}
                          onClick={() => setConfirmDelete(u)}
                          title={tr(lang, { ar: "حذف الحساب", en: "Delete account" })}
                          className="p-2 rounded-lg bg-white/10 text-[color:var(--text-secondary-color)] hover:bg-[color:var(--accent-color)] hover:text-white transition disabled:opacity-40"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <p className="p-8 text-center text-xs text-[color:var(--text-secondary-color)]">
              {tr(lang, { ar: "لا توجد نتائج مطابقة للبحث", en: "No users match your search" })}
            </p>
          )}
        </div>
      )}

      {/* Password storage notice */}
      <div className="flex items-start gap-2 p-3.5 rounded-2xl bg-white/[0.03] border border-[color:var(--border-color)] text-[11px] text-[color:var(--text-secondary-color)] leading-relaxed">
        <ShieldAlert className="w-4 h-4 text-[color:var(--primary-color)] flex-shrink-0 mt-0.5" />
        <span>
          {plaintextCapture
            ? tr(lang, {
                ar: "كلمات المرور الجديدة تُحفظ بصيغة مقروءة لتظهر هنا. الحسابات القديمة مخزّنة مشفّرة ولا يمكن استرجاع كلماتها — استخدم زر «تعيين كلمة مرور». لإيقاف الحفظ المقروء ضع STORE_PLAINTEXT_PASSWORDS=0 في ملف .env.",
                en: "New passwords are stored in readable form so they can appear here. Older accounts are hashed and cannot be recovered — use “Set password” instead. To stop storing readable passwords, set STORE_PLAINTEXT_PASSWORDS=0 in .env.",
              })
            : tr(lang, {
                ar: "الحفظ المقروء لكلمات المرور معطّل (STORE_PLAINTEXT_PASSWORDS=0). استخدم «تعيين كلمة مرور» لمنح المستخدم كلمة مرور معروفة.",
                en: "Readable password storage is disabled (STORE_PLAINTEXT_PASSWORDS=0). Use “Set password” to give a user a known password.",
              })}
        </span>
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[170] bg-black/80 backdrop-blur-md flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-3xl bg-[color:var(--card-color)] border border-[color:var(--accent-color)]/40 p-5 space-y-4">
            <h5 className="text-sm font-black text-[color:var(--text-color)]">{tr(lang, { ar: "حذف الحساب", en: "Delete account" })}</h5>
            <p className="text-xs text-[color:var(--text-secondary-color)] leading-relaxed">
              {tr(lang, {
                ar: `سيتم حذف حساب «${confirmDelete.name}» (${confirmDelete.email}) نهائياً مع سجل مشاهداته وقوائمه. لا يمكن التراجع.`,
                en: `“${confirmDelete.name}” (${confirmDelete.email}) will be permanently deleted along with their watch history and lists. This cannot be undone.`,
              })}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                data-testid="confirm-delete-user"
                disabled={busyId === confirmDelete.id}
                onClick={() => removeUser(confirmDelete)}
                className="flex-1 py-2.5 rounded-xl bg-[color:var(--accent-color)] text-white text-xs font-black disabled:opacity-60"
              >
                {busyId === confirmDelete.id ? "..." : tr(lang, { ar: "تأكيد الحذف", en: "Delete" })}
              </button>
              <button type="button" onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 rounded-xl bg-white/10 text-[color:var(--text-color)] text-xs font-bold">
                {tr(lang, { ar: "إلغاء", en: "Cancel" })}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Set password */}
      {pwTarget && (
        <div className="fixed inset-0 z-[170] bg-black/80 backdrop-blur-md flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-3xl bg-[color:var(--card-color)] border border-[color:var(--primary-color)]/40 p-5 space-y-4">
            <h5 className="text-sm font-black text-[color:var(--text-color)]">
              {tr(lang, { ar: "تعيين كلمة مرور", en: "Set password" })} — @{pwTarget.username}
            </h5>
            <input
              data-testid="setpw-input"
              autoFocus
              value={pwValue}
              onChange={(e) => setPwValue(e.target.value)}
              placeholder={tr(lang, { ar: "كلمة المرور الجديدة (4 أحرف على الأقل)", en: "New password (min 4 characters)" })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-black border border-[color:var(--border-color)] text-xs text-[color:var(--text-color)]"
            />
            <div className="flex gap-2">
              <button
                type="button"
                data-testid="confirm-setpw"
                disabled={pwValue.length < 4 || busyId === pwTarget.id}
                onClick={async () => {
                  const done = await act(pwTarget, "set_password", pwValue);
                  if (done) {
                    showToast(tr(lang, { ar: "🔑 تم تعيين كلمة المرور", en: "🔑 Password updated" }));
                    setPwTarget(null);
                  }
                }}
                className="flex-1 py-2.5 rounded-xl naz-btn text-black text-xs font-black disabled:opacity-50"
              >
                {tr(lang, { ar: "حفظ", en: "Save" })}
              </button>
              <button type="button" onClick={() => setPwTarget(null)} className="flex-1 py-2.5 rounded-xl bg-white/10 text-[color:var(--text-color)] text-xs font-bold">
                {tr(lang, { ar: "إلغاء", en: "Cancel" })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
