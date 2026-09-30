// Reproduce: select each preset in Website Customization → Save; log the actual PUT request/response
const p = require("/tmp/pt/node_modules/puppeteer");
const W = (ms) => new Promise((r) => setTimeout(r, ms));
const URL = process.env.URL || "http://127.0.0.1:3000";
(async () => {
  const b = await p.launch({ args: ["--no-sandbox"] });
  const pg = await b.newPage();
  await pg.setViewport({ width: 1366, height: 900 });
  pg.on("console", (m) => { if (m.type() === "error" || m.type() === "warn") console.log("  [console]", m.text()); });
  pg.on("response", async (r) => {
    if (r.url().includes("/api/settings") && r.request().method() === "PUT") {
      console.log("  PUT", r.status(), "req:", (r.request().postData() || "").slice(0, 160), "res:", (await r.text().catch(() => "")).slice(0, 200));
    }
  });
  await pg.goto(URL, { waitUntil: "networkidle0" });
  for (let i = 0; i < 4; i++) { await pg.click("[data-testid=naz-logo]"); await W(150); }
  await W(400);
  await pg.type("input[type=password]", "9770327");
  await pg.click("[data-testid=admin-login-submit]"); await W(1500);
  await pg.click("[data-testid=admin-tab-customization]"); await W(500);
  for (const id of ["dark-red", "blue", "black-gold", "purple", "default"]) {
    await pg.click(`[data-testid=preset-${id}]`); await W(300);
    const disabled = await pg.$eval("[data-testid=customization-save]", (e) => e.disabled);
    await pg.click("[data-testid=customization-save]"); await W(1400);
    const err = await pg.$eval("[data-testid=customization-error]", (e) => e.textContent).catch(() => "");
    console.log(`preset ${id}: saveDisabled=${disabled} error="${err}"`);
  }
  await b.close();
})();
