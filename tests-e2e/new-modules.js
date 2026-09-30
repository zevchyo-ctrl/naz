// Ad Management + User Management + Premium/Telegram modules
const p = require("/tmp/pt/node_modules/puppeteer");
const { Client } = require("/app/node_modules/pg");
const W = (ms) => new Promise((r) => setTimeout(r, ms));
const URL = process.env.URL || "http://127.0.0.1:3000";
let pass = 0, fail = 0;
const ok = (n, c, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${n} ${x}`); };

const setVal = (pg, sel, text) => pg.evaluate((sel, text) => {
  const el = document.querySelector(sel);
  const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement : window.HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, "value").set.call(el, text);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}, sel, text);

(async () => {
  const db = new Client({ connectionString: "postgresql://postgres:postgres@127.0.0.1:5432/app_db" }); await db.connect();
  const settings = async () => (await db.query("select data from site_settings where key='main'")).rows[0].data;

  // Reset ad + premium settings so the run is deterministic (toggles flip state)
  await fetch(URL + "/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-naz-admin": "1" },
    body: JSON.stringify({
      adsEnabled: true,
      adConfig: {
        popup: { enabled: false, code: "" },
        bannerHeader: { enabled: false, code: "" },
        bannerPlayer: { enabled: false, code: "" },
        bannerFooter: { enabled: false, code: "" },
        headerScripts: { enabled: false, code: "" },
      },
      premiumSettings: { price: "$5 / Month", telegramUsername: "@nazmovies_admin", paymentInstructions: "reset" },
    }),
  });

  const b = await p.launch({ args: ["--no-sandbox"] });
  const pg = await b.newPage();
  await pg.setViewport({ width: 1400, height: 950 });
  const errs = []; pg.on("pageerror", (e) => errs.push(e.message));
  const consoleErrs = [];
  pg.on("console", (m) => { if (m.type() === "error" && !m.text().includes("404")) consoleErrs.push(m.text()); });

  await pg.goto(URL, { waitUntil: "networkidle0" });
  await pg.click("[data-testid=admin-open-btn]"); await W(1500);

  /* ================= 1. AD MANAGEMENT ================= */
  await pg.click("[data-testid=admin-tab-ads]"); await W(800);
  ok("1. Ad Management tab renders", !!(await pg.$("[data-testid=ad-management-panel]")));
  const slots = ["popup", "bannerHeader", "bannerPlayer", "bannerFooter", "headerScripts"];
  const present = [];
  for (const s of slots) present.push(!!(await pg.$(`[data-testid=ad-slot-${s}]`)) && !!(await pg.$(`[data-testid=ad-code-${s}]`)) && !!(await pg.$(`[data-testid=ad-toggle-${s}]`)));
  ok("1. all 5 slots have a toggle + textarea", present.every(Boolean), JSON.stringify(slots));

  // Fill real, observable ad tags
  const HEADER_AD = '<div id="naz-ad-header-probe">HEADER BANNER AD</div><script>window.__adHeader=(window.__adHeader||0)+1;</script>';
  const FOOTER_AD = '<div id="naz-ad-footer-probe">FOOTER BANNER AD</div>';
  const PLAYER_AD = '<div id="naz-ad-player-probe">PLAYER BANNER AD</div>';
  const POPUP_AD = '<script>window.__adPopupFired=(window.__adPopupFired||0)+1;</script>';
  const HEAD_AD = '<script>window.__adTracking=(window.__adTracking||0)+1;</script>';

  await setVal(pg, "[data-testid=ad-code-bannerHeader]", HEADER_AD);
  await pg.click("[data-testid=ad-toggle-bannerHeader]");
  await setVal(pg, "[data-testid=ad-code-bannerFooter]", FOOTER_AD);
  await pg.click("[data-testid=ad-toggle-bannerFooter]");
  await setVal(pg, "[data-testid=ad-code-bannerPlayer]", PLAYER_AD);
  await pg.click("[data-testid=ad-toggle-bannerPlayer]");
  await setVal(pg, "[data-testid=ad-code-popup]", POPUP_AD);
  await setVal(pg, "[data-testid=ad-code-headerScripts]", HEAD_AD);
  await pg.click("[data-testid=ad-toggle-headerScripts]");
  // popup intentionally left INACTIVE for the "disabled = never runs" check
  await W(300);
  const toggleStates = await pg.evaluate(() =>
    ["bannerHeader", "bannerFooter", "bannerPlayer", "headerScripts"].map(
      (k) => document.querySelector(`[data-testid=ad-toggle-${k}]`).getAttribute("aria-pressed")
    )
  );
  ok("1. toggles switched to Active", toggleStates.every((v) => v === "true"), JSON.stringify(toggleStates));
  await pg.click("[data-testid=ad-save]"); await W(1800);
  ok("1. Save Ad Settings persists to the database", (await settings()).adConfig.bannerHeader.code === HEADER_AD && (await settings()).adConfig.bannerHeader.enabled === true);
  const lsAds = await pg.evaluate(() => localStorage.getItem("site_ad_config"));
  ok("1. mirrored to localStorage('site_ad_config')", !!lsAds && JSON.parse(lsAds).bannerHeader.code === HEADER_AD);

  // Frontend injection as a normal visitor
  const vis = await b.createBrowserContext();
  const vp = await vis.newPage();
  const visErrs = []; vp.on("pageerror", (e) => visErrs.push(e.message));
  await vp.goto(URL, { waitUntil: "networkidle0" }); await W(1200);
  const injected = await vp.evaluate(() => ({
    header: !!document.getElementById("naz-ad-header-probe"),
    footer: !!document.getElementById("naz-ad-footer-probe"),
    headerScriptRan: window.__adHeader || 0,
    tracking: window.__adTracking || 0,
    popupBefore: window.__adPopupFired || 0,
  }));
  ok("1. header + footer banners injected into the live site", injected.header && injected.footer);
  ok("1. <script> inside an ad tag actually executes", injected.headerScriptRan === 1 && injected.tracking === 1, JSON.stringify(injected));
  ok("1. DISABLED pop-up never runs", injected.popupBefore === 0);

  // Enable pop-up, confirm it fires only on interaction
  await pg.click("[data-testid=ad-toggle-popup]"); await W(200);
  await pg.click("[data-testid=ad-save]"); await W(1800);
  await vp.reload({ waitUntil: "networkidle0" }); await W(1200);
  const beforeClick = await vp.evaluate(() => window.__adPopupFired || 0);
  await vp.mouse.click(700, 400); await W(800);
  const afterClick = await vp.evaluate(() => window.__adPopupFired || 0);
  ok("1. pop-under fires on user interaction, not on load", beforeClick === 0 && afterClick === 1, `(before ${beforeClick}, after ${afterClick})`);

  // Player banner
  await vp.evaluate(() => [...document.querySelectorAll("button")].find((x) => x.textContent.includes("ابدأ المشاهدة"))?.click());
  await W(2500);
  ok("1. below-player banner injected in the video player", await vp.evaluate(() => !!document.getElementById("naz-ad-player-probe")));
  await vp.evaluate(() => [...document.querySelectorAll("button")].find((x) => x.title === "إغلاق المشغل")?.click());
  await W(500);

  // Master switch OFF → nothing renders
  await pg.click("[data-testid=admin-tab-settings]"); await W(800);
  const toggleMaster = () => pg.evaluate(() => {
    // the ON/OFF button sits in the same card as this label
    const label = [...document.querySelectorAll("p")].find((p) => p.textContent.includes("تفعيل نظام الإعلانات العام"));
    const card = label?.closest("div")?.parentElement;
    const btn = [...(card?.querySelectorAll("button") || [])].find((b) => ["ON", "OFF"].includes(b.textContent.trim()));
    btn?.click();
    return btn?.textContent.trim();
  });
  await toggleMaster();
  await W(1600);
  await vp.reload({ waitUntil: "networkidle0" }); await W(1400);
  const offState = await vp.evaluate(() => ({ header: !!document.getElementById("naz-ad-header-probe"), tracking: window.__adTracking || 0 }));
  ok("1. master Ads switch OFF → no ad tags render or run", !offState.header && offState.tracking === 0, JSON.stringify(offState));
  ok("1. ad injection causes no page errors", visErrs.length === 0, JSON.stringify(visErrs.slice(0, 2)));
  ok("1. master switch OFF is stored in the database", (await settings()).adsEnabled === false);
  // restore
  await toggleMaster();
  await W(1600);
  ok("1. master switch restored to ON", (await settings()).adsEnabled === true);

  // Premium (ad-free) visitors must never execute ad tags, even briefly on load
  const premEmail = `prem${Date.now()}@naz.com`;
  const premUser = await vp.evaluate(async (em) => {
    const r = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "register", email: em, password: "pass1234", name: "Premium Visitor" }) });
    const d = await r.json();
    localStorage.setItem("nazmovies_user_token", d.token);
    localStorage.setItem("nazmovies_user", JSON.stringify(d.user));
    return d.user;
  }, premEmail);
  await fetch(URL + "/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json", "x-naz-admin": "1" }, body: JSON.stringify({ id: premUser.id, action: "premium" }) });
  await vp.reload({ waitUntil: "networkidle0" }); await W(1600);
  const premView = await vp.evaluate(() => ({ header: !!document.getElementById("naz-ad-header-probe"), tracking: window.__adTracking || 0, popup: window.__adPopupFired || 0 }));
  await vp.mouse.click(700, 400); await W(600);
  const premAfterClick = await vp.evaluate(() => window.__adPopupFired || 0);
  ok("1. premium (ad-free) visitor runs no ad tags at all", !premView.header && premView.tracking === 0 && premAfterClick === 0, JSON.stringify({ ...premView, afterClick: premAfterClick }));
  await fetch(URL + `/api/admin/users?id=${premUser.id}`, { method: "DELETE", headers: { "x-naz-admin": "1" } });
  await vp.evaluate(() => { localStorage.removeItem("nazmovies_user_token"); localStorage.removeItem("nazmovies_user"); });
  await vp.reload({ waitUntil: "networkidle0" }); await W(1000);

  /* ================= 2. USER MANAGEMENT ================= */
  // Seed a fresh account registered "today"
  const email = `mod${Date.now()}@naz.com`;
  const reg = await vp.evaluate(async (em) => {
    const r = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "register", email: em, password: "testpass99", name: "Module Tester", username: "moduletester" }) });
    return (await r.json()).user;
  }, email);

  await pg.click("[data-testid=admin-tab-users]"); await W(1800);
  ok("2. Users tab renders with a data table", !!(await pg.$("[data-testid=users-panel]")) && !!(await pg.$("[data-testid=users-table]")));
  const dbTotal = (await db.query("select count(*)::int n from users")).rows[0].n;
  const counters = await pg.evaluate(() => {
    const num = (id) => Number((document.querySelector(`[data-testid=${id}]`)?.textContent || "").replace(/[^\d٠-٩]/g, "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)));
    return { total: num("users-total"), today: num("users-today"), premium: num("users-premium"), free: num("users-free") };
  });
  ok("2. summary counters match the database", counters.total === dbTotal && counters.premium + counters.free === dbTotal && counters.today >= 1, JSON.stringify(counters));

  const row = `[data-testid=user-row-${reg.id}]`;
  await pg.waitForSelector(row, { timeout: 8000 });
  const rowText = await pg.$eval(row, (e) => e.innerText);
  ok("2. row shows ID, username, email, date and status", rowText.includes(String(reg.id)) && rowText.includes("moduletester") && rowText.includes(email));
  await pg.click("[data-testid=toggle-passwords]"); await W(300);
  ok("2. password column shows the new account's password", (await pg.$eval(`[data-testid=user-pw-${reg.id}]`, (e) => e.textContent)) === "testpass99");

  // Live search
  await setVal(pg, "[data-testid=users-search]", "moduletester"); await W(500);
  const visibleRows = await pg.$$eval("[data-testid^=user-row-]", (els) => els.length);
  ok("2. live search filters the table", visibleRows === 1, `(${visibleRows} rows)`);
  await setVal(pg, "[data-testid=users-search]", "premium"); await W(500);
  const premRows = await pg.$$eval("[data-testid^=user-row-]", (els) => els.length);
  ok("2. search by account type works", premRows > 0 && premRows < dbTotal, `(${premRows})`);
  await setVal(pg, "[data-testid=users-search]", ""); await W(400);

  // Upgrade → premium
  await pg.click(`[data-testid=user-plan-${reg.id}]`); await W(1500);
  ok("2. Upgrade to Premium works", (await db.query("select is_premium, plan from users where id=$1", [reg.id])).rows[0].is_premium === true);
  await pg.click(`[data-testid=user-plan-${reg.id}]`); await W(1500);
  ok("2. Downgrade to Free works", (await db.query("select is_premium from users where id=$1", [reg.id])).rows[0].is_premium === false);

  // Block → login refused → unblock
  await pg.click(`[data-testid=user-block-${reg.id}]`); await W(1500);
  const blockedLogin = await vp.evaluate(async (em) => {
    const r = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "login", email: em, password: "testpass99" }) });
    return r.status;
  }, email);
  ok("2. Block prevents the user from logging in", (await db.query("select is_blocked from users where id=$1", [reg.id])).rows[0].is_blocked === true && blockedLogin === 403, `(login HTTP ${blockedLogin})`);
  await pg.click(`[data-testid=user-block-${reg.id}]`); await W(1500);
  const okLogin = await vp.evaluate(async (em) => {
    const r = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "login", email: em, password: "testpass99" }) });
    return r.status;
  }, email);
  ok("2. Unblock restores login", okLogin === 200);

  // Set password
  await pg.click(`[data-testid=user-setpw-${reg.id}]`); await W(400);
  await setVal(pg, "[data-testid=setpw-input]", "newpass777");
  await pg.click("[data-testid=confirm-setpw]"); await W(1600);
  const newLogin = await vp.evaluate(async (em) => {
    const r = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "login", email: em, password: "newpass777" }) });
    return r.status;
  }, email);
  ok("2. Set password works and the user can log in with it", newLogin === 200);

  const lsUsers = await pg.evaluate(() => localStorage.getItem("site_users_db"));
  ok("2. mirrored to localStorage('site_users_db')", !!lsUsers && JSON.parse(lsUsers).length === dbTotal);

  // Delete
  await pg.click(`[data-testid=user-delete-${reg.id}]`); await W(400);
  ok("2. delete asks for confirmation first", !!(await pg.$("[data-testid=confirm-delete-user]")));
  await pg.click("[data-testid=confirm-delete-user]"); await W(1800);
  ok("2. Delete removes the account", (await db.query("select count(*)::int n from users where id=$1", [reg.id])).rows[0].n === 0);

  /* ================= 3. PREMIUM + TELEGRAM ================= */
  await pg.click("[data-testid=admin-tab-settings]"); await W(900);
  ok("3. premium settings panel is in Settings", !!(await pg.$("[data-testid=premium-settings-panel]")));
  await setVal(pg, "[data-testid=premium-price]", "$7 / Month");
  await setVal(pg, "[data-testid=premium-telegram]", "@NazPayments");
  await setVal(pg, "[data-testid=premium-instructions]", "فودافون كاش: 01055555555\nUSDT TRC20: TTESTWALLET123");
  await pg.click("[data-testid=premium-settings-save]"); await W(1800);
  const ps = (await settings()).premiumSettings;
  ok("3. premium settings saved to the database", ps.price === "$7 / Month" && ps.telegramUsername === "@NazPayments" && ps.paymentInstructions.includes("TTESTWALLET123"), JSON.stringify(ps.price));
  ok("3. mirrored to localStorage('site_premium_settings')", !!(await pg.evaluate(() => localStorage.getItem("site_premium_settings"))));

  // Invalid handle rejected
  await setVal(pg, "[data-testid=premium-telegram]", "@bad handle!!");
  await pg.click("[data-testid=premium-settings-save]"); await W(1000);
  ok("3. invalid Telegram username is rejected", !!(await pg.$("[data-testid=premium-settings-error]")));
  await setVal(pg, "[data-testid=premium-telegram]", "@NazPayments");
  await pg.click("[data-testid=premium-settings-save]"); await W(1500);

  // User-facing modal
  await vp.reload({ waitUntil: "networkidle0" }); await W(1200);
  await vp.evaluate(() => [...document.querySelectorAll("button")].find((x) => x.textContent.includes("الترقية بدون إعلانات"))?.click());
  await W(900);
  ok("3. upgrade modal shows the admin price and payment instructions",
    (await vp.$eval("[data-testid=premium-price-display]", (e) => e.textContent)).includes("$7 / Month") &&
    (await vp.$eval("[data-testid=premium-instructions-display]", (e) => e.textContent)).includes("TTESTWALLET123"));

  // Missing fields blocked
  await vp.click("[data-testid=premium-telegram-send]"); await W(600);
  ok("3. form validates required fields", !!(await vp.$("[data-testid=premium-form-error]")));

  await setVal(vp, "[data-testid=premium-form-name]", "Ahmed Tester");
  await setVal(vp, "[data-testid=premium-form-email]", "ahmed@example.com");
  await setVal(vp, "[data-testid=premium-form-method]", "Vodafone Cash");
  await setVal(vp, "[data-testid=premium-form-reference]", "TX-99887");
  await W(200);

  // Capture the Telegram URL
  const popupPromise = new Promise((resolve) => vis.once("targetcreated", async (t) => resolve(t.url())));
  await vp.click("[data-testid=premium-telegram-send]");
  const tgUrl = await Promise.race([popupPromise, new Promise((r) => setTimeout(() => r(""), 6000))]);
  const decoded = decodeURIComponent(tgUrl);
  ok("3. opens https://t.me/<admin> with a pre-filled message", tgUrl.startsWith("https://t.me/NazPayments?text="), tgUrl.slice(0, 60));
  ok("3. message contains username, email, price, method and date",
    decoded.includes("طلب اشتراك بريميوم جديد") && decoded.includes("Ahmed Tester") && decoded.includes("ahmed@example.com") &&
    decoded.includes("$7 / Month") && decoded.includes("Vodafone Cash") && decoded.includes("TX-99887") && /\d{4}/.test(decoded));
  await W(1500);
  const req = (await db.query("select * from premium_requests order by id desc limit 1")).rows[0];
  ok("3. request also recorded in the dashboard", req && req.email === "ahmed@example.com" && req.message.includes("Vodafone Cash"));

  /* ================= responsive + errors ================= */
  const m = await b.newPage();
  await m.emulate(p.KnownDevices["iPhone 13"]);
  await m.goto(URL, { waitUntil: "networkidle0" });
  await m.tap("[data-testid=admin-open-btn]"); await W(1500);
  await m.click("[data-testid=admin-tab-ads]"); await W(800);
  const adsW = await m.$eval("[data-testid=ad-management-panel]", (e) => e.getBoundingClientRect().width);
  const overflow1 = await m.evaluate(() => document.documentElement.scrollWidth - screen.width);
  await m.click("[data-testid=admin-tab-users]"); await W(1500);
  const overflow2 = await m.evaluate(() => document.documentElement.scrollWidth - screen.width);
  ok("mobile: ad + users tabs fit with no page overflow", overflow1 <= 1 && overflow2 <= 1 && adsW <= 390, `(ads ${Math.round(adsW)}px, overflow ${overflow1}/${overflow2})`);
  await m.close();

  ok("zero console/page errors", errs.length === 0 && consoleErrs.length === 0, JSON.stringify([...errs, ...consoleErrs].slice(0, 3)));

  await vis.close(); await b.close(); await db.end();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
