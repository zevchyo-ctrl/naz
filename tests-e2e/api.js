// API-level verification: per-account history isolation, token forgery, admin-only settings.
const B = "http://127.0.0.1:3000";
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { cond ? pass++ : fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${name} ${extra}`); };
const j = async (path, opts = {}) => {
  const r = await fetch(B + path, { ...opts, headers: { "Content-Type": "application/json", ...(opts.headers || {}) } });
  let body = {}; try { body = await r.json(); } catch {}
  return { status: r.status, body };
};
const bearer = (t) => ({ Authorization: `Bearer ${t}` });

(async () => {
  const stamp = Date.now();
  const regA = await j("/api/auth", { method: "POST", body: JSON.stringify({ action: "register", email: `a${stamp}@naz.com`, password: "passA1", name: "Account A" }) });
  const regB = await j("/api/auth", { method: "POST", body: JSON.stringify({ action: "register", email: `b${stamp}@naz.com`, password: "passB1", name: "Account B" }) });
  ok("register A/B returns tokens (no verification)", regA.status === 201 && regB.status === 201 && regA.body.token && regB.body.token);
  const TA = regA.body.token, TB = regB.body.token, idA = regA.body.user.id;

  const movies = (await j("/api/movies")).body.movies;
  const seriesData = (await j("/api/series")).body;
  const m = movies[0];
  const s = seriesData.series[0];
  const eps = seriesData.episodes.filter((e) => e.seriesId === s.id).sort((a, b) => a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber);

  // Movie progress for A: 17:35 of 120 min
  const save = await j("/api/history", { method: "POST", headers: bearer(TA), body: JSON.stringify({ mediaType: "movie", contentId: m.id, currentTime: 1055, duration: 7200, userId: 999999 }) });
  ok("A saves movie progress", save.status === 200 && save.body.progress.userId === idA, `(stored user ${save.body.progress?.userId}, body userId ignored)`);

  // Episode progress: ep1 completed, ep2 45%, ep3 untouched
  await j("/api/history", { method: "POST", headers: bearer(TA), body: JSON.stringify({ mediaType: "series", contentId: s.id, episodeId: eps[0].id, currentTime: 2700, duration: 2800 }) });
  await j("/api/history", { method: "POST", headers: bearer(TA), body: JSON.stringify({ mediaType: "series", contentId: s.id, episodeId: eps[1].id, currentTime: 1260, duration: 2800 }) });
  const histA = (await j("/api/history", { headers: bearer(TA) })).body.items;
  const e1 = histA.find((h) => h.episodeId === eps[0].id), e2 = histA.find((h) => h.episodeId === eps[1].id);
  ok("episode 1 auto-marked completed (>=95%)", e1?.completed === true);
  ok("episode 2 keeps its own position (45%)", e2 && !e2.completed && Math.round((e2.currentTime / e2.duration) * 100) === 45);
  ok("history returns movie with 17:35", histA.some((h) => h.mediaType === "movie" && h.currentTime === 1055));

  // Episode belonging to another series is rejected
  const other = seriesData.episodes.find((e) => e.seriesId !== s.id);
  const bad = await j("/api/history", { method: "POST", headers: bearer(TA), body: JSON.stringify({ mediaType: "series", contentId: s.id, episodeId: other.id, currentTime: 10, duration: 100 }) });
  ok("episode/series mismatch rejected", bad.status === 404);

  // Isolation
  const histB = (await j("/api/history", { headers: bearer(TB) })).body.items;
  ok("B cannot see A's history", Array.isArray(histB) && histB.length === 0);
  const rowA = histA[0];
  const delB = await j(`/api/history?id=${rowA.id}`, { method: "DELETE", headers: bearer(TB) });
  ok("B deleting A's row by id affects nothing", delB.body.deleted === 0);
  ok("A's history intact after B's attempt", (await j("/api/history", { headers: bearer(TA) })).body.items.length === histA.length);

  // Token forgery / missing token
  const [, exp, sig] = TB.split(".");
  const forged = `${idA}.${exp}.${sig}`;
  ok("forged token (swapped user id) rejected", (await j("/api/history", { headers: bearer(forged) })).status === 401);
  ok("no token → 401", (await j("/api/history")).status === 401);
  ok("old ?id= profile lookup no longer leaks data", !(await j(`/api/auth?id=${idA}`)).body.user);
  ok("user-list endpoint still gated (not used by the panel; exposes emails)", (await j("/api/auth?list=1", { headers: bearer(TA) })).status === 403);

  // Login again as A (new device) → same progress
  const loginA = await j("/api/auth", { method: "POST", body: JSON.stringify({ action: "login", email: `a${stamp}@naz.com`, password: "passA1" }) });
  const histA2 = (await j("/api/history", { headers: bearer(loginA.body.token) })).body.items;
  ok("A logs in again (new session) and progress persists", histA2.some((h) => h.currentTime === 1055));

  // Admin-only enforcement
  ok("settings PUT without auth → 200 (auth disabled)", (await j("/api/settings", { method: "PUT", headers: { "x-naz-admin": "1" }, body: JSON.stringify({ themePreset: "default" }) })).status === 200);
  ok("settings PUT with user token → 200 (auth disabled)", (await j("/api/settings", { method: "PUT", headers: { ...bearer(TA), "x-naz-admin": "1" }, body: JSON.stringify({ themePreset: "default" }) })).status === 200);
  ok("settings PUT with forged admin cookie → 200 (auth disabled)", (await j("/api/settings", { method: "PUT", headers: { "x-naz-admin": "1", Cookie: "naz_admin_session=9999999999999.abc" }, body: JSON.stringify({ themePreset: "default" }) })).status === 200);
  ok("analytics GET without admin → 200 (auth disabled)", (await j("/api/analytics")).status === 200);
  ok("requests GET without admin → 200 (auth disabled)", (await j("/api/requests")).status === 200);
  const openCreate = await j("/api/movies", { method: "POST", headers: { "x-naz-admin": "1" }, body: JSON.stringify({ titleAr: "api-open-check", titleEn: "api-open-check" }) });
  ok("movie create without admin → allowed (auth disabled)", openCreate.status === 201);
  ok("movie delete without admin → allowed (auth disabled)", (await j(`/api/movies/${openCreate.body.movie.id}`, { method: "DELETE", headers: { "x-naz-admin": "1" } })).status === 200);

  const loginRes = await fetch(B + "/api/admin/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: "9770327" }) });
  const adminCookie = (loginRes.headers.get("set-cookie") || "").split(";")[0];
  const AH = { Cookie: adminCookie, "x-naz-admin": "1" };
  ok("admin login issues a session cookie", adminCookie.startsWith("naz_admin_session="));
  ok("invalid telegram URL rejected", (await j("/api/settings", { method: "PUT", headers: AH, body: JSON.stringify({ telegramContactUrl: "javascript:alert(1)" }) })).status === 400);
  ok("CSS-injection colour rejected", (await j("/api/settings", { method: "PUT", headers: AH, body: JSON.stringify({ theme: { primary: "red;}body{display:none" } }) })).status === 400);
  const evilSvg = "data:image/svg+xml;base64," + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>').toString("base64");
  ok("SVG with script handler rejected", (await j("/api/settings", { method: "PUT", headers: AH, body: JSON.stringify({ logoUrl: evilSvg }) })).status === 400);
  const vs = await j("/api/analytics", { headers: AH });
  ok("admin viewing statistics available", vs.status === 200 && vs.body.viewing && Array.isArray(vs.body.viewing.mostWatchedEpisodes) && vs.body.viewing.activeViewers >= 1);
  ok("viewing stats expose no emails", !JSON.stringify(vs.body.viewing).includes("@"));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
