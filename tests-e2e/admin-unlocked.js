// Verifies the admin panel is permanently unlocked and fully functional.
const p = require("/tmp/pt/node_modules/puppeteer");
const { Client } = require("/app/node_modules/pg");
const W = (ms) => new Promise((r) => setTimeout(r, ms));
const URL = process.env.URL || "http://127.0.0.1:3000";
let pass = 0, fail = 0;
const ok = (n, c, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${n} ${x}`); };

(async () => {
  const db = new Client({ connectionString: "postgresql://postgres:postgres@127.0.0.1:5432/app_db" }); await db.connect();
  const row = async () => (await db.query("select data from site_settings where key='main'")).rows[0].data;

  const b = await p.launch({ args: ["--no-sandbox"] });
  const pg = await b.newPage();
  await pg.setViewport({ width: 1400, height: 950 });
  const errs = []; pg.on("pageerror", (e) => errs.push(e.message));
  const saves = [];
  pg.on("response", (r) => { if (r.url().includes("/api/settings") && r.request().method() === "PUT") saves.push(r.status()); });

  const anyPrompt = async () =>
    Boolean(await pg.$("[data-testid=admin-login-submit]")) ||
    Boolean(await pg.$("[data-testid=admin-reauth-note]")) ||
    (await pg.content()).includes("انتهت");
  const save = async () => { saves.length = 0; await pg.click("[data-testid=customization-save]"); for (let i = 0; i < 50 && !saves.length; i++) await W(150); await W(400); return saves[0]; };

  /* --- 2. dashboard reachable with no password at all --- */
  await pg.goto(URL, { waitUntil: "networkidle0" });
  ok("admin button visible by default on a fresh browser", !!(await pg.$("[data-testid=admin-open-btn]")));
  await pg.click("[data-testid=admin-open-btn]"); await W(1200);
  ok("2. dashboard opens with NO password prompt", !!(await pg.$("[data-testid=admin-tab-customization]")) && !(await anyPrompt()));

  /* --- 1. the session-expired message does not exist --- */
  ok("1. no 'انتهت جلسة المدير' text anywhere in the rendered app", !(await pg.content()).includes("انتهت"));

  /* --- 4. no action can revoke access: heavy navigation + state churn --- */
  const tabs = ["analytics", "viewing", "content", "view_stats", "search_stats", "movie_requests", "premium_requests", "settings", "legal_pages", "customization"];
  let prompts = 0;
  for (let round = 0; round < 3; round++) {
    for (const t of tabs) {
      await pg.click(`[data-testid=admin-tab-${t}]`); await W(200);
      if (await anyPrompt()) prompts++;
    }
  }
  ok("4. 30 tab switches never revoke access or show a prompt", prompts === 0 && !!(await pg.$("[data-testid=admin-tab-customization]")));

  /* --- 3. no background session checks --- */
  const authCalls = [];
  pg.on("response", (r) => { if (r.url().includes("/api/admin/auth")) authCalls.push(r.request().method()); });
  await pg.evaluate(() => { document.dispatchEvent(new Event("visibilitychange")); window.dispatchEvent(new Event("focus")); });
  await W(4000);
  ok("3. no session-validation requests fire on focus/visibility/idle", authCalls.length === 0, `(${authCalls.length} calls)`);

  /* --- 5. full dashboard functionality --- */
  await pg.click("[data-testid=admin-tab-customization]"); await W(600);
  await pg.click("[data-testid=preset-purple]"); await W(250);
  let st = await save();
  ok("5. theme save works (HTTP 200, persisted)", st === 200 && (await row()).themePreset === "purple", `(HTTP ${st})`);

  // Add a movie with video servers through the dashboard form
  await pg.click("[data-testid=admin-tab-content]"); await W(700);
  const setI = async (sel, text) => {
    await pg.evaluate((sel, text) => {
      const el = document.querySelector(sel);
      const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement : window.HTMLInputElement;
      Object.getOwnPropertyDescriptor(proto.prototype, "value").set.call(el, text);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, sel, text);
  };
  const titleAr = `فيلم اختبار ${Date.now().toString().slice(-5)}`;
  const inputs = await pg.$$("form input[type=text]");
  await setI("form input[type=text]", titleAr);
  await pg.evaluate((t) => {
    const all = [...document.querySelectorAll("form input[type=text]")];
    const el = all[1];
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(el, t);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, `Unlocked Test Movie ${Date.now().toString().slice(-5)}`);
  await W(200);
  const moviesBefore = (await db.query("select count(*)::int n from movies")).rows[0].n;
  await pg.evaluate(() => [...document.querySelectorAll("form button[type=submit]")][0]?.click());
  await W(2000);
  const moviesAfter = (await db.query("select count(*)::int n from movies")).rows[0].n;
  ok("5. adding a movie through the dashboard works", moviesAfter === moviesBefore + 1, `(${moviesBefore} → ${moviesAfter})`);
  const newMovie = (await db.query("select servers, download_links from movies order by id desc limit 1")).rows[0];
  ok("5. new movie has its 6 video servers + download links", newMovie.servers.length === 6 && newMovie.download_links.length === 3);

  // Editing content + admin settings
  await pg.click("[data-testid=admin-tab-settings]"); await W(700);
  const before = await row();
  await pg.evaluate(() => { [...document.querySelectorAll("button")].filter((x) => ["ON", "OFF"].includes(x.textContent.trim()))[0]?.click(); });
  await W(1400);
  const afterToggle = await row();
  const changed = Object.keys(before).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(afterToggle[k]));
  ok("5. admin settings toggle works", changed.length === 1, JSON.stringify(changed));
  await pg.evaluate(() => { [...document.querySelectorAll("button")].filter((x) => ["ON", "OFF"].includes(x.textContent.trim()))[0]?.click(); }); await W(1200);

  // Analytics loads
  await pg.click("[data-testid=admin-tab-viewing]"); await W(1800);
  ok("5. analytics section loads", !(await pg.$("[data-testid=stats-error]")));

  /* --- persistence across reloads and a brand-new browser --- */
  for (let i = 0; i < 2; i++) { await pg.reload({ waitUntil: "networkidle0" }); await W(1200); }
  ok("access survives reloads with no prompt", !!(await pg.$("[data-testid=admin-tab-customization]")) && !(await anyPrompt()));

  const fresh = await b.createBrowserContext();
  const fp = await fresh.newPage();
  await fp.goto(URL, { waitUntil: "networkidle0" });
  await fp.click("[data-testid=admin-open-btn]"); await W(1500);
  ok("a brand-new browser (no cookies/storage) gets straight in", !!(await fp.$("[data-testid=admin-tab-customization]")));
  const apiOpen = await fp.evaluate(async () => {
    const r = await fetch("/api/settings", { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json", "x-naz-admin": "1" }, body: JSON.stringify({ themePreset: "blue" }) });
    return r.status;
  });
  ok("admin APIs accept writes with no credentials", apiOpen === 200, `(HTTP ${apiOpen})`);
  await fresh.close();

  /* --- "logout" only closes the panel, never blocks re-entry --- */
  await pg.click("[data-testid=admin-tab-customization]"); await W(400);
  await pg.click("[data-testid=admin-logout]"); await W(1200);
  ok("logout closes the panel", !(await pg.$("[data-testid=admin-tab-customization]")));
  await pg.click("[data-testid=admin-open-btn]"); await W(1200);
  ok("re-entry after logout is immediate, no password", !!(await pg.$("[data-testid=admin-tab-customization]")) && !(await anyPrompt()));

  // cleanup the movie created by this test
  await db.query("delete from movies where title_ar like 'فيلم اختبار%'");
  await db.query("update site_settings set data = data || '{\"themePreset\":\"default\"}'::jsonb where key='main'");

  ok("no page runtime errors", errs.length === 0, JSON.stringify(errs.slice(0, 3)));
  await b.close(); await db.end();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
