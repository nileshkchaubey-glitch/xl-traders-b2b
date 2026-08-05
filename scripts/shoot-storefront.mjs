/**
 * Capture the storefront redesign screenshots for the PR.
 *
 *   node scripts/shoot-storefront.mjs
 *
 * Requires the dev server on :5000 (npm run dev) and Chrome installed.
 * Set TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD in the environment (or
 * .env.local) to also capture the SIGNED-IN variants; without them only the
 * signed-out set is produced and the script says so.
 *
 * The `watermark` shot deliberately breaks every product image source so
 * ProductImageSlot's real onError fallthrough fires — that is the state most
 * of the catalogue lands in, and the one that decides whether the design works.
 */
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE_URL ?? "http://localhost:5000";
const OUT = "docs/screenshots";
const VIEWPORTS = {
  390: { width: 390, height: 844 },
  1440: { width: 1440, height: 1000 },
};

const CHROME = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
].find(p => fs.existsSync(p));
if (!CHROME) {
  console.error("No Chrome binary found.");
  process.exit(1);
}

// .env.local is gitignored and holds TEST_ADMIN_PASSWORD (docs/TEST_ADMIN.md).
for (const f of [".env.local", ".env"]) {
  if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]])
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const EMAIL = process.env.TEST_ADMIN_EMAIL ?? "dev-admin@xltraders.local";
const PASSWORD = process.env.TEST_ADMIN_PASSWORD;

const PAGES = [
  ["home", "/"],
  ["catalog", "/catalog"],
  ["account", "/account"],
];

fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

/**
 * The Daily Improvement widget renders under `import.meta.env.DEV` only, so it
 * never ships — but these shots are taken against the dev server, where it
 * would sit in the middle of every Home capture. Hide it so the screenshots
 * show what production shows.
 */
async function hideDevOnlyChrome(page) {
  // Matched on the explicit [data-dev-only] marker, NOT on text content — a
  // textContent search returns the outermost matching ancestor first, which
  // hides the whole page.
  await page.evaluate(() => {
    document
      .querySelectorAll("[data-dev-only]")
      .forEach(el => (el.style.display = "none"));
  });
}

/**
 * A full-page screenshot composites the viewport-fixed bottom nav and cart bar
 * wherever the scroll happened to be, so they appear stranded in the middle of
 * the image. Hide them for full-page shots; the 390 viewport shot below is
 * where that chrome is actually documented.
 */
async function setFixedChrome(page, visible) {
  await page.evaluate(v => {
    document
      .querySelectorAll("nav.fixed, .fixed.inset-x-0")
      .forEach(el => (el.style.visibility = v ? "" : "hidden"));
  }, visible);
}

async function shoot(page, name, width, { fullPage = true } = {}) {
  await hideDevOnlyChrome(page);
  await setFixedChrome(page, !fullPage);
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage });
  await setFixedChrome(page, true);
  console.log(`  ${file}  (${width}px)`);
}

/** Resolve the first published product's URL so the PDP shot is real. */
async function firstProductHref(page) {
  await page.goto(`${BASE}/catalog`, { waitUntil: "networkidle2" });
  await sleep(2500);
  return page.evaluate(() => {
    const a = document.querySelector('main a[href^="/product/"]');
    return a ? a.getAttribute("href") : null;
  });
}

async function capture(page, label) {
  const pdp = await firstProductHref(page);
  const routes = pdp ? [...PAGES, ["pdp", pdp]] : PAGES;
  if (!pdp) console.warn("  ! no product link found — skipping PDP shot");

  for (const [width, vp] of Object.entries(VIEWPORTS)) {
    await page.setViewport({ ...vp, deviceScaleFactor: 2 });
    for (const [name, route] of routes) {
      await page.goto(`${BASE}${route}`, { waitUntil: "networkidle2" });
      await sleep(2600);
      await shoot(page, `rc-${name}-${label}-${width}`, width);
    }
  }

  // One viewport-height shot at 390 that DOES include the bottom nav and the
  // cart bar, since those are the mobile chrome and the full-page shots hide
  // them. Adds a line to the cart first so the cart bar is actually present.
  await page.setViewport({ ...VIEWPORTS[390], deviceScaleFactor: 2 });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
  await sleep(2600);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("main button")].find(
      b => b.textContent?.trim() === "Add"
    );
    btn?.click();
  });
  await sleep(1200);
  await shoot(page, `rc-mobilechrome-${label}-390`, 390, { fullPage: false });
}

async function captureWatermark(page) {
  // The decisive view: twelve cards, all on tier 3, at 390.
  await page.setViewport({ ...VIEWPORTS[390], deviceScaleFactor: 2 });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
  await sleep(2600);
  await page.evaluate(async () => {
    for (let n = 0; n < 6; n++) {
      document.querySelectorAll("main img").forEach(i => {
        if (!i.src.includes("xl-monogram")) i.src = "/__forced_fallback__.png";
      });
      await new Promise(r => setTimeout(r, 700));
    }
    document
      .evaluate("//h2[contains(., 'rate card')]", document, null, 9, null)
      .singleNodeValue?.scrollIntoView({ block: "start" });
    await new Promise(r => setTimeout(r, 400));
  });
  const counts = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll("main img")];
    return {
      watermarks: imgs.filter(i => i.src.includes("xl-monogram")).length,
      photos: imgs.filter(i => !i.src.includes("xl-monogram")).length,
    };
  });
  console.log(
    `  watermark state: ${counts.watermarks} tier-3, ${counts.photos} photo`
  );
  await shoot(page, "rc-watermark-12up-390", 390, { fullPage: false });
}

try {
  const page = await browser.newPage();

  // LABEL lets a caller drive the signed-in pass against a demo-mode server
  // with a temporary auth bypass (the approach CLAUDE.md records for the admin
  // screenshots) instead of real credentials. Default is the signed-out pass.
  const label = process.env.LABEL ?? "signedout";
  console.log(`${label}:`);
  await capture(page, label);
  if (label === "signedout") await captureWatermark(page);

  if (process.env.LABEL) {
    // Explicit label — the caller is orchestrating; don't also try to log in.
  } else if (!PASSWORD) {
    console.log(
      "\nTEST_ADMIN_PASSWORD not set — signed-in shots skipped.\n" +
        "Set it in .env.local (see docs/TEST_ADMIN.md) and re-run."
    );
  } else {
    console.log("\nSigning in…");
    await page.setViewport({ ...VIEWPORTS[1440], deviceScaleFactor: 1 });
    await page.goto(`${BASE}/auth`, { waitUntil: "networkidle2" });
    await sleep(1200);
    await page.type('input[type="email"]', EMAIL);
    await page.type('input[type="password"]', PASSWORD);
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {}),
    ]);
    await sleep(3000);
    const signedIn = await page.evaluate(
      () =>
        !/Sign in/i.test(
          document.querySelector("header")?.innerText ?? "Sign in"
        )
    );
    if (!signedIn) {
      console.error("  ! sign-in did not take — signed-in shots skipped.");
    } else {
      console.log("Signed in:");
      await capture(page, "signedin");
    }
  }
} finally {
  await browser.close();
}
