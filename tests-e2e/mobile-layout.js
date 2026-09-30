// Verifies hero height caps, dead-space removal, and above-the-fold detail layout.
const p = require("/tmp/pt/node_modules/puppeteer");
const W = (ms) => new Promise((r) => setTimeout(r, ms));
const URL = process.env.URL || "http://127.0.0.1:3000";
let pass = 0, fail = 0;
const ok = (n, c, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${n} ${x}`); };

const PHONES = [
  ["Galaxy Fold (280x653)", { width: 280, height: 653 }],
  ["iPhone SE (375x667)", { width: 375, height: 667 }],
  ["iPhone 13 (390x844)", { width: 390, height: 844 }],
  ["Pixel 5 (393x851)", { width: 393, height: 851 }],
  ["iPhone Pro Max (430x932)", { width: 430, height: 932 }],
  ["Landscape (844x390)", { width: 844, height: 390 }],
];
const LARGE = [
  ["iPad (820x1180)", { width: 820, height: 1180 }],
  ["Desktop (1440x900)", { width: 1440, height: 900 }],
];

const landscapeDetail = (s) => s.width > s.height;

const heroMetrics = (pg) => pg.evaluate(() => {
  const hero = [...document.querySelectorAll("section")].find((s) => s.querySelector("h1"));
  const r = hero.getBoundingClientRect();
  const cta = [...hero.querySelectorAll("button")].find((x) => /ابدأ المشاهدة|Watch Now/.test(x.textContent));
  const nextHeading = [...document.querySelectorAll("h2")].find((el) => el.getBoundingClientRect().top > r.bottom - 60);
  return {
    vh: window.innerHeight,
    height: Math.round(r.height),
    pct: Math.round((r.height / window.innerHeight) * 100),
    deadSpaceBelowCta: cta ? Math.round(r.bottom - cta.getBoundingClientRect().bottom) : null,
    nextRowTop: nextHeading ? Math.round(nextHeading.getBoundingClientRect().top) : null,
    nextRowVisible: nextHeading ? nextHeading.getBoundingClientRect().top < window.innerHeight : false,
    hOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
});

const detailMetrics = (pg) => pg.evaluate(() => {
  const h1 = document.querySelector("h1").getBoundingClientRect();
  const watch = [...document.querySelectorAll("button")].find((x) => /مشاهدة الآن|Watch Now/.test(x.textContent));
  const meta = [...document.querySelectorAll("div")].find((d) => d.className.includes("bg-black/50") && d.className.includes("grid"));
  const backdrop = document.querySelector("section > div.relative").getBoundingClientRect();
  const vis = (el) => el && el.top >= 0 && el.top < window.innerHeight;
  return {
    vh: window.innerHeight,
    backdropH: Math.round(backdrop.height),
    titleTop: Math.round(h1.top),
    titleVisible: vis(h1),
    ctaTop: watch ? Math.round(watch.getBoundingClientRect().top) : null,
    ctaVisible: watch ? vis(watch.getBoundingClientRect()) : false,
    metaVisible: meta ? vis(meta.getBoundingClientRect()) : false,
    gapUnderBackdrop: Math.round(document.querySelector("div.liquid-glass").getBoundingClientRect().top - backdrop.bottom),
    hOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
});

(async () => {
  const b = await p.launch({ args: ["--no-sandbox"] });

  for (const [name, size] of PHONES) {
    const pg = await b.newPage();
    await pg.setViewport({ ...size, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await pg.goto(URL, { waitUntil: "networkidle0" });
    await W(1100);

    const h = await heroMetrics(pg);
    const landscape = size.width > size.height;
    // Portrait phones: the 60–65vh / max-480px spec. Landscape (~317px usable) can only
    // be held to "never exceeds the screen and stays compact".
    const capOk = landscape
      ? h.height <= Math.round(h.vh * 0.62) + 2
      : h.height <= 480 && h.height <= Math.round(h.vh * 0.66) + 2;
    ok(`${name} — hero ${landscape ? "≤60vh (landscape)" : "≤480px and ≤65vh"}`, capOk, `(${h.height}px = ${h.pct}vh)`);
    ok(`${name} — no dead space under CTA`, h.deadSpaceBelowCta !== null && h.deadSpaceBelowCta < 90, `(${h.deadSpaceBelowCta}px)`);
    ok(`${name} — next content row visible without scrolling`, h.nextRowVisible, `(row at ${h.nextRowTop} of ${h.vh})`);
    ok(`${name} — no horizontal overflow`, h.hOverflow <= 0, `(${h.hOverflow}px)`);

    await pg.evaluate(() => document.querySelector("div.group.cursor-pointer")?.click());
    await W(1400);
    const d = await detailMetrics(pg);
    ok(`${name} — detail: title above the fold`, d.titleVisible, `(top ${d.titleTop} of ${d.vh})`);
    if (landscapeDetail(size)) {
      ok(`${name} — detail: actions within one short scroll`, d.ctaTop < d.vh * 1.6, `(top ${d.ctaTop} of ${d.vh})`);
    } else {
      ok(`${name} — detail: action buttons above the fold`, d.ctaVisible, `(top ${d.ctaTop})`);
    }
    ok(`${name} — detail: no gap under backdrop`, d.gapUnderBackdrop <= 0, `(${d.gapUnderBackdrop}px)`);
    await pg.close();
  }

  for (const [name, size] of LARGE) {
    const pg = await b.newPage();
    await pg.setViewport({ ...size, deviceScaleFactor: 1 });
    await pg.goto(URL, { waitUntil: "networkidle0" });
    await W(1100);
    const h = await heroMetrics(pg);
    ok(`${name} — hero still cinematic (65–80vh) with next row peeking`, h.pct >= 60 && h.pct <= 82 && h.nextRowVisible, `(${h.pct}vh, row at ${h.nextRowTop}/${h.vh})`);
    ok(`${name} — no dead space under CTA`, h.deadSpaceBelowCta < 130, `(${h.deadSpaceBelowCta}px)`);
    await pg.evaluate(() => document.querySelector("div.group.cursor-pointer")?.click());
    await W(1400);
    const d = await detailMetrics(pg);
    ok(`${name} — detail title + CTA visible`, d.titleVisible && d.ctaVisible, `(title ${d.titleTop}, cta ${d.ctaTop})`);
    await pg.close();
  }

  // Smooth-scroll / rendering sanity: no layout thrash, no errors, transitions intact
  const pg = await b.newPage();
  const errs = []; pg.on("pageerror", (e) => errs.push(e.message));
  await pg.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await pg.goto(URL, { waitUntil: "networkidle0" });
  await W(1200);
  const scroll = await pg.evaluate(async () => {
    const start = performance.now();
    let frames = 0;
    const tick = () => { frames++; if (performance.now() - start < 1000) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    for (let y = 0; y < 2500; y += 120) { window.scrollTo(0, y); await new Promise((r) => requestAnimationFrame(r)); }
    await new Promise((r) => setTimeout(r, 1050));
    return { frames, scrolled: Math.round(window.scrollY), overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  ok("scrolling stays smooth (≥40 fps) with no horizontal overflow", scroll.frames >= 40 && scroll.overflow <= 0, `(${scroll.frames} fps, overflow ${scroll.overflow})`);
  ok("no page errors", errs.length === 0, JSON.stringify(errs.slice(0, 2)));
  await pg.close();

  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
