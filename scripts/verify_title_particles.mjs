// Hero title as particles — browser check.
//
// Owner request: animate the bold hero title like "Text Particles with
// ThreeJS". The effect (src/lib/titleParticles.ts) draws dots on a canvas
// over the hero while the real <h1> stays in the page. This verifier loads
// the built site in a headless browser (WebGL through SwiftShader works) and
// checks what unit tests cannot see:
//
//   1. three.js is fetched only after the page has loaded, never with it;
//   2. the title switches to dots, the <h1> keeps its text and name;
//   3. the dots lie on the letters — also after resizes, after the hero has
//      been scrolled inside itself, and with the page scrolled (compares
//      screenshots of "letters only" and "dots only");
//   4. nothing is drawn while the title is at rest; the cursor wakes it and
//      it goes back to sleep;
//   5. the canvas never takes a click meant for a hero button;
//   6. a lost WebGL context brings the real title back, a restored one the
//      dots; leaving the home page and coming back works;
//   7. with "reduce motion" the effect is not even downloaded;
//   8. no page errors and no three.js / WebGL warnings.
//
//   node scripts/verify_title_particles.mjs
//   TITLE_DIST=public        serve another folder (default ../dist)
//   TITLE_SHOTS=/dir         also save screenshots (dark, light, hover, hold)
//   TITLE_FONT=/x/syne.woff2 answer the Google Fonts request with this file
//                            (offline the title falls back to a system font;
//                            every check still holds)
//   PW_CHROMIUM=/path        use this Chromium binary (with playwright-core)
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = await import('playwright').catch(() => import('playwright-core'));

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(process.env.TITLE_DIST || join(HERE, '..', 'dist'));
const SHOTS = process.env.TITLE_SHOTS ? resolve(process.env.TITLE_SHOTS) : null;
const FONT = process.env.TITLE_FONT ? resolve(process.env.TITLE_FONT) : null;
const PORT = 8960;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
};

const server = createServer(async (req, res) => {
  let path = decodeURIComponent((req.url || '/').split('?')[0]);
  if (path.endsWith('/')) path += 'index.html';
  const file = path === '/__title-font.woff2' && FONT ? FONT : join(DIST, normalize(path));
  if (file !== FONT && !file.startsWith(DIST)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((done) => server.listen(PORT, '127.0.0.1', done));

let passed = 0;
let failed = 0;
const check = (ok, label, detail = '') => {
  if (ok) passed++; else failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail !== '' ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || undefined,
  args: ['--no-sandbox', '--disable-gpu', '--single-process', '--no-zygote'],
});

/** A page on the built site with outside requests cut off and errors collected. */
async function open(contextOptions) {
  // serviceWorkers 'block': the sandboxed single-process Chromium dies when a
  // second context registers the site's service worker.
  const context = await browser.newContext({ serviceWorkers: 'block', ...contextOptions });
  await context.addInitScript(() => {
    window.__draws = 0;
    window.__dots = 0;
    for (const proto of [window.WebGL2RenderingContext?.prototype, window.WebGLRenderingContext?.prototype]) {
      if (!proto) continue;
      const draw = proto.drawArrays;
      proto.drawArrays = function (...args) { window.__draws++; window.__dots = args[2]; return draw.apply(this, args); };
    }
  });
  const page = await context.newPage();
  const problems = [];
  const fetched = [];
  let loaded = false;
  page.on('pageerror', (e) => problems.push(String(e)));
  page.on('console', (m) => {
    const text = m.text();
    if (m.type() === 'error' && !/handshake|SecurityError|ERR_FAILED|Failed to load resource/.test(text)) problems.push(text);
    // "GPU stall due to ReadPixels" is the screenshot reading the software GL canvas.
    if (m.type() === 'warning' && /THREE|WebGL/.test(text) && !/ReadPixels/.test(text)) problems.push(`warning: ${text}`);
  });
  page.on('request', (r) => {
    if (/three\.module|titleParticles/.test(r.url())) fetched.push(loaded ? 'after load' : 'BEFORE load');
  });
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(ORIGIN)) return route.continue();
    if (FONT && /fonts\.googleapis\.com/.test(url)) {
      return route.fulfill({
        contentType: 'text/css',
        body: `@font-face{font-family:'Syne';font-weight:700 800;font-display:swap;src:url(${ORIGIN}/__title-font.woff2) format('woff2')}`,
      });
    }
    return route.abort();
  });
  await page.goto(`${ORIGIN}/`, { waitUntil: 'load' });
  loaded = true;
  return { context, page, problems, fetched };
}

const draws = (page) => page.evaluate(() => window.__draws);
const drawsDuring = async (page, ms) => {
  const before = await draws(page);
  await page.waitForTimeout(ms);
  return (await draws(page)) - before;
};
const shot = async (page, name) => {
  if (SHOTS) await page.screenshot({ path: join(SHOTS, `title-${name}.png`), animations: 'disabled' });
};

// ── a scratch page that compares two screenshots ─────────────────────────
const scratchContext = await browser.newContext({ serviceWorkers: 'block' });
const scratch = await scratchContext.newPage();
await scratch.setContent('<canvas id="c"></canvas>');
/** Bounding box of the pixels that differ between two PNG buffers. */
const differingBox = (a, b) => scratch.evaluate(async ([A, B]) => {
  const load = (s) => new Promise((done) => { const i = new Image(); i.onload = () => done(i); i.src = `data:image/png;base64,${s}`; });
  const [ia, ib] = await Promise.all([load(A), load(B)]);
  const c = document.getElementById('c');
  c.width = ia.width;
  c.height = ia.height;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(ia, 0, 0);
  const da = g.getImageData(0, 0, c.width, c.height).data;
  g.drawImage(ib, 0, 0);
  const db = g.getImageData(0, 0, c.width, c.height).data;
  let left = Infinity, top = Infinity, right = -1, bottom = -1, n = 0;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const i = (y * c.width + x) * 4;
      if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 90) {
        n++;
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  return { left, top, right, bottom, n };
}, [a.toString('base64'), b.toString('base64')]);

/**
 * Do the dots lie on the letters? Three screenshots of the title's own
 * rectangle — nothing, letters only, dots only — and the two boxes of
 * changed pixels must agree.
 */
async function dotsOnLetters(page, label) {
  const style = (css) => page.evaluate((text) => {
    let el = document.getElementById('__title-check');
    if (!el) { el = document.createElement('style'); el.id = '__title-check'; document.head.appendChild(el); }
    el.textContent = text;
  }, css);
  const box = await page.locator('h1.cmc-title').boundingBox();
  const view = page.viewportSize();
  const clip = {
    x: Math.max(0, box.x - 4), y: Math.max(0, box.y - 4),
    width: Math.min(view.width - Math.max(0, box.x - 4), box.width + 8),
    height: Math.min(view.height - Math.max(0, box.y - 4), box.height + 8),
  };
  // No shadow: the light theme's soft shadow would count as part of the letters.
  const base = '*{transition:none !important} .cmc-title-outline{visibility:hidden !important} .cmc-title-solid{text-shadow:none !important} ';
  const take = async (css) => { await style(base + css); await page.waitForTimeout(250); return page.screenshot({ animations: 'disabled', clip }); };
  const nothing = await take('.cmc-title-canvas{visibility:hidden !important} .cmc-title-solid{opacity:0 !important}');
  const letters = await take('.cmc-title-canvas{visibility:hidden !important} .cmc-title-solid{opacity:1 !important}');
  const dots = await take('.cmc-title-solid{opacity:0 !important}');
  await style('');
  const l = await differingBox(nothing, letters);
  const d = await differingBox(nothing, dots);
  const off = Math.max(Math.abs(l.left - d.left), Math.abs(l.top - d.top), Math.abs(l.right - d.right), Math.abs(l.bottom - d.bottom));
  check(d.n > 500 && l.n > 500 && off <= 3, `${label}: the dots lie on the letters`,
    `letters ${[l.left, l.top, l.right, l.bottom]} · dots ${[d.left, d.top, d.right, d.bottom]} · off by ${off}px`);
}

// ── 1. desktop ───────────────────────────────────────────────────────────
{
  const { page, problems, fetched } = await open({ viewport: { width: 1366, height: 860 } });
  const head = (await page.content()).split('</head>')[0];
  check(!/three\.module|titleParticles/.test(head), 'three.js is not referenced in <head> (no preload)');
  const on = await page.waitForSelector('.cmc-title-as-particles', { timeout: 20000 }).then(() => true, () => false);
  check(on, 'the title switches to particles');
  check(fetched.length >= 2 && fetched.every((f) => f === 'after load'), 'three.js is fetched only after the page has loaded', fetched.join(', '));
  check(await page.evaluate(() => document.querySelector('h1.cmc-title').getAttribute('aria-label')) === 'Everything a teacher needs in one place.',
    'the <h1> keeps its accessible name');
  check(await page.evaluate(() => document.querySelector('h1.cmc-title').innerText.replace(/\s+/g, ' ').includes('NEEDS IN ONE PLACE.')),
    'the <h1> keeps its text');
  check(await page.evaluate(() => document.querySelector('.cmc-title-canvas').getAttribute('aria-hidden')) === 'true', 'the canvas is hidden from screen readers');

  await page.waitForTimeout(5000); // the dots fly in and land
  const dots = await page.evaluate(() => window.__dots);
  check(dots > 3000 && dots <= 22000, 'the number of dots is within the budget', String(dots));
  check((await drawsDuring(page, 1500)) === 0, 'nothing is drawn while the title is at rest');
  await shot(page, 'dark');
  await dotsOnLetters(page, '1366 wide');

  const title = await page.locator('h1.cmc-title').boundingBox();
  const before = await draws(page);
  await page.mouse.move(title.x + title.width * 0.4, title.y + title.height * 0.5, { steps: 6 });
  await page.waitForTimeout(900);
  check((await draws(page)) > before, 'the cursor on the title wakes the dots');
  await shot(page, 'hover');
  await page.mouse.down();
  await page.waitForTimeout(1800);
  await shot(page, 'hold');
  await page.mouse.up();
  await page.mouse.move(1300, 840, { steps: 3 });
  await page.waitForTimeout(6000);
  check((await drawsDuring(page, 1200)) === 0, 'asleep again after the cursor has left');
  await dotsOnLetters(page, 'after hover and hold');

  // A button near the lower edge of the hero, brought into view the way
  // keyboard focus does it — this also scrolls the hero inside itself.
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    const b = [...document.querySelectorAll('#top a, #top button')].find((e) => /Explore teacher tools/.test(e.textContent));
    b.scrollIntoView({ block: 'center', behavior: 'instant' });
  });
  await page.waitForTimeout(400);
  const hit = await page.evaluate(() => {
    const b = [...document.querySelectorAll('#top a, #top button')].find((e) => /Explore teacher tools/.test(e.textContent));
    const r = b.getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { ok: Boolean(el) && (el === b || b.contains(el)), el: el ? `${el.tagName}.${String(el.className).slice(0, 40)}` : 'nothing' };
  });
  check(hit.ok, 'a hero button under the canvas still takes the click', hit.el);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await dotsOnLetters(page, 'hero scrolled inside itself');

  await page.evaluate(() => document.documentElement.classList.add('light'));
  await page.waitForTimeout(700);
  await shot(page, 'light');
  await dotsOnLetters(page, 'light theme');
  await page.evaluate(() => document.documentElement.classList.remove('light'));

  for (const [w, h] of [[900, 800], [420, 800], [1600, 900]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(1500);
    const sizes = await page.evaluate(() => {
      const c = document.querySelector('.cmc-title-canvas');
      return { buffer: [c.width, c.height], hero: [c.parentElement.clientWidth, c.parentElement.clientHeight], ratio: Math.min(window.devicePixelRatio || 1, 2) };
    });
    check(sizes.buffer[0] === Math.floor(sizes.hero[0] * sizes.ratio) && sizes.buffer[1] === Math.floor(sizes.hero[1] * sizes.ratio),
      `resized to ${w}: the drawing buffer follows`, JSON.stringify(sizes));
    await dotsOnLetters(page, `resized to ${w}`);
  }
  // 90px, not more: on the glass board the title sits higher, and a longer
  // scroll slides it under the frosted menu bar, which hides part of it
  await page.evaluate(() => window.scrollTo(0, 90));
  await page.waitForTimeout(600);
  await dotsOnLetters(page, 'page scrolled');
  await page.evaluate(() => window.scrollTo(0, 0));

  await page.evaluate(() => {
    const c = document.querySelector('.cmc-title-canvas');
    window.__lose = (c.getContext('webgl2') || c.getContext('webgl')).getExtension('WEBGL_lose_context');
    window.__lose.loseContext();
  });
  await page.waitForTimeout(600);
  check(await page.evaluate(() => !document.querySelector('.cmc-title-as-particles')), 'WebGL context lost → the real title is shown again');
  await page.evaluate(() => window.__lose.restoreContext());
  await page.waitForTimeout(2000);
  check(await page.evaluate(() => Boolean(document.querySelector('.cmc-title-as-particles'))), 'context restored → the dots are back');
  await dotsOnLetters(page, 'after the context came back');

  await page.evaluate(() => { location.hash = '#brain-lounge'; });
  await page.waitForTimeout(2000);
  const left = await page.evaluate(() => !document.querySelector('.cmc-title-canvas'));
  await page.evaluate(() => { location.hash = ''; });
  const back = await page.waitForSelector('.cmc-title-as-particles', { timeout: 20000 }).then(() => true, () => false);
  check(left && back, 'leaving the home page removes the effect, coming back starts it again', `left: ${left}, back: ${back}`);

  check(problems.length === 0, 'desktop: no page errors, no three.js or WebGL warnings', problems.join(' | ').slice(0, 400));
}

// ── 2. phone (touch, 2× screen) ──────────────────────────────────────────
{
  const { page, problems } = await open({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const on = await page.waitForSelector('.cmc-title-as-particles', { timeout: 20000 }).then(() => true, () => false);
  check(on, 'phone: the title switches to particles');
  await page.waitForTimeout(5000);
  const dots = await page.evaluate(() => window.__dots);
  check(dots > 1500 && dots <= 9000, 'phone: the number of dots is within the phone budget', String(dots));
  await shot(page, 'phone');
  await dotsOnLetters(page, 'phone');
  const title = await page.locator('h1.cmc-title').boundingBox();
  const before = await draws(page);
  await page.touchscreen.tap(title.x + title.width * 0.4, title.y + title.height * 0.5);
  await page.waitForTimeout(600);
  check((await draws(page)) > before, 'phone: a tap on the title stirs the dots');
  await page.waitForTimeout(6000);
  check((await drawsDuring(page, 1200)) === 0, 'phone: asleep again after the tap');
  check(problems.length === 0, 'phone: no page errors, no three.js or WebGL warnings', problems.join(' | ').slice(0, 400));
}

// ── 3. "reduce motion": the plain title, and nothing downloaded ──────────
{
  const { page, problems, fetched } = await open({ viewport: { width: 1366, height: 860 }, reducedMotion: 'reduce' });
  await page.waitForTimeout(5000);
  check(await page.evaluate(() => !document.querySelector('.cmc-title-as-particles')), 'reduce motion: the plain title stays');
  check(fetched.length === 0, 'reduce motion: three.js is not downloaded', fetched.join(', '));
  check(await page.evaluate(() => getComputedStyle(document.querySelector('.cmc-title-solid')).opacity) === '1', 'reduce motion: the letters are visible');
  check(problems.length === 0, 'reduce motion: no page errors', problems.join(' | ').slice(0, 400));
}

console.log(`\n${passed} passed, ${failed} failed`);
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
