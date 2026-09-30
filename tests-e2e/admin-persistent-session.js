// Persistent admin session: no auto-logout, no session modal except on explicit rejection.
const p = require("/tmp/pt/node_modules/puppeteer");
const { Client } = require("/app/node_modules/pg");
const W = (ms) => new Promise((r) => setTimeout(r, ms));
const URL = process.env.URL || "http://127.0.0.1:3000";
const AUTH_KEY = "nazmovies_admin_session";
const COOKIE = "naz_admin_session";
let pass = 0, fail = 0;
const ok = (n, c, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${n} ${x}`); };

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

  const b = await p.launch({ args: ["--no-sandbox"] });
  const pg = await b.newPage();
  await pg.setViewport({ width: 1400, height: 950 });
  const errs = []; pg.on("pageerror", (e) => errs.push(e.message));
  const saves = [];
  pg.on("response", (r) => { if (r.url().includes("/api/settings") && r.request().method() === "PUT") saves.push(r.status()); });

  const modalShown = async () => Boolean(await pg.$("[data-testid=admin-login-submit]")) || Boolean(await pg.$("[data-testid=admin-reauth-note]"));
  const flag = () => pg.evaluate((k) => localStorage.getItem(k), AUTH_KEY);
  const save = async () => { saves.length = 0; await pg.click("[data-testid=customization-save]"); for (let i = 0; i < 50 && !saves.length; i++) await W(150); await W(400); return saves[0]; };

  /* --- login --- */
  await pg.goto(URL, { waitUntil: "networkidle0" });
  for (let i = 0; i < 4; i++) { await pg.click("[data-testid=naz-logo]"); await W(150); }
  await W(400);
  await pg.type("input[type=password]", "9770327");
  await pg.click("[data-testid=admin-login-submit]"); await W(1800);
  ok("login opens dashboard", !!(await pg.$("[data-testid=admin-tab-customization]")));
  ok("localStorage flag persisted (nazmovies_admin_session='true')", (await flag()) === "true");
  const ck = (await pg.cookies()).find((c) => c.name === COOKIE);
  ok("server session cookie is HttpOnly (password never in JS)", !!ck && ck.httpOnly);
  ok("session is long-lived, not a short timeout", !!ck && ck.expires * 1000 > Date.now() + 300 * 24 * 3600e3, ck ? `(expires in ~${Math.round((ck.expires * 1000 - Date.now()) / 86400000)}d)` : "");
  const pageSrc = await pg.content();
  ok("admin password is NOT present in the page/JS", !pageSrc.includes("9770327"));

  /* --- 1. tab navigation must never trigger the modal --- */
  const tabs = ["analytics", "viewing", "content", "view_stats", "search_stats", "movie_requests", "premium_requests", "settings", "legal_pages", "customization"];
  let modalDuringNav = false;
  for (let round = 0; round < 2; round++) {
    for (const t of tabs) {
      await pg.click(`[data-testid=admin-tab-${t}]`); await W(450);
      if (await modalShown()) { modalDuringNav = true; console.log("   modal appeared on tab:", t); }
    }
  }
  ok("1. switching every tab twice never shows the login modal", !modalDuringNav);
  ok("   still authenticated after navigation", (await flag()) === "true" && !!(await pg.$("[data-testid=admin-tab-customization]")));

  /* --- 2. repeated state updates + saves --- */
  await pg.click("[data-testid=admin-tab-customization]"); await W(500);
  let modalDuringSaves = false;
  for (const id of ["purple", "dark-red", "blue", "black-gold", "default"]) {
    await pg.click(`[data-testid=preset-${id}]`); await W(250);
    const st = await save();
    if (await modalShown()) modalDuringSaves = true;
    if (st !== 200) { ok(`save ${id} returned 200`, false, `(HTTP ${st})`); }
  }
  ok("2. five consecutive theme saves succeed with no modal", !modalDuringSaves && (await row()).themePreset === "default");

  /* --- other settings sections --- */
  await pg.click("[data-testid=admin-tab-settings]"); await W(700);
  const before = await row();
  await pg.evaluate(() => { const b = [...document.querySelectorAll("button")].filter((x) => ["ON", "OFF"].includes(x.textContent.trim()))[0]; b?.click(); });
  await W(1400);
  const afterToggle = await row();
  const changed = Object.keys(before).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(afterToggle[k]));
  ok("admin settings toggle saves, no modal", changed.length === 1 && !(await modalShown()), JSON.stringify(changed));
  await pg.evaluate(() => { const b = [...document.querySelectorAll("button")].filter((x) => ["ON", "OFF"].includes(x.textContent.trim()))[0]; b?.click(); }); await W(1200);

  /* --- 3. reloads keep the session --- */
  for (let i = 0; i < 3; i++) { await pg.reload({ waitUntil: "networkidle0" }); await W(1200); }
  ok("3. session survives repeated reloads, dashboard reopens", (await flag()) === "true" && !!(await pg.$("[data-testid=admin-tab-customization]")) && !(await modalShown()));

  /* --- 4. idle: no background check can log the admin out --- */
  const timersBefore = await pg.evaluate(() => {
    let n = 0; const real = window.setInterval;
    window.setInterval = function (...a) { n++; return real.apply(this, a); };
    return n;
  });
  await pg.click("[data-testid=admin-tab-viewing]"); await W(1000);
  await pg.evaluate(() => { document.dispatchEvent(new Event("visibilitychange")); window.dispatchEvent(new Event("focus")); });
  await W(2500);
  ok("4. focus/visibility events do not trigger any auth check or modal", !(await modalShown()) && (await flag()) === "true", `(timers ${timersBefore})`);

  /* --- 5. transient server/network failures must not log out --- */
  await pg.click("[data-testid=admin-tab-customization]"); await W(600);
  await pg.setRequestInterception(true);
  let mode = "500";
  const h = (req) => {
    if (req.url().includes("/api/settings") && req.method() === "PUT") {
      if (mode === "500") return req.respond({ status: 500, contentType: "application/json", body: '{"error":"boom"}' });
      if (mode === "netfail") return req.abort("failed");
      if (mode === "proxy401") return req.respond({ status: 401, contentType: "text/html", body: "<html>proxy</html>" });
    }
    if (req.url().includes("/api/admin/auth") && req.method() === "GET") {
      return req.respond({ status: 401, contentType: "text/html", body: "<html>proxy</html>" });
    }
    req.continue();
  };
  pg.on("request", h);
  await pg.click("[data-testid=preset-blue]"); await W(200);
  await save();
  ok("5a. HTTP 500 → no logout, no modal", !(await modalShown()) && (await flag()) === "true");
  mode = "netfail";
  await pg.click("[data-testid=customization-save]"); await W(1800);
  ok("5b. network failure → no logout, no modal", !(await modalShown()) && (await flag()) === "true");
  mode = "proxy401";
  await pg.click("[data-testid=customization-save]"); await W(1800);
  ok("5c. non-JSON 401 from a proxy → no logout, no modal", !(await modalShown()) && (await flag()) === "true");
  pg.off("request", h); await pg.setRequestInterception(false);
  await pg.click("[data-testid=preset-purple]"); await W(200);
  ok("5d. saving works again right after the failures", (await save()) === 200 && (await row()).themePreset === "purple");

  /* --- 6. genuine rejection (cookie deleted server-side) → prompt in place, draft kept --- */
  await pg.deleteCookie({ name: COOKIE, url: URL });
  await pg.click("[data-testid=preset-black-gold]"); await W(250);
  const st401 = await save();
  const draftKept = await pg.$eval("[data-testid=preset-black-gold]", (e) => e.className.includes("primary-color"));
  ok("6. only a real server rejection prompts for the password", st401 === 401 && (await modalShown()) && !!(await pg.$("[data-testid=customization-panel]")), `(HTTP ${st401})`);
  ok("   unsaved work preserved behind the prompt", draftKept);
  await pg.type("input[type=password]", "9770327");
  await pg.click("[data-testid=admin-login-submit]"); await W(1600);
  ok("   after entering the password the save works", (await save()) === 200 && (await row()).themePreset === "black-gold");

  /* --- 7. explicit logout is the only way out --- */
  await pg.click("[data-testid=admin-logout]"); await W(1500);
  ok("7. logout clears the localStorage flag", !(await flag()));
  ok("7. logout clears the session cookie", !(await pg.cookies()).some((c) => c.name === COOKIE && c.value));
  ok("7. dashboard closed, public site shown", !(await pg.$("[data-testid=admin-tab-customization]")));
  const denied = await pg.evaluate(async () => {
    const r = await fetch("/api/settings", { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json", "x-naz-admin": "1" }, body: JSON.stringify({ themePreset: "blue" }) });
    return r.status;
  });
  ok("7. protected API refuses after logout (401)", denied === 401);
  ok("   database unchanged by the refused write", (await row()).themePreset === "black-gold");

  /* --- 8. a spoofed localStorage flag cannot grant data access --- */
  await pg.evaluate((k) => localStorage.setItem(k, "true"), AUTH_KEY);
  await pg.reload({ waitUntil: "networkidle0" }); await W(1500);
  const spoof = await pg.evaluate(async () => {
    const put = await fetch("/api/settings", { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json", "x-naz-admin": "1" }, body: JSON.stringify({ siteName: "HACKED" }) });
    const stats = await fetch("/api/analytics/visitors?period=daily", { credentials: "same-origin" });
    return [put.status, stats.status];
  });
  ok("8. forged localStorage flag cannot read or write admin data", spoof[0] === 401 && spoof[1] === 401, JSON.stringify(spoof));
  ok("   site name not changed by the forged attempt", (await row()).siteName === "NAZMOVIES");
  await pg.evaluate((k) => localStorage.removeItem(k), AUTH_KEY);

  ok("no page runtime errors", errs.length === 0, JSON.stringify(errs.slice(0, 3)));
  await b.close(); await db.end();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
