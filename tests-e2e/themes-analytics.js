// E2E: colour-template saving (A–I, W) + real visitor analytics (J–V)
const p = require("/tmp/pt/node_modules/puppeteer");
const { Client } = require("/app/node_modules/pg");
const W = (ms) => new Promise((r) => setTimeout(r, ms));
const URL = process.env.URL || "http://127.0.0.1:3000";
const DB = "postgresql://postgres:postgres@127.0.0.1:5432/app_db";
let pass = 0, fail = 0;
const ok = (n, c, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${n} ${x}`); };
const clickText = (pg, sel, txt) => pg.evaluate((sel, txt) => {
  const el = [...document.querySelectorAll(sel)].find((b) => b.textContent.trim().includes(txt));
  if (el) el.click(); return !!el;
}, sel, txt);

async function adminLogin(pg) {
  // Admin auth is disabled: the dashboard opens directly, no password.
  await pg.click("[data-testid=admin-open-btn]"); await W(1500);
}

(async () => {
  const db = new Client({ connectionString: DB }); await db.connect();
  const b = await p.launch({ args: ["--no-sandbox"] });
  const errs = [];

  /* ======================= COLOUR TEMPLATES ======================= */
  const pg = await b.newPage();
  await pg.setViewport({ width: 1366, height: 900 });
  // admin browser stays headless-UA, so admin testing itself is not counted as a visitor
  pg.on("pageerror", (e) => errs.push(e.message));
  const puts = [];
  pg.on("response", async (r) => {
    if (r.url().endsWith("/api/settings") && r.request().method() === "PUT") {
      puts.push({ status: r.status(), body: JSON.parse(r.request().postData() || "{}") });
    }
  });
  await pg.goto(URL, { waitUntil: "networkidle0" });
  await adminLogin(pg);

  // Identity setup: name + Telegram + an Illustrator-style SVG logo (contains `content=` / `contentScriptType=`)
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" contentScriptType="text/ecmascript" viewBox="0 0 10 10"><metadata content="x"/><rect width="10" height="10" fill="#FFD21F"/></svg>';
  const svgUrl = "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
  const idRes = await pg.evaluate(async (logo) => {
    const r = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json", "x-naz-admin": "1" }, body: JSON.stringify({ siteName: "NAZMOVIES", telegramContactUrl: "https://t.me/naz_identity_test", logoUrl: logo }) });
    return r.status;
  }, svgUrl);
  ok("identity + legit SVG logo (with content= attrs) accepted", idRes === 200, `(HTTP ${idRes})`);
  await pg.reload({ waitUntil: "networkidle0" }); await W(1000);
  if (!(await pg.$("[data-testid=customization-panel]"))) {
    if (!(await pg.$("[data-testid=admin-tab-customization]"))) await adminLogin(pg);
  }
  await pg.click("[data-testid=admin-tab-customization]"); await W(500);

  const presets = [
    ["default", "السينما الافتراضي", "#FFD21F"],
    ["dark-red", "السينما الحمراء الداكنة", "#E50914"],
    ["blue", "السينما الزرقاء", "#38BDF8"],
    ["black-gold", "الأسود والذهبي", "#D4AF37"],
    ["purple", "السينما البنفسجية", "#A855F7"],
  ];
  // H: switch repeatedly, save every time (order includes switching back and forth)
  for (const [id, name, primary] of [...presets.slice(1), presets[0], presets[2], presets[4]]) {
    puts.length = 0;
    await pg.click(`[data-testid=preset-${id}]`); await W(250);
    const disabled = await pg.$eval("[data-testid=customization-save]", (e) => e.disabled);
    if (!disabled) { await pg.click("[data-testid=customization-save]"); await W(1300); }
    const err = await pg.$eval("[data-testid=customization-error]", (e) => e.textContent).catch(() => "");
    const row = (await db.query("select data->>'themePreset' p, data->'theme'->>'primary' c, jsonb_object_keys(data->'theme') k from site_settings")).rows;
    const put = puts[0];
    ok(`${name}: save succeeds & persisted`, !err && (disabled || put?.status === 200) && row[0].p === id && row[0].c === primary,
      `(HTTP ${put?.status ?? "no-change"}, db preset=${row[0].p} primary=${row[0].c}${err ? " err=" + err : ""})`);
    if (put) ok(`   ${name}: full theme sent (${Object.keys(put.body.theme || {}).length} keys), logo NOT resent`, Object.keys(put.body.theme || {}).length === 12 && Object.keys(put.body.sections || {}).length === 13 && !("logoUrl" in put.body));
  }

  // F: custom manual colours (lowercase hex accepted)
  puts.length = 0;
  await pg.click("[data-testid=preset-custom]"); await W(200);
  // React-safe value setter (keyboard select-all is flaky inside scrollable panels)
  const setInput = async (sel, text) => {
    await pg.waitForSelector(sel);
    await pg.evaluate((sel, text) => {
      const el = document.querySelector(sel);
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(el, text);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, sel, text);
    await W(150);
  };
  await setInput("[data-testid=color-primary]", "#ff00aa");
  await setInput("[data-testid=section-hero]", "#112233");
  await pg.click("[data-testid=customization-save]"); await W(1300);
  const cust = (await db.query("select data->>'themePreset' p, data->'theme'->>'primary' c, data->'sections'->>'hero' h from site_settings")).rows[0];
  ok("مخصص: manual colours (lowercase) save", puts[0]?.status === 200 && cust.p === "custom" && cust.c === "#FF00AA" && cust.h === "#112233", JSON.stringify(cust));

  // Backend accepts lowercase hex directly too
  const lower = await pg.evaluate(async () => (await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json", "x-naz-admin": "1" }, body: JSON.stringify({ themePreset: "custom", theme: { secondary: "#ffb800", text: "#fff" } }) })).json());
  ok("backend: lowercase & 3-digit hex normalised", lower.settings?.theme.secondary === "#FFB800" && lower.settings?.theme.text === "#FFFFFF");
  const bad = await pg.evaluate(async () => { const r = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json", "x-naz-admin": "1" }, body: JSON.stringify({ theme: { primary: "red" } }) }); return { s: r.status, j: await r.json() }; });
  ok("validation still active: invalid colour → 400 with field name", bad.s === 400 && bad.j.fields?.[0]?.startsWith("theme.primary"), JSON.stringify(bad.j));

  // Admin auth is disabled: deleting the session cookie must NOT block saving.
  await pg.deleteCookie({ name: "naz_admin_session", url: URL });
  await pg.click("[data-testid=preset-blue]"); await W(200);
  await pg.click("[data-testid=customization-save]"); await W(1300);
  const noSessErr = await pg.$eval("[data-testid=customization-error]", (e) => e.textContent).catch(() => "");
  ok("no session cookie still saves fine (auth disabled)", !noSessErr && (await db.query("select data->>'themePreset' p from site_settings")).rows[0].p === "blue", `"${noSessErr}"`);

  // G + W: reload keeps selection + identity unchanged (I)
  // The previous step deleted the session cookie on purpose; clear the persistent flag too
  // so adminLogin() performs a real re-login (password prompt) instead of restoring the UI.
  await pg.reload({ waitUntil: "networkidle0" }); await W(800);
  await adminLogin(pg);
  await pg.click("[data-testid=admin-tab-customization]"); await W(500);
  await pg.click("[data-testid=preset-purple]"); await W(200);
  await pg.click("[data-testid=customization-save]"); await W(1300);
  await pg.evaluate(() => localStorage.setItem("nazmovies_admin_open", "1"));
  await pg.reload({ waitUntil: "networkidle0" }); await W(1200);
  await pg.click("[data-testid=admin-tab-customization]"); await W(500);
  const activePreset = await pg.$eval("[data-testid=preset-purple]", (e) => e.className.includes("primary-color"));
  const rootPrimary = await pg.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--primary-color").trim().toUpperCase());
  ok("after reload: purple template still selected & applied", activePreset && rootPrimary === "#A855F7", rootPrimary);
  const idn = (await db.query("select data->>'siteName' n, data->>'telegramContactUrl' t, data->>'logoUrl' l from site_settings")).rows[0];
  ok("identity preserved (name, Telegram, logo)", idn.n === "NAZMOVIES" && idn.t === "https://t.me/naz_identity_test" && idn.l === svgUrl);

  /* ======================= ANALYTICS ======================= */
  await db.query("DELETE FROM visitor_analytics");
  const visitors = [
    { ip: "212.26.18.41", cc: "SA" }, { ip: "212.26.18.41", cc: "SA" }, { ip: "212.26.18.41", cc: "SA" },
    { ip: "94.200.200.200", cc: "AE" }, { ip: "94.200.200.200", cc: "AE" },
    { ip: "41.32.0.1", cc: "EG" },
  ];
  const ctx = [];
  for (const v of visitors) {
    const c = await b.createBrowserContext(); // fresh anonymous visitor (new storage)
    const vp = await c.newPage();
    await vp.setViewport({ width: 1280, height: 850 });
    vp.on("pageerror", (e) => errs.push(e.message));
    // Real-browser UA (the server intentionally ignores "HeadlessChrome" as a bot)
    await vp.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36");
    await vp.setExtraHTTPHeaders({ "x-forwarded-for": v.ip });
    await vp.goto(URL, { waitUntil: "networkidle0" }); await W(400);
    ctx.push({ c, vp });
  }
  const main = ctx[0].vp; // J: anonymous visitor does the full journey
  // K: several pages
  await clickText(main, "header nav button", "الأفلام"); await W(400);
  await clickText(main, "header nav button", "المسلسلات"); await W(400);
  await clickText(main, "header nav button", "التصنيفات"); await W(400);
  // duplicate navigation within window must not inflate
  await clickText(main, "header nav button", "الأفلام"); await W(400);
  await clickText(main, "header nav button", "الأفلام"); await W(400);
  await main.reload({ waitUntil: "networkidle0" }); await W(500); // same session → no 2nd site_visit
  // L: open a movie (details + play)
  await clickText(main, "header nav button", "الأفلام"); await W(400);
  await main.evaluate(() => document.querySelector("[data-testid=naz-logo]") && [...document.querySelectorAll("main h3")][0]?.closest("div.group")?.click());
  await W(600);
  await clickText(main, "button", "مشاهدة الآن"); await W(1200);
  await main.evaluate(() => [...document.querySelectorAll("button")].find((x) => x.title === "إغلاق المشغل")?.click()); await W(400);
  // M + N: open a series and an episode
  await main.evaluate(() => [...document.querySelectorAll("button")].find((x) => x.textContent.includes("العودة إلى التصفح"))?.click()); await W(300);
  await clickText(main, "header nav button", "المسلسلات"); await W(400);
  await main.evaluate(() => [...document.querySelectorAll("main h3")][0]?.closest("div.group")?.click()); await W(600);
  await main.evaluate(() => document.querySelector("[data-testid^=ep-status-], .group.cursor-pointer img") && [...document.querySelectorAll("div.group.cursor-pointer")].find((d) => d.querySelector("h4"))?.click());
  await W(1200);
  await main.evaluate(() => [...document.querySelectorAll("button")].find((x) => x.title === "إغلاق المشغل")?.click()); await W(300);
  // O: search
  await main.evaluate(() => [...document.querySelectorAll("header button")].find((x) => x.title === "بحث")?.click()); await W(300);
  await main.type("input[placeholder]", "رمال"); await W(1800);
  await W(1500);

  const ev = (await db.query("select event_type, count(*)::int n from visitor_analytics group by 1 order by 1")).rows;
  const evMap = Object.fromEntries(ev.map((r) => [r.event_type, r.n]));
  console.log("   recorded events:", JSON.stringify(evMap));
  ok("site_visit = one per anonymous session (reload not double-counted)", evMap.site_visit === visitors.length, `(${evMap.site_visit} for ${visitors.length} visitors)`);
  ok("page_view recorded, duplicates suppressed", evMap.page_view >= visitors.length + 4 && evMap.page_view < visitors.length + 12, `(${evMap.page_view})`);
  ok("movie_view recorded", evMap.movie_view === 1);
  ok("series_view + episode_view recorded", evMap.series_view === 1 && evMap.episode_view === 1);
  ok("search recorded (debounced: one per query)", evMap.search === 1);
  const priv = (await db.query("select column_name from information_schema.columns where table_name='visitor_analytics'")).rows.map((r) => r.column_name);
  ok("no IP column stored", !priv.some((c) => /ip|email|name/i.test(c) && c !== "session_id"), JSON.stringify(priv));

  // P–T: admin dashboard shows real data
  await pg.bringToFront();
  await pg.reload({ waitUntil: "networkidle0" }); await W(1200);
  if (!(await pg.$("[data-testid=admin-tab-viewing]"))) await adminLogin(pg);
  await pg.click("[data-testid=admin-tab-viewing]");
  await pg.waitForSelector("[data-testid=stat-visits]", { timeout: 10000 });
  const read = () => pg.evaluate(() => {
    const num = (id) => Number((document.querySelector(`[data-testid=${id}]`)?.textContent || "").replace(/[^\d٠-٩]/g, "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)));
    return {
      visits: num("stat-visits"), unique: num("stat-unique"), countries: num("stat-countries"), content: num("stat-content"),
      movie: num("stat-movie"), series: num("stat-series"), episode: num("stat-episode"), search: num("stat-search"),
      rows: [...document.querySelectorAll("[data-testid=country-row]")].map((r) => ({ code: r.dataset.code, visits: +r.dataset.visits, text: r.textContent })),
      bars: document.querySelectorAll("[data-testid=activity-chart] rect[fill='var(--primary-color)']").length,
      updated: document.querySelector("[data-testid=stats-last-updated]")?.textContent || "",
      html: document.querySelector("[data-testid=viewing-stats]")?.innerText || "",
    };
  });
  const d = await read();
  ok("Q: summary cards show real counts", d.visits === 6 && d.unique === 6 && d.countries === 3 && d.content === 3, JSON.stringify({ v: d.visits, u: d.unique, c: d.countries, content: d.content }));
  ok("   distinguishes movie / series / episode / search", d.movie === 1 && d.series === 1 && d.episode === 1 && d.search === 1);
  ok("S: countries listed under الدول الأكثر زيارة with flag + name + %", d.rows.length === 3 && /🇸🇦/.test(d.rows[0].text) && /السعودية/.test(d.rows[0].text) && /50%/.test(d.rows[0].text), JSON.stringify(d.rows.map((r) => r.text)));
  ok("T: ranking by actual visits (SA 3 > AE 2 > EG 1)", d.rows.map((r) => `${r.code}:${r.visits}`).join(",") === "SA:3,AE:2,EG:1");
  ok("daily chart: 24 hourly buckets from DB", d.bars === 24, `(${d.bars})`);
  ok("آخر تحديث shown", /آخر تحديث: .*\d/.test(d.updated) || /آخر تحديث: .*[٠-٩]/.test(d.updated), d.updated);
  ok("V: no IP / email / names exposed in UI", !/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(d.html) && !/@/.test(d.html));

  // R: period switching changes the backend query — add backdated rows (test-only, removed after)
  await db.query(`INSERT INTO visitor_analytics (visitor_id, country, country_code, event_type, session_id, dedupe_key, created_at) VALUES
    ('test-visitor-3d', 'GB', 'GB', 'site_visit', 'test-session-3d', 'test-dedupe-3d', now() - interval '3 days'),
    ('test-visitor-20d', 'US', 'US', 'site_visit', 'test-session-20d', 'test-dedupe-20d', now() - interval '20 days')`);
  await pg.click("[data-testid=period-daily]"); await W(1200);
  const daily = await read();
  await pg.click("[data-testid=period-weekly]"); await W(1500);
  const weekly = await read();
  await pg.click("[data-testid=period-monthly]"); await W(1500);
  const monthly = await read();
  ok("R: يومي excludes older visits", daily.visits === 6 && !daily.rows.some((r) => ["GB", "US"].includes(r.code)), `(daily ${daily.visits})`);
  ok("R: أسبوعي includes the 3-day-old visit, 7 day buckets", weekly.visits === 7 && weekly.rows.some((r) => r.code === "GB") && weekly.bars === 7, `(weekly ${weekly.visits}, bars ${weekly.bars})`);
  ok("R: شهري includes the 20-day-old visit, 30 day buckets", monthly.visits === 8 && monthly.rows.some((r) => r.code === "US") && monthly.bars === 30, `(monthly ${monthly.visits}, bars ${monthly.bars})`);
  await db.query("DELETE FROM visitor_analytics WHERE dedupe_key LIKE 'test-dedupe-%'");

  // API privacy + auth
  const apiJson = await pg.evaluate(async () => (await fetch("/api/analytics/visitors?period=weekly", { headers: { "x-naz-admin": "1" } })).text());
  ok("API response contains no IPs, visitor ids or emails", !/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(apiJson) && !/visitor_id|visitorId|sessionId|@/.test(apiJson));
  const anon = await fetch(URL + "/api/analytics/visitors?period=daily");
  ok("stats API open to anonymous (auth disabled)", anon.status === 200);
  const forgedUser = await fetch(URL + "/api/track", { method: "POST", headers: { "Content-Type": "application/json", "user-agent": "Mozilla/5.0" }, body: JSON.stringify({ eventType: "movie_view", visitorId: "abcdefgh-1234", sessionId: "abcdefgh-5678", contentId: 1, contentType: "movie", userId: 1 }) });
  const fu = (await db.query("select user_id from visitor_analytics where visitor_id='abcdefgh-1234'")).rows[0];
  ok("client-sent userId ignored for anonymous events", forgedUser.status === 200 && fu && fu.user_id === null);
  const botRes = await (await fetch(URL + "/api/track", { method: "POST", headers: { "Content-Type": "application/json", "user-agent": "Googlebot/2.1" }, body: JSON.stringify({ eventType: "site_visit", visitorId: "botbotbot-1", sessionId: "botbotbot-2" }) })).json();
  ok("bots are not counted", botRes.skipped === "bot");

  // Empty state (no data) — check with empty table then restore
  const backup = (await db.query("select * from visitor_analytics")).rows;
  await db.query("DELETE FROM visitor_analytics");
  await pg.click("[data-testid=period-daily]"); await W(1500);
  ok("empty state text when no data", (await pg.$eval("[data-testid=stats-empty]", (e) => e.textContent).catch(() => "")).includes("لا توجد بيانات مشاهدة كافية حتى الآن"));
  for (const r of backup) {
    await db.query("insert into visitor_analytics (visitor_id,user_id,country,country_code,page_type,content_id,content_type,event_type,session_id,dedupe_key,created_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
      [r.visitor_id, r.user_id, r.country, r.country_code, r.page_type, r.content_id, r.content_type, r.event_type, r.session_id, r.dedupe_key, r.created_at]);
  }

  // W: reload dashboard — settings + analytics still work
  await pg.evaluate(() => localStorage.setItem("nazmovies_admin_open", "1"));
  await pg.reload({ waitUntil: "networkidle0" }); await W(1200);
  await pg.click("[data-testid=admin-tab-viewing]"); await pg.waitForSelector("[data-testid=stat-visits]", { timeout: 10000 });
  const again = await read();
  ok("W: after reload analytics still load; theme still purple", again.visits === 6 && (await pg.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--primary-color").trim().toUpperCase())) === "#A855F7");

  ok("no page runtime errors", errs.length === 0, JSON.stringify(errs.slice(0, 3)));
  for (const { c } of ctx) await c.close();
  await b.close(); await db.end();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
