// Measures hero + detail-view layout on real mobile viewports (before/after comparison)
const p = require("/tmp/pt/node_modules/puppeteer");
const W = (ms) => new Promise((r) => setTimeout(r, ms));
const URL = process.env.URL || "http://127.0.0.1:3000";

const DEVICES = [
  ["iPhone SE (375x667)", { width: 375, height: 667, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
  ["iPhone 13 (390x844)", { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }],
  ["Pixel 5 (393x851)", { width: 393, height: 851, isMobile: true, hasTouch: true, deviceScaleFactor: 2.75 }],
  ["iPad (820x1180)", { width: 820, height: 1180, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
  ["Desktop (1440x900)", { width: 1440, height: 900, isMobile: false, hasTouch: false, deviceScaleFactor: 1 }],
];

(async () => {
  const b = await p.launch({ args: ["--no-sandbox"] });

  for (const [name, vp] of DEVICES) {
    const pg = await b.newPage();
    await pg.setViewport(vp);
    await pg.goto(URL, { waitUntil: "networkidle0" });
    await W(1200);

    const hero = await pg.evaluate(() => {
      const sec = document.querySelector("section.relative.w-full");
      const heroSection = [...document.querySelectorAll("section")].find((s) => s.textContent.includes("مرحبًا بك في") || s.textContent.includes("Welcome to"));
      const h = heroSection?.getBoundingClientRect();
      // first content row after the hero (categories / shelves)
      const firstShelf = [...document.querySelectorAll("h2")].find((el) => el.getBoundingClientRect().top > (h?.bottom || 0) - 50);
      const cta = [...document.querySelectorAll("button")].find((x) => x.textContent.includes("ابدأ المشاهدة") || x.textContent.includes("Watch Now"));
      return {
        vh: window.innerHeight,
        heroTop: h ? Math.round(h.top) : null,
        heroHeight: h ? Math.round(h.height) : null,
        heroVhPct: h ? Math.round((h.height / window.innerHeight) * 100) : null,
        ctaBottom: cta ? Math.round(cta.getBoundingClientRect().bottom) : null,
        firstShelfTop: firstShelf ? Math.round(firstShelf.getBoundingClientRect().top) : null,
        firstShelfText: firstShelf ? firstShelf.textContent.trim().slice(0, 24) : null,
        shelfVisibleWithoutScroll: firstShelf ? firstShelf.getBoundingClientRect().top < window.innerHeight : null,
      };
    });
    console.log(`\n${name}`);
    console.log("  HERO:", JSON.stringify(hero));

    // Movie detail view
    await pg.evaluate(() => {
      const card = document.querySelector("div.group.cursor-pointer");
      card?.click();
    });
    await W(1500);
    const detail = await pg.evaluate(() => {
      const backdrop = document.querySelector("section img")?.getBoundingClientRect();
      const h1 = document.querySelector("h1")?.getBoundingClientRect();
      const watchBtn = [...document.querySelectorAll("button")].find((x) => x.textContent.includes("مشاهدة الآن") || x.textContent.includes("Watch Now"));
      const poster = [...document.querySelectorAll("img")].find((i) => i.className.includes("object-cover") && i.getBoundingClientRect().height > 150);
      return {
        vh: window.innerHeight,
        backdropHeight: backdrop ? Math.round(backdrop.height) : null,
        titleTop: h1 ? Math.round(h1.getBoundingClientRect?.().top ?? h1.top) : null,
        titleVisible: h1 ? h1.top < window.innerHeight && h1.top > 0 : null,
        ctaTop: watchBtn ? Math.round(watchBtn.getBoundingClientRect().top) : null,
        ctaVisible: watchBtn ? watchBtn.getBoundingClientRect().top < window.innerHeight : null,
        posterHeight: poster ? Math.round(poster.getBoundingClientRect().height) : null,
      };
    });
    console.log("  DETAIL:", JSON.stringify(detail));
    await pg.close();
  }
  await b.close();
})();
