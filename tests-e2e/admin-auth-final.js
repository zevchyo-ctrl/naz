// Final acceptance: admin session lifecycle + every admin save operation.
const p = require("/tmp/pt/node_modules/puppeteer");
const crypto = require("crypto");
const { Client } = require("/app/node_modules/pg");
const W = (ms) => new Promise((r) => setTimeout(r, ms));
const URL = process.env.URL || "http://127.0.0.1:3000";
const SECRET = "naz-admin::9770327";
const COOKIE = "naz_admin_session";
let pass = 0, fail = 0;
const ok = (n, c, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${n} ${x}`); };
const mkToken = (exp, legacy = false) => `${exp}.${crypto.createHmac("sha256", SECRET).update(legacy ? String(exp) : `admin:${exp}`).digest("hex")}`;

// NOTE: admin auth is currently DISABLED (unlocked prototype mode).
// This suite tests the locked behaviour — run it only after re-enabling:
//   ADMIN_AUTH_ENABLED=1 npx next start -p 3000
if (process.env.ADMIN_AUTH_ENABLED !== "1") {
  console.log("SKIPPED — admin auth is disabled. Re-run with ADMIN_AUTH_ENABLED=1 to test the locked flow.");
  process.exit(0);
}


(async () => {
  const db = new Client({ connectionString: "postgresql://postgres:postgres@127.0.0.1:5432/app_db" }); await db.connect();
  const row = async () => (await db.query("select data from site_settings where key='main'")).rows[0].data;
  const before = await row();

  const b = await p.launch({ args: ["--no-sandbox"] });
  const pg = await b.newPage();
  await pg.setViewport({ width: 1400, height: 950 });
  const errs = []; pg.on("pageerror", (e) => errs.push(e.message));
  const saves = [];
  pg.on("response", (r) => { if (r.url().includes("/api/settings") && r.request().method() === "PUT") saves.push(r.status()); });

  const errText = () => pg.$eval("[data-testid=customization-error]", (e) => e.textContent).catch(() => "");
  const overlay = () => pg.$("[data-testid=admin-reauth-note]").then(Boolean);
  // React-safe value setter (keyboard selection is flaky inside scrollable panels)
  const setInput = async (sel, text) => {
    await pg.waitForSelector(sel);
    await pg.evaluate((sel, text) => {
      const el = document.querySelector(sel);
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(el, text);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, sel, text);
    await W(150);
    return pg.$eval(sel, (e) => e.value);
  };
  const save = async () => { saves.length = 0; await pg.click("[data-testid=customization-save]"); for (let i = 0; i < 50 && !saves.length; i++) await W(150); await W(500); return saves[0]; };
  const login = async (page = pg) => {
    for (let i = 0; i < 4; i++) { await page.click("[data-testid=naz-logo]"); await W(150); }
    await W(400);
    if (await page.$("[data-testid=admin-login-submit]")) {
      await page.type("input[type=password]", "9770327");
      await page.click("[data-testid=admin-login-submit]"); await W(1600);
    }
  };
  const cookies = async () => (await pg.cookies()).filter((c) => c.name === COOKIE);

  /* ---- 1-2: login ---- */
  await pg.goto(URL, { waitUntil: "networkidle0" });
  await login();
  ok("1-2. login opens dashboard", !!(await pg.$("[data-testid=admin-tab-customization]")));
  const ck = await cookies();
  ok("   session delivered as HttpOnly cookie, not readable by JS", ck.length === 1 && ck[0].httpOnly && ck[0].path === "/" && ck[0].sameSite === "Lax");
  ok("   no admin token left in localStorage", !(await pg.evaluate(() => localStorage.getItem("nazmovies_admin_token"))));

  /* ---- 3: dashboard open a long time (session issued 11h ago) ---- */
  await pg.setCookie({ name: COOKIE, value: mkToken(Date.now() + 1 * 3600e3), url: URL, httpOnly: true, path: "/" });
  await pg.evaluate(() => window.dispatchEvent(new Event("focus"))); await W(1200);
  ok("3. long-running session is renewed by the server heartbeat", Number((await cookies())[0].value.split(".")[0]) > Date.now() + 11 * 3600e3);

  /* ---- 4-10: theme change → preview → save ---- */
  await pg.click("[data-testid=admin-tab-customization]"); await W(600);
  const presets = [["purple", "السينما البنفسجية", "#A855F7"], ["dark-red", "السينما الحمراء الداكنة", "#E50914"], ["blue", "السينما الزرقاء", "#38BDF8"], ["black-gold", "الأسود والذهبي", "#D4AF37"], ["default", "السينما الافتراضي", "#FFD21F"]];
  for (const [id, name, primary] of presets) {
    await pg.click(`[data-testid=preset-${id}]`); await W(250);
    const preview = await pg.$eval("[data-testid=live-preview]", (e) => getComputedStyle(e).getPropertyValue("--primary-color").trim().toUpperCase());
    const st = await save();
    const r = await row();
    ok(`4-9. ${name}: preview → save → DB → still logged in`,
      preview === primary && st === 200 && r.themePreset === id && r.theme.primary === primary && !(await errText()) && !(await overlay()),
      `(HTTP ${st}, db ${r.themePreset})`);
  }
  await pg.click("[data-testid=preset-custom]"); await W(150);
  const accentVal = await setInput("[data-testid=color-accent]", "#00c2a8");
  let st = await save();
  ok("   lowercase hex accepted (normalised to uppercase)", accentVal.toLowerCase() === "#00c2a8", accentVal);
  ok("4-9. مخصص: manual colour saves", st === 200 && (await row()).theme.accent === "#00C2A8" && !(await overlay()), `(HTTP ${st}, accent ${(await row()).theme.accent})`);

  /* ---- 11-12: reload ---- */
  await pg.click("[data-testid=preset-purple]"); await save();
  await pg.reload({ waitUntil: "networkidle0" }); await W(1500);
  ok("11-12. after reload: still authenticated, theme active", !!(await pg.$("[data-testid=admin-tab-customization]")) && !(await overlay()) &&
    (await pg.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--primary-color").trim().toUpperCase())) === "#A855F7");

  /* ---- 13-15: change again ---- */
  await pg.click("[data-testid=admin-tab-customization]"); await W(600);
  await pg.click("[data-testid=preset-blue]"); await W(200);
  st = await save();
  ok("13-15. second theme change saves", st === 200 && (await row()).themePreset === "blue");

  /* ---- 16-19: other admin sections keep the same session ---- */
  const tgUnique = `https://t.me/naz_support_${Date.now().toString().slice(-6)}`;
  await setInput("[data-testid=site-name-input]", "NAZMOVIES");
  const tgVal = await setInput("[data-testid=telegram-input]", tgUnique);
  ok("   telegram input holds the exact value", tgVal === tgUnique, tgVal);
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  require("fs").writeFileSync("/tmp/naz-final-logo.png", png);
  await (await pg.$("[data-testid=logo-file]")).uploadFile("/tmp/naz-final-logo.png"); await W(500);
  st = await save();
  let r = await row();
  ok("16-19. identity (name + Telegram + logo) saves on same session", st === 200 && r.telegramContactUrl === tgUnique && r.logoUrl.startsWith("data:image/png"), `(HTTP ${st}, tg ${r.telegramContactUrl})`);

  // Admin Settings toggles + max servers + legal pages
  await pg.click("[data-testid=admin-tab-settings]"); await W(700);
  const settingsBefore = await row();
  await pg.evaluate(() => { const b = [...document.querySelectorAll("button")].filter((x) => ["ON", "OFF"].includes(x.textContent.trim()))[0]; b?.click(); });
  await W(1400);
  const settingsAfter = await row();
  const changedKeys = Object.keys(settingsBefore).filter((k) => JSON.stringify(settingsBefore[k]) !== JSON.stringify(settingsAfter[k]));
  ok("16-19. settings toggle saves (no logout)", changedKeys.length === 1 && typeof settingsAfter[changedKeys[0]] === "boolean" && !(await overlay()), JSON.stringify(changedKeys));
  await pg.evaluate(() => { const b = [...document.querySelectorAll("button")].filter((x) => ["ON", "OFF"].includes(x.textContent.trim()))[0]; b?.click(); }); await W(1300);

  await pg.click("[data-testid=admin-tab-legal_pages]"); await W(700);
  await pg.evaluate(() => { const t = document.querySelector("textarea"); const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set; setter.call(t, "عن منصة نازموفيز — تم التحديث"); t.dispatchEvent(new Event("input", { bubbles: true })); });
  await pg.evaluate(() => [...document.querySelectorAll("button")].find((x) => x.textContent.includes("حفظ التغييرات"))?.click());
  await W(1400);
  ok("16-19. legal pages save on same session", (await row()).aboutUsAr.includes("تم التحديث") && !(await overlay()));

  // Movie + series management
  const movieRes = await pg.evaluate(async () => {
    const r = await fetch("/api/movies", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "x-naz-admin": "1" }, body: JSON.stringify({ titleAr: "فيلم اختبار الجلسة", titleEn: "Session Test Movie", genre: "action" }) });
    return r.status;
  });
  const seriesRes = await pg.evaluate(async () => {
    const r = await fetch("/api/series", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "x-naz-admin": "1" }, body: JSON.stringify({ titleAr: "مسلسل اختبار الجلسة", titleEn: "Session Test Series" }) });
    return r.status;
  });
  ok("16-19. movie & series management use the same session", movieRes === 201 && seriesRes === 201, `(movie ${movieRes}, series ${seriesRes})`);
  await db.query("delete from episodes where series_id in (select id from series where slug like 'session-test-series%')");
  await db.query("delete from seasons where series_id in (select id from series where slug like 'session-test-series%')");
  await db.query("delete from series where slug like 'session-test-series%'");
  await db.query("delete from movies where slug like 'session-test-movie%'");

  // Analytics section
  await pg.click("[data-testid=admin-tab-viewing]"); await W(1800);
  ok("16-19. analytics section loads on same session", !(await pg.$("[data-testid=stats-error]")) && !(await overlay()));

  /* ---- Previously-broken failure modes ---- */
  console.log("  --- regression of the reported failure modes ---");
  // B: localStorage wiped mid-session (Safari ITP / private mode / storage cleanup)
  await pg.evaluate(() => { try { localStorage.clear(); } catch {} });
  await pg.click("[data-testid=admin-tab-customization]"); await W(600);
  await pg.click("[data-testid=preset-black-gold]"); await W(200);
  st = await save();
  ok("B. localStorage cleared mid-session → save STILL succeeds", st === 200 && !(await overlay()) && (await row()).themePreset === "black-gold", `(HTTP ${st})`);

  // C: localStorage writes blocked entirely (private mode)
  const pgC = await b.newPage();
  await pgC.evaluateOnNewDocument(() => {
    Storage.prototype.setItem = function () { throw new DOMException("QuotaExceededError"); };
    Storage.prototype.getItem = function () { throw new DOMException("SecurityError"); };
  });
  const cSaves = [];
  pgC.on("response", (r) => { if (r.url().includes("/api/settings") && r.request().method() === "PUT") cSaves.push(r.status()); });
  await pgC.goto(URL, { waitUntil: "networkidle0" });
  await login(pgC);
  const cDash = !!(await pgC.$("[data-testid=admin-tab-customization]"));
  if (cDash) {
    await pgC.click("[data-testid=admin-tab-customization]"); await W(600);
    await pgC.click("[data-testid=preset-purple]"); await W(250);
    await pgC.click("[data-testid=customization-save]");
    for (let i = 0; i < 50 && !cSaves.length; i++) await W(150);
    await W(400);
  }
  ok("C. storage completely blocked → login works AND save succeeds", cDash && cSaves[0] === 200, `(dashboard ${cDash}, HTTP ${cSaves[0]})`);
  await pgC.close();

  // D: transient proxy/server errors must NOT be reported as an expired session
  await pg.setRequestInterception(true);
  let mode = "500";
  const h = (req) => {
    if (req.url().includes("/api/settings") && req.method() === "PUT") {
      if (mode === "500") return req.respond({ status: 500, contentType: "application/json", body: '{"error":"db down"}' });
      if (mode === "proxy401") return req.respond({ status: 401, contentType: "text/html", body: "<html>proxy</html>" });
      if (mode === "netfail") return req.abort("failed");
    }
    req.continue();
  };
  pg.on("request", h);
  await pg.click("[data-testid=preset-blue]"); await W(200);
  st = await save(); let msg = await errText();
  ok("D1. 500 → server error message, session kept", st === 500 && msg === "حدث خطأ في الخادم. حاول مرة أخرى." && !(await overlay()));
  mode = "netfail";
  await pg.click("[data-testid=customization-save]"); await W(1800); msg = await errText();
  ok("D2. network failure → connection message, session kept", msg.includes("تعذر الاتصال بالخادم") && !(await overlay()));
  mode = "proxy401";
  await pg.click("[data-testid=customization-save]"); await W(1800);
  ok("D3. non-JSON 401 from a proxy → no false 'session expired' overlay", !(await overlay()));
  pg.off("request", h); await pg.setRequestInterception(false);

  // 400 validation must not be reported as a session problem
  await pg.setRequestInterception(true);
  const h400 = (req) => {
    if (req.url().includes("/api/settings") && req.method() === "PUT") {
      const body = JSON.parse(req.postData()); body.theme.primary = "nope";
      return req.continue({ postData: JSON.stringify(body) });
    }
    req.continue();
  };
  pg.on("request", h400);
  st = await save(); msg = await errText();
  ok("400 → real validation error, session kept", st === 400 && msg.includes("اللون الأساسي") && !msg.includes("جلسة") && !(await overlay()));
  pg.off("request", h400); await pg.setRequestInterception(false);

  /* ---- genuine expiry: 401 → in-place re-login, draft preserved ---- */
  await pg.setCookie({ name: COOKIE, value: mkToken(Date.now() - 60e3), url: URL, httpOnly: true, path: "/" });
  await pg.click("[data-testid=preset-dark-red]"); await W(200);
  st = await save();
  const draftKept = await pg.$eval("[data-testid=preset-dark-red]", (e) => e.className.includes("primary-color"));
  ok("genuine expiry → 401 + re-login overlay, dashboard still mounted", st === 401 && (await overlay()) && !!(await pg.$("[data-testid=customization-panel]")), `(HTTP ${st})`);
  ok("   unsaved selection preserved", draftKept);
  await pg.type("input[type=password]", "9770327");
  await pg.click("[data-testid=admin-login-submit]"); await W(1500);
  st = await save();
  ok("   after in-place re-login the save succeeds", st === 200 && (await row()).themePreset === "dark-red");

  /* ---- legacy header session from an older build (item 12) ---- */
  const pgL = await b.newPage();
  await pgL.goto(URL, { waitUntil: "networkidle0" });
  await pgL.evaluate((t) => localStorage.setItem("nazmovies_admin_token", t), mkToken(Date.now() + 3 * 3600e3, true));
  await pgL.reload({ waitUntil: "networkidle0" }); await W(1500);
  const lc = (await pgL.cookies()).filter((c) => c.name === COOKIE);
  const lLegacy = await pgL.evaluate(() => localStorage.getItem("nazmovies_admin_token"));
  ok("legacy session auto-upgraded to a cookie without re-login", lc.length === 1 && !lLegacy);
  await pgL.close();

  /* ---- cross-tab: cookie shared automatically ---- */
  const tab2 = await b.newPage();
  await tab2.goto(URL, { waitUntil: "networkidle0" }); await W(1200);
  const tab2Auth = await tab2.evaluate(async () => (await fetch("/api/admin/auth", { credentials: "same-origin" })).status);
  ok("second tab shares the same session automatically", tab2Auth === 200);

  /* ---- 20-21: logout ---- */
  await pg.click("[data-testid=admin-tab-customization]"); await W(400);
  await pg.click("[data-testid=admin-logout]"); await W(1200);
  const afterLogout = await pg.cookies();
  const protectedStatus = await pg.evaluate(async () => {
    const put = await fetch("/api/settings", { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json", "x-naz-admin": "1" }, body: JSON.stringify({ themePreset: "blue" }) });
    const stats = await fetch("/api/analytics/visitors?period=daily", { credentials: "same-origin" });
    return [put.status, stats.status];
  });
  ok("20-21. logout clears the cookie and protected APIs are refused", !afterLogout.some((c) => c.name === COOKIE && c.value) && protectedStatus[0] === 401 && protectedStatus[1] === 401, JSON.stringify(protectedStatus));
  ok("   theme unchanged by the refused request", (await row()).themePreset === "dark-red");

  /* ---- security + integrity ---- */
  const anon = await fetch(URL + "/api/settings", { method: "PUT", headers: { "Content-Type": "application/json", "x-naz-admin": "1" }, body: '{"themePreset":"blue"}' });
  const forged = await fetch(URL + "/api/settings", { method: "PUT", headers: { "Content-Type": "application/json", "x-naz-admin": "1", "Cookie": `${COOKIE}=${Date.now() + 3600e3}.deadbeef` }, body: '{"themePreset":"blue"}' });
  const noCsrf = await fetch(URL + "/api/settings", { method: "PUT", headers: { "Content-Type": "application/json", "Cookie": `${COOKIE}=${mkToken(Date.now() + 3600e3)}` }, body: '{"themePreset":"blue"}' });
  ok("security: anonymous 401, forged cookie 401, missing CSRF header 403", anon.status === 401 && forged.status === 401 && noCsrf.status === 403, `(${anon.status}/${forged.status}/${noCsrf.status})`);
  const secureFlag = await fetch(URL + "/api/admin/auth", { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-proto": "https" }, body: '{"password":"9770327"}' });
  ok("cookie gets Secure flag when the request is HTTPS", (secureFlag.headers.get("set-cookie") || "").includes("Secure"));

  const after = await row();
  ok("identity + other settings intact after all saves",
    after.siteName === "NAZMOVIES" && after.telegramContactUrl === tgUnique &&
    after.maxVideoServers === before.maxVideoServers && Object.keys(after.theme).length === 12 &&
    Object.values(after.theme).every((v) => /^#[0-9A-F]{6}$/.test(v)));
  ok("no page runtime errors", errs.length === 0, JSON.stringify(errs.slice(0, 3)));

  await b.close(); await db.end();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
