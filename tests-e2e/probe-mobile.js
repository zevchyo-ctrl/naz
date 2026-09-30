// Debug helper: list elements wider than the mobile viewport inside the admin dashboard
const p = require("/tmp/pt/node_modules/puppeteer");
const W = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await p.launch({ args: ["--no-sandbox"] });
  const m = await b.newPage();
  await m.emulate(p.KnownDevices["iPhone 13"]);
  await m.goto("http://127.0.0.1:3000", { waitUntil: "networkidle0" });
  for (let i = 0; i < 4; i++) { await m.tap("[data-testid=naz-logo]"); await W(200); }
  await W(300);
  await m.type("input[type=password]", "9770327");
  await m.click("[data-testid=admin-login-submit]"); await W(1500);
  for (const tab of ["analytics"]) {
    await m.click(`[data-testid=admin-tab-${tab}]`); await W(500);
    const r = await m.evaluate(() => {
      const vw = screen.width; console.log("innerWidth", window.innerWidth);
      const all = [...document.querySelectorAll("body *")];
      const wide = all.filter((x) => x.getBoundingClientRect().right > vw + 2 && !x.closest(".z-\\[110\\]"));
      // innermost offenders (no wide descendants)
      return {
        vw, docW: document.documentElement.scrollWidth,
        offenders: wide.filter((x) => !wide.some((y) => y !== x && x.contains(y)))
          .map((x) => `${x.tagName}.${String(x.className).slice(0, 100)} w=${Math.round(x.getBoundingClientRect().width)} text="${(x.textContent || "").trim().slice(0, 40)}"`),
      };
    });
    console.log(tab, JSON.stringify(r, null, 1));
  }
  await b.close();
})();
