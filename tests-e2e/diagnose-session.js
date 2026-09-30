// Diagnose: where exactly is the admin session lost? Runs against the LIVE preview (HTTPS + proxy).
const p = require("/tmp/pt/node_modules/puppeteer");
const W = (ms) => new Promise((r) => setTimeout(r, ms));
const URL = process.env.URL;

(async () => {
  const b = await p.launch({ args: ["--no-sandbox"] });
  const pg = await b.newPage();
  await pg.setViewport({ width: 1366, height: 900 });

  const trace = [];
  pg.on("request", (r) => {
    if (r.url().includes("/api/")) trace.push({ dir: ">", m: r.method(), u: r.url().replace(URL, ""), tok: (r.headers()["x-admin-token"] || "(none)").slice(0, 16), cookie: (r.headers()["cookie"] || "(none)").slice(0, 40) });
  });
  pg.on("response", async (r) => {
    if (r.url().includes("/api/")) {
      const ct = r.headers()["content-type"] || "";
      trace.push({ dir: "<", s: r.status(), u: r.url().replace(URL, ""), ct: ct.slice(0, 24), body: ct.includes("json") ? (await r.text().catch(() => "")).slice(0, 90) : "(non-json)" });
    }
  });

  await pg.goto(URL, { waitUntil: "networkidle0" });
  for (let i = 0; i < 4; i++) { await pg.click("[data-testid=naz-logo]"); await W(150); }
  await W(400);
  await pg.type("input[type=password]", "9770327");
  await pg.click("[data-testid=admin-login-submit]"); await W(2000);

  console.log("=== A) NORMAL SAVE (fresh login) ===");
  trace.length = 0;
  await pg.click("[data-testid=admin-tab-customization]"); await W(600);
  await pg.click("[data-testid=preset-blue]"); await W(250);
  await pg.click("[data-testid=customization-save]"); await W(2500);
  trace.forEach((t) => console.log(" ", JSON.stringify(t)));
  console.log("  overlay shown:", !!(await pg.$("[data-testid=admin-reauth-note]")));
  console.log("  error text:", await pg.$eval("[data-testid=customization-error]", (e) => e.textContent).catch(() => "(none)"));

  // B) localStorage unavailable / cleared by the browser (Safari ITP, private mode, storage cleanup)
  console.log("\n=== B) STORAGE CLEARED WHILE UI STILL 'LOGGED IN' ===");
  console.log("  token present before:", await pg.evaluate(() => !!localStorage.getItem("nazmovies_admin_token")));
  await pg.evaluate(() => localStorage.removeItem("nazmovies_admin_token"));
  trace.length = 0;
  await pg.click("[data-testid=preset-purple]"); await W(250);
  await pg.click("[data-testid=customization-save]"); await W(2500);
  trace.forEach((t) => console.log(" ", JSON.stringify(t)));
  console.log("  UI thinks admin is logged in:", !!(await pg.$("[data-testid=customization-panel]")));
  console.log("  overlay shown:", !!(await pg.$("[data-testid=admin-reauth-note]")));

  // C) localStorage writes blocked at login time (private mode / quota)
  console.log("\n=== C) LOGIN WHEN localStorage WRITES ARE BLOCKED ===");
  const pg2 = await b.newPage();
  await pg2.evaluateOnNewDocument(() => {
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (String(k).includes("admin_token")) throw new DOMException("QuotaExceededError");
      return real.call(this, k, v);
    };
  });
  const t2 = [];
  pg2.on("response", async (r) => { if (r.url().includes("/api/settings") && r.request().method() === "PUT") t2.push(r.status()); });
  await pg2.goto(URL, { waitUntil: "networkidle0" });
  for (let i = 0; i < 4; i++) { await pg2.click("[data-testid=naz-logo]"); await W(150); }
  await W(400);
  await pg2.type("input[type=password]", "9770327");
  await pg2.click("[data-testid=admin-login-submit]"); await W(2000);
  const dash = !!(await pg2.$("[data-testid=admin-tab-customization]"));
  console.log("  login appeared to succeed / dashboard open:", dash);
  if (dash) {
    await pg2.click("[data-testid=admin-tab-customization]"); await W(600);
    await pg2.click("[data-testid=preset-dark-red]"); await W(250);
    await pg2.click("[data-testid=customization-save]"); await W(2500);
    console.log("  save status:", t2.join(","), "| overlay:", !!(await pg2.$("[data-testid=admin-reauth-note]")));
    console.log("  → re-login would hit the SAME failure again (infinite loop):", !!(await pg2.$("[data-testid=admin-reauth-note]")));
  }

  // D) proxy/CDN returning a non-JSON 401/403 for the refresh call
  console.log("\n=== D) REFRESH BLOCKED BY PROXY (non-JSON 401) ===");
  const pg3 = await b.newPage();
  await pg3.goto(URL, { waitUntil: "networkidle0" });
  for (let i = 0; i < 4; i++) { await pg3.click("[data-testid=naz-logo]"); await W(150); }
  await W(400);
  await pg3.type("input[type=password]", "9770327");
  await pg3.click("[data-testid=admin-login-submit]"); await W(2000);
  await pg3.setRequestInterception(true);
  pg3.on("request", (r) => {
    const isRefresh = r.url().includes("/api/admin/auth") && r.method() === "POST" && (r.postData() || "").includes("refresh");
    if (isRefresh) return r.respond({ status: 401, contentType: "text/html", body: "<html>proxy auth required</html>" });
    r.continue();
  });
  // force the client to consider the session "old" so it tries to refresh
  await pg3.evaluate(() => {
    const t = localStorage.getItem("nazmovies_admin_token");
    const exp = Number(t.split(".")[0]) - 60 * 60 * 1000; // pretend it was issued an hour ago
    localStorage.setItem("nazmovies_admin_token", exp + "." + t.split(".")[1]);
  });
  await pg3.click("[data-testid=admin-tab-customization]"); await W(600);
  await pg3.click("[data-testid=preset-black-gold]"); await W(250);
  await pg3.click("[data-testid=customization-save]"); await W(2500);
  console.log("  overlay after proxy-blocked refresh:", !!(await pg3.$("[data-testid=admin-reauth-note]")));

  await b.close();
})();
