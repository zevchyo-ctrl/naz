// Fullscreen verification for the video player
const p = require("/tmp/pt/node_modules/puppeteer");
const W = (ms) => new Promise((r) => setTimeout(r, ms));
const URL = process.env.URL || "http://127.0.0.1:3000";
let pass = 0, fail = 0;
const ok = (n, c, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${n} ${x}`); };

async function openPlayer(pg) {
  await pg.goto(URL, { waitUntil: "networkidle0" });
  await pg.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.includes("ابدأ المشاهدة"))?.click());
  await pg.waitForSelector("[data-testid=fullscreen-btn]", { timeout: 10000 });
  await W(500);
}
const state = (pg) => pg.evaluate(() => {
  const btn = document.querySelector("[data-testid=fullscreen-btn]");
  const canvas = document.querySelector(".naz-player-canvas");
  return {
    fsEl: document.fullscreenElement?.getAttribute("data-testid") || null,
    label: btn?.getAttribute("aria-label"),
    canvasH: Math.round(canvas?.getBoundingClientRect().height || 0),
    vh: window.innerHeight,
    containerW: Math.round(document.querySelector("[data-testid=player-container]")?.getBoundingClientRect().width || 0),
    vw: window.innerWidth,
  };
});

(async () => {
  const b = await p.launch({ args: ["--no-sandbox"] });
  const errs = [];

  /* Desktop */
  const pg = await b.newPage();
  pg.on("pageerror", (e) => errs.push(e.message));
  await pg.setViewport({ width: 1366, height: 800 });
  await openPlayer(pg);
  const btnBox = await (await pg.$("[data-testid=fullscreen-btn]")).boundingBox();
  ok("desktop: fullscreen button visible", !!btnBox && btnBox.width > 0 && btnBox.y + btnBox.height <= 800, JSON.stringify(btnBox && { x: Math.round(btnBox.x), y: Math.round(btnBox.y) }));

  await pg.click("[data-testid=fullscreen-btn]"); await W(700);
  let s = await state(pg);
  ok("requestFullscreen() on player container", s.fsEl === "player-container", JSON.stringify(s));
  ok("button switches to Exit (Minimize)", s.label === "إنهاء ملء الشاشة");
  ok("player fills the screen", s.containerW >= s.vw - 2 && s.canvasH > s.vh * 0.6, `(container ${s.containerW}/${s.vw}, video ${s.canvasH}/${s.vh})`);
  const serversVisible = await pg.evaluate(() => document.fullscreenElement?.textContent.includes("سيرفرات التشغيل"));
  ok("custom controls & servers stay visible in fullscreen", !!serversVisible);

  await pg.click("[data-testid=fullscreen-btn]"); await W(700);
  s = await state(pg);
  ok("exitFullscreen() via button", s.fsEl === null && s.label === "ملء الشاشة", JSON.stringify(s));

  // External exit (Esc / system) must resync icon
  await pg.click("[data-testid=fullscreen-btn]"); await W(600);
  await pg.evaluate(() => (document.fullscreenElement ? document.exitFullscreen() : null));
  await W(600);
  s = await state(pg);
  ok("icon resyncs after external exit (Esc)", s.fsEl === null && s.label === "ملء الشاشة", JSON.stringify(s));

  // Double-click video toggles
  await pg.evaluate(() => window.scrollTo(0, 0));
  const vbox = await (await pg.$("[data-testid=naz-video]")).boundingBox();
  const hit = await pg.evaluate((x, y) => { const e = document.elementFromPoint(x, y); return e.tagName + "." + String(e.className).slice(0, 60); }, vbox.x + vbox.width / 2, vbox.y + vbox.height / 3);
  await pg.evaluate(() => { window.__dbl = 0; document.querySelector("[data-testid=naz-video]").addEventListener("dblclick", () => window.__dbl++); });
  await pg.mouse.click(vbox.x + vbox.width / 2, vbox.y + vbox.height / 3, { count: 2 }); await W(700);
  console.log("   dblclick target:", hit, "dblclick events:", await pg.evaluate(() => window.__dbl));
  ok("double-click video enters fullscreen", (await state(pg)).fsEl === "player-container");
  await pg.evaluate(() => (document.fullscreenElement ? document.exitFullscreen() : null)); await W(500);

  // Closing player while fullscreen exits fullscreen
  await pg.click("[data-testid=fullscreen-btn]"); await W(600);
  await pg.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.title === "إغلاق المشغل")?.click());
  await W(800);
  ok("closing player also exits fullscreen", await pg.evaluate(() => document.fullscreenElement === null));

  // English label
  await pg.evaluate(() => localStorage.setItem("nazmovies_lang", "en"));
  await pg.goto(URL, { waitUntil: "networkidle0" });
  await pg.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Watch Now"))?.click());
  await pg.waitForSelector("[data-testid=fullscreen-btn]");
  ok("English aria-label", (await pg.$eval("[data-testid=fullscreen-btn]", (e) => e.getAttribute("aria-label"))) === "Fullscreen");
  await pg.evaluate(() => localStorage.setItem("nazmovies_lang", "ar"));

  /* iPhone: visible button + webkitEnterFullscreen fallback when element fullscreen is unavailable */
  const m = await b.newPage();
  m.on("pageerror", (e) => errs.push(e.message));
  await m.emulate(p.KnownDevices["iPhone 13"]);
  await m.evaluateOnNewDocument(() => {
    // Simulate iPhone Safari: no element fullscreen API, only native video fullscreen
    delete Element.prototype.requestFullscreen;
    Object.defineProperty(Element.prototype, "requestFullscreen", { value: undefined, configurable: true });
    Object.defineProperty(Element.prototype, "webkitRequestFullscreen", { value: undefined, configurable: true });
    window.__iosFs = 0;
    HTMLVideoElement.prototype.webkitEnterFullscreen = function () {
      window.__iosFs++;
      this.dispatchEvent(new Event("webkitbeginfullscreen"));
    };
  });
  await openPlayer(m);
  const mBox = await (await m.$("[data-testid=fullscreen-btn]")).boundingBox();
  const vw = m.viewport().width;
  ok("mobile: fullscreen button visible inside viewport", !!mBox && mBox.x >= 0 && mBox.x + mBox.width <= vw, JSON.stringify(mBox && { x: Math.round(mBox.x), w: Math.round(mBox.width) }));
  await m.tap("[data-testid=fullscreen-btn]"); await W(500);
  const ios = await m.evaluate(() => ({ calls: window.__iosFs, label: document.querySelector("[data-testid=fullscreen-btn]").getAttribute("aria-label") }));
  ok("iOS path: webkitEnterFullscreen() called on <video>", ios.calls === 1 && ios.label === "إنهاء ملء الشاشة", JSON.stringify(ios));
  await m.evaluate(() => document.querySelector("[data-testid=naz-video]").dispatchEvent(new Event("webkitendfullscreen")));
  await W(300);
  ok("iOS path: icon resets on webkitendfullscreen", (await m.$eval("[data-testid=fullscreen-btn]", (e) => e.getAttribute("aria-label"))) === "ملء الشاشة");

  ok("no page errors", errs.length === 0, JSON.stringify(errs.slice(0, 3)));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
