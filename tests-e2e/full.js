// Manual E2E verification script (run from /tmp/pt where puppeteer is installed)
const p = require("/tmp/pt/node_modules/puppeteer");
const W = (ms) => new Promise((r) => setTimeout(r, ms));
const URL = "http://127.0.0.1:3000";
const LOGO = "[data-testid=naz-logo]";
const has = async (pg, s) => (await pg.content()).includes(s);
const clickText = (pg, sel, txt) =>
  pg.evaluate(
    (sel, txt) => {
      const el = [...document.querySelectorAll(sel)].find((b) => b.textContent.trim().includes(txt));
      if (el) el.click();
      return !!el;
    },
    sel,
    txt
  );

(async () => {
  const b = await p.launch({ args: ["--no-sandbox"] });
  const pg = await b.newPage();
  const errs = [];
  pg.on("pageerror", (e) => errs.push(e.message));
  await pg.goto(URL, { waitUntil: "networkidle0" });

  // Admin auth is DISABLED — tests A/B/E/F (password flow) no longer apply.
  // Verify instead that the dashboard opens directly with no prompt.
  await pg.click("[data-testid=admin-open-btn]"); await W(1500);
  console.log("ADMIN  dashboard opens with no password:", await has(pg, "ROOT ACCESS"));
  console.log("ADMIN  no password field present:", !(await pg.$("input[type=password]")));
  await pg.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.includes("إغلاق اللوحة"))?.click());
  await W(600);

  // TEST C — registration
  const email = `u${Date.now()}@naz.com`;
  await clickText(pg, "header button", "تسجيل الدخول"); await W(400);
  await clickText(pg, "button", "إنشاء حساب"); await W(300);
  const inputs = await pg.$$("form input[type=text]");
  await inputs[0].type("Test User");
  await inputs[1].type("testuser");
  await pg.type("input[type=email]", email);
  await pg.type("input[type=password]", "pass1234");
  await pg.click("form button[type=submit]"); await W(1800);
  const ls = await pg.evaluate(() => localStorage.getItem("nazmovies_user"));
  console.log("C  registered & authenticated:", !!ls && ls.includes(email), "| no verification page:", !(await has(pg, "verify your")));

  // TEST D — login
  await pg.evaluate(() => localStorage.removeItem("nazmovies_user"));
  await pg.reload({ waitUntil: "networkidle0" });
  await clickText(pg, "header button", "تسجيل الدخول"); await W(400);
  await pg.type("input[type=email]", email);
  await pg.type("input[type=password]", "pass1234");
  await pg.click("form button[type=submit]"); await W(1800);
  console.log("D  login complete (name in header):", await has(pg, "Test User"));
  await pg.reload({ waitUntil: "networkidle0" }); await W(1000);
  console.log("D  user session persists after refresh:", await has(pg, "Test User"));

  // MOBILE — touch taps
  const m = await b.newPage();
  await m.emulate(p.KnownDevices["iPhone 13"]);
  await m.goto(URL, { waitUntil: "networkidle0" });
  await m.tap("[data-testid=admin-open-btn]"); await W(1200);
  console.log("M  mobile: dashboard opens directly, no password:", (await m.content()).includes("ROOT ACCESS"));

  console.log("page errors:", errs);
  await b.close();
})();
