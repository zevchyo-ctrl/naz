// Browser E2E: playback progress/resume, continue watching, history, customization, telegram, i18n, responsive
const p = require("/tmp/pt/node_modules/puppeteer");
const fs = require("fs");
const W = (ms) => new Promise((r) => setTimeout(r, ms));
const URL = "http://127.0.0.1:3000";
let pass = 0, fail = 0;
const ok = (n, c, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${n} ${x}`); };
const clickText = (pg, sel, txt) => pg.evaluate((sel, txt) => {
  const el = [...document.querySelectorAll(sel)].find((b) => b.textContent.trim().includes(txt));
  if (el) el.click(); return !!el;
}, sel, txt);

async function setInput(pg, sel, text) {
  await pg.click(sel);
  await pg.keyboard.down("Control"); await pg.keyboard.press("KeyA"); await pg.keyboard.up("Control");
  await pg.keyboard.press("Backspace");
  await pg.type(sel, text);
}

async function registerViaUI(pg, email, name) {
  await clickText(pg, "header button", "تسجيل الدخول"); await W(400);
  await clickText(pg, "button", "إنشاء حساب"); await W(300);
  const inputs = await pg.$$("form input[type=text]");
  await inputs[0].type(name); await inputs[1].type(name.replace(/\s/g, "").toLowerCase());
  await pg.type("input[type=email]", email); await pg.type("input[type=password]", "pass1234");
  await pg.click("form button[type=submit]"); await W(1500);
}

(async () => {
  const b = await p.launch({ args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"] });
  const pg = await b.newPage();
  await pg.setViewport({ width: 1366, height: 900 });
  const errs = []; pg.on("pageerror", (e) => errs.push(e.message));
  await pg.goto(URL, { waitUntil: "networkidle0" });

  /* ---------- Playback progress & resume (Account A) ---------- */
  const emailA = `ua${Date.now()}@naz.com`;
  await registerViaUI(pg, emailA, "Viewer A");
  ok("A registered & logged in", await pg.evaluate(() => !!localStorage.getItem("nazmovies_user_token")));
  await pg.keyboard.press("Escape");
  await pg.evaluate(() => document.querySelectorAll("[data-testid=auth-modal]").forEach(() => {}));
  // close auth modal if still open
  await pg.evaluate(() => { const m = document.querySelector("[data-testid=auth-modal]"); if (m) [...m.querySelectorAll("button")].find((b) => b.querySelector("svg.lucide-x"))?.click(); });
  await W(300);

  await clickText(pg, "button", "ابدأ المشاهدة"); // hero Watch Now
  let ready = false;
  for (let i = 0; i < 40 && !ready; i++) { await W(500); ready = await pg.evaluate(() => { const v = document.querySelector("[data-testid=naz-video]"); return !!v && v.readyState >= 1 && isFinite(v.duration) && v.duration > 0; }); }
  ok("video metadata loaded in player", ready);
  let seekTo = 0;
  if (ready) {
    seekTo = await pg.evaluate(async () => {
      const v = document.querySelector("[data-testid=naz-video]"); v.muted = true;
      const target = 2; v.currentTime = target;
      await v.play().catch(() => {}); return target;
    });
    await W(10600); // periodic auto-save fires every 10s while playing (no close needed)
    const saved = await pg.evaluate(async () => {
      const r = await fetch("/api/history", { headers: { Authorization: "Bearer " + localStorage.getItem("nazmovies_user_token") } });
      return (await r.json()).items;
    });
    ok("progress auto-saved during playback (before closing)", saved.length > 0 && saved[0].currentTime >= seekTo && !saved[0].completed, `(saved ${saved[0]?.currentTime?.toFixed(1)}s of ${saved[0]?.duration?.toFixed(1)}s)`);
    seekTo = saved[0]?.currentTime || seekTo;
    // simulate leaving: reload page without closing player
    await pg.reload({ waitUntil: "networkidle0" }); await W(1500);
    ok("Continue Watching section on homepage", !!(await pg.$("[data-testid=continue-watching-section]")));
    const cardTxt = await pg.$eval("[data-testid=continue-card]", (e) => e.textContent).catch(() => "");
    ok("continue card shows % and Continue button", /%/.test(cardTxt) && cardTxt.includes("متابعة المشاهدة"));
    await pg.click("[data-testid=continue-card]");
    let resumed = 0;
    for (let i = 0; i < 40; i++) { await W(500); resumed = await pg.evaluate(() => document.querySelector("[data-testid=naz-video]")?.currentTime || 0); if (resumed > 1) break; }
    ok("playback resumes from saved position", resumed >= seekTo - 1, `(resumed at ${resumed.toFixed(1)}s, expected ≈${seekTo}s)`);
    ok("resume notice shown", !!(await pg.$("[data-testid=resume-notice]")));
    await pg.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.title === "إغلاق المشغل")?.click());
    await W(1200);
  }

  // Account B isolation in the UI
  const tokenA = await pg.evaluate(() => localStorage.getItem("nazmovies_user_token"));
  await pg.evaluate(() => { localStorage.removeItem("nazmovies_user_token"); localStorage.removeItem("nazmovies_user"); });
  await pg.reload({ waitUntil: "networkidle0" });
  await registerViaUI(pg, `ub${Date.now()}@naz.com`, "Viewer B");
  await pg.evaluate(() => { const m = document.querySelector("[data-testid=auth-modal]"); if (m) [...m.querySelectorAll("button")].find((b) => b.querySelector("svg.lucide-x"))?.click(); });
  await W(800);
  ok("Account B sees no Continue Watching from A", !(await pg.$("[data-testid=continue-watching-section]")));
  // back to A
  await pg.evaluate((t) => { localStorage.setItem("nazmovies_user_token", t); localStorage.setItem("nazmovies_user", JSON.stringify({ id: 0, name: "x" })); }, tokenA);
  await pg.reload({ waitUntil: "networkidle0" }); await W(1500);
  ok("Account A progress still there after switching back", !!(await pg.$("[data-testid=continue-watching-section]")));

  // Account page tabs + clear history with confirmation (favorites untouched)
  await pg.evaluate(() => localStorage.setItem("nazmovies_favorites", JSON.stringify(["movie-1"])));
  await pg.click("header button:has(svg.lucide-user)"); await W(600);
  const tabs = await pg.$$eval("[data-testid^=account-tab-]", (els) => els.map((e) => e.textContent));
  ok("account has Continue/History/Favorites/Settings tabs", tabs.length === 4, JSON.stringify(tabs));
  await pg.click("[data-testid=account-tab-history]"); await W(300);
  ok("watch history list rendered", !!(await pg.$("[data-testid=history-list]")));
  await pg.click("[data-testid=clear-history]"); await W(300);
  ok("confirmation dialog appears before clearing", !!(await pg.$("[data-testid=confirm-clear-history]")));
  await pg.click("[data-testid=confirm-clear-history]"); await W(1200);
  ok("history cleared", !(await pg.$("[data-testid=history-list]")));
  ok("favorites NOT deleted by clearing history", await pg.evaluate(() => localStorage.getItem("nazmovies_favorites") === '["movie-1"]'));
  await pg.reload({ waitUntil: "networkidle0" });

  /* ---------- Customization (admin) ---------- */
  await pg.click("[data-testid=admin-open-btn]"); await W(1500);
  await pg.click("[data-testid=admin-tab-viewing]"); await W(800);
  ok("Viewing Statistics tab renders", !!(await pg.$("[data-testid=viewing-stats]")));
  await pg.click("[data-testid=admin-tab-customization]"); await W(500);
  ok("Website Customization tab renders", !!(await pg.$("[data-testid=customization-panel]")));

  await setInput(pg, "[data-testid=site-name-input]", "CINEVERSE");
  ok("live preview updates name immediately", (await pg.$eval("[data-testid=preview-site-name]", (e) => e.textContent)) === "CINEVERSE");
  ok("live site NOT changed before save", (await pg.$eval("[data-testid=site-name]", (e) => e.textContent.trim())) !== "CINEVERSE");
  await pg.click("[data-testid=preset-blue]"); await W(200);
  // manually tweak the preset afterwards
  await setInput(pg, "[data-testid=color-secondary]", "#123ABC");
  await setInput(pg, "[data-testid=section-footer]", "#220033");
  const previewPrimary = await pg.$eval("[data-testid=live-preview]", (e) => getComputedStyle(e).getPropertyValue("--primary-color").trim());
  ok("preview uses preset colour", previewPrimary.toUpperCase() === "#38BDF8", previewPrimary);
  // logo upload
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  fs.writeFileSync("/tmp/naz-logo.png", png);
  const fileInput = await pg.$("[data-testid=logo-file]"); await fileInput.uploadFile("/tmp/naz-logo.png"); await W(500);
  // telegram
  await setInput(pg, "[data-testid=telegram-input]", "https://t.me/cineverse_support");
  const clientErr = await pg.$eval("[data-testid=customization-error]", (e) => e.textContent).catch(() => "");
  if (clientErr) console.log("client validation:", clientErr);
  await pg.click("[data-testid=customization-save]"); await W(1500);
  ok("header name updated after save", (await pg.$eval("[data-testid=site-name]", (e) => e.textContent.trim())) === "CINEVERSE");

  await pg.evaluate(() => localStorage.setItem("nazmovies_admin_open","0")); // close dashboard (session kept)
  await pg.reload({ waitUntil: "networkidle0" }); await W(800);
  const after = await pg.evaluate(() => ({
    header: document.querySelector("[data-testid=site-name]")?.textContent.trim(),
    footer: document.querySelector("[data-testid=footer-site-name]")?.textContent.trim(),
    title: document.title,
    primary: getComputedStyle(document.documentElement).getPropertyValue("--primary-color").trim(),
    secondary: getComputedStyle(document.documentElement).getPropertyValue("--secondary-color").trim(),
    footerBg: getComputedStyle(document.querySelector("footer")).backgroundColor,
    logos: document.querySelectorAll("[data-testid=site-logo-img]").length,
  }));
  ok("name persists in header+footer+title after refresh", after.header === "CINEVERSE" && after.footer === "CINEVERSE" && after.title.includes("CINEVERSE"), JSON.stringify([after.header, after.footer, after.title]));
  ok("theme colours persist (preset + manual edit)", after.primary.toUpperCase() === "#38BDF8" && after.secondary.toUpperCase() === "#123ABC", `${after.primary} ${after.secondary}`);
  ok("section colour applied (footer)", after.footerBg === "rgb(34, 0, 51)", after.footerBg);
  ok("uploaded logo shown in header and footer", after.logos >= 2, `(${after.logos})`);
  const ssr = await (await fetch(URL)).text();
  ok("server-rendered HTML already has new name + theme (no flash)", ssr.includes("CINEVERSE") && ssr.toLowerCase().includes("--primary-color:#38bdf8"));

  // Telegram contact
  await pg.click("[data-testid=nav-contact]"); await W(400);
  const tg = await pg.$eval("[data-testid=telegram-link]", (e) => ({ href: e.href, target: e.target, text: e.textContent.trim() }));
  ok("Contact Us opens Telegram link from settings", tg.href === "https://t.me/cineverse_support" && tg.target === "_blank", JSON.stringify(tg));
  await pg.keyboard.press("Escape");
  await pg.evaluate(() => { const m = document.querySelector("[data-testid=contact-modal]"); m && [...m.querySelectorAll("button")][0].click(); });
  ok("footer has Contact Us", !!(await pg.$("[data-testid=footer-contact]")));

  // Restore defaults
  for (let i = 0; i < 4; i++) { await pg.click("[data-testid=naz-logo]"); await W(150); }
  await W(800);
  await pg.click("[data-testid=admin-tab-customization]"); await W(400);
  await pg.click("[data-testid=restore-default-theme]"); await W(300);
  ok("restore asks for confirmation", (await pg.content()).includes("هل أنت متأكد من استعادة مظهر NAZMOVIES الافتراضي؟"));
  await pg.click("[data-testid=confirm-restore]"); await W(1500);
  await pg.evaluate(() => localStorage.setItem("nazmovies_admin_open","0"));
  await pg.reload({ waitUntil: "networkidle0" }); await W(800);
  const def = await pg.evaluate(() => ({
    name: document.querySelector("[data-testid=site-name]")?.textContent.trim(),
    primary: getComputedStyle(document.documentElement).getPropertyValue("--primary-color").trim(),
    logos: document.querySelectorAll("[data-testid=site-logo-img]").length,
  }));
  ok("defaults restored (name, colours, logo)", def.name === "NAZMOVIES" && def.primary.toUpperCase() === "#FFD21F" && def.logos === 0, JSON.stringify(def));
  const moviesStill = (await (await fetch(URL + "/api/movies")).json()).movies.length;
  ok("content untouched by restore", moviesStill >= 12, `(${moviesStill} movies)`);
  await pg.evaluate(() => {  localStorage.removeItem("nazmovies_admin_open"); });

  /* ---------- Language ---------- */
  await pg.reload({ waitUntil: "networkidle0" });
  await clickText(pg, "header button", "EN"); await W(500);
  const en = await pg.evaluate(() => ({ dir: document.documentElement.dir, txt: document.body.innerText }));
  ok("English: LTR + new labels translated", en.dir === "ltr" && en.txt.includes("Contact Us"), en.dir);
  await pg.click("[data-testid=nav-contact]"); await W(300);
  ok("English contact dialog", (await pg.content()).includes("Contact Us on Telegram"));
  await pg.evaluate(() => { const m = document.querySelector("[data-testid=contact-modal]"); m && [...m.querySelectorAll("button")][0].click(); });
  await clickText(pg, "header button", "العربية"); await W(400);
  ok("Arabic: RTL restored", (await pg.evaluate(() => document.documentElement.dir)) === "rtl");

  /* ---------- Responsive ---------- */
  for (const [name, dev] of [["mobile (iPhone 13)", p.KnownDevices["iPhone 13"]], ["Android (Pixel 5)", p.KnownDevices["Pixel 5"]], ["tablet (iPad)", p.KnownDevices["iPad"]]]) {
    const m = await b.newPage(); await m.emulate(dev);
    await m.goto(URL, { waitUntil: "networkidle0" });
    await m.evaluate(() => {  localStorage.removeItem("nazmovies_admin_open"); });
    await m.reload({ waitUntil: "networkidle0" });
    const overflow = await m.evaluate(() => document.documentElement.scrollWidth - screen.width);
    let contact = true;
    if (await m.$("header button.lg\\:hidden")) {
      await m.click("header button.lg\\:hidden"); await W(300);
      contact = !!(await m.$("[data-testid=mobile-contact]"));
    }
    await m.tap("[data-testid=admin-open-btn]"); await W(800);
    await W(600); // admin auth disabled — dashboard opens directly
    await m.click("[data-testid=admin-tab-customization]"); await W(400);
    const panelW = await m.$eval("[data-testid=customization-panel]", (e) => e.getBoundingClientRect().width);
    const dashOverflow = await m.evaluate(() => document.documentElement.scrollWidth - screen.width);
    if (dashOverflow > 1) console.log("dashboard overflow", dashOverflow);
    ok(`${name}: no horizontal overflow, contact reachable, customization usable`, overflow <= 1 && contact && panelW > 200 && panelW <= dev.viewport.width, `(overflow ${overflow}, panel ${Math.round(panelW)}px)`);
    await m.close();
  }

  ok("no page runtime errors", errs.length === 0, JSON.stringify(errs.slice(0, 3)));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
