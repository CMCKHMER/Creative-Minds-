/**
 * Brain Lounge mobile/touch smoke test
 * =====================================
 * Device-emulated touch run against the LIVE (or preview) site:
 *   1. Lounge page  — renders, no horizontal overflow, coarse pointer
 *   2. BrickForge   — Play → canvas fits → touch drag paddle → tap launch →
 *                     pause/resume options respond to touch
 *   3. Arena Chess 3D — Pass & play → tap piece (selection highlight) →
 *                     tap target (move lands) → swipe orbits camera
 *   4. Galica       — popup tab → coarse-pointer touch pad visible →
 *                     FIRE advances TITLE→SELECT→PLAY → ship select via
 *                     touch buttons → shop touch nav (gap probe)
 *
 * Usage:
 *   node scripts/brain_lounge_mobile_smoke.mjs [url]
 *   TARGET_URL=https://… node scripts/brain_lounge_mobile_smoke.mjs
 * SHOT_DIR=/tmp/bl_mobile  (default), DEVICE=iphone|pixel|both (default iphone)
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.argv[2] || process.env.TARGET_URL || 'https://cmckhmer.github.io/Creative-Minds-/';
const SHOT_DIR = process.env.SHOT_DIR || '/tmp/bl_mobile';
const DEVICE = process.env.DEVICE || 'iphone';
fs.mkdirSync(SHOT_DIR, { recursive: true });

const DEVICES = {
  iphone: {
    name: 'iPhone SE (375×667 touch, dpr1 for SW-WebGL speed)',
    viewport: { width: 375, height: 667 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  },
  pixel: {
    name: 'Pixel 7 (412×915 touch, dpr1 for SW-WebGL speed)',
    viewport: { width: 412, height: 915 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  },
};

const results = [];
const record = (id, ok, note = '') => {
  results.push({ id, ok, note });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${note ? ' — ' + note : ''}`);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---- CDP touch helpers ---- */
async function cdpTouchTap(session, x, y) {
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
async function cdpTouchDrag(session, points) {
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [points[0]] });
  for (const p of points.slice(1)) {
    await sleep(16);
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [p] });
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
async function cdpTouchHold(session, x, y, ms, during) {
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  try { if (during) await during(); else await sleep(ms); }
  finally { await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
}

/* ---- screenshots + real pixel diff (decoded in-page) ---- */
async function shot(page, name) {
  const p = path.join(SHOT_DIR, name);
  await page.screenshot({ path: p, animations: 'disabled', timeout: 60000 });
  return p;
}
async function elShot(locator, name) {
  const p = path.join(SHOT_DIR, name);
  await locator.screenshot({ path: p, timeout: 60000 });
  return p;
}
/** Count differing pixels between two image files by decoding them in the page. */
async function pngDiff(page, fileA, fileB) {
  const b64 = (f) => fs.readFileSync(f).toString('base64');
  const mime = (f) => (f.endsWith('.png') ? 'image/png' : 'image/jpeg');
  return page.evaluate(async ({ a, b, ma, mb }) => {
    const load = (src, m) => new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = 'data:' + m + ';base64,' + src;
    });
    const [ia, ib] = await Promise.all([load(a, ma), load(b, mb)]);
    if (ia.width !== ib.width || ia.height !== ib.height) return -1;
    const cv = document.createElement('canvas');
    cv.width = ia.width; cv.height = ia.height;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    const draw = (img) => { cx.clearRect(0, 0, cv.width, cv.height); cx.drawImage(img, 0, 0); return cx.getImageData(0, 0, cv.width, cv.height).data; };
    const da = draw(ia), db = draw(ib);
    let d = 0;
    for (let i = 0; i < da.length; i += 64) { // sampled, rgba stride 16px
      if (Math.abs(da[i] - db[i]) > 12 || Math.abs(da[i + 1] - db[i + 1]) > 12 || Math.abs(da[i + 2] - db[i + 2]) > 12) d++;
    }
    return d;
  }, { a: b64(fileA), b: b64(fileB), ma: mime(fileA), mb: mime(fileB) });
}
/** Fast raw-surface screenshot via CDP — skips Playwright stability waits. */
async function cdpShot(session, name) {
  const { data } = await session.send('Page.captureScreenshot', { format: 'jpeg', quality: 55 });
  const p = path.join(SHOT_DIR, name);
  fs.writeFileSync(p, Buffer.from(data, 'base64'));
  return p;
}

/* ---- chess board projection (replicates CameraRig) ---- */
function sqPos(sq) { return [sq.charCodeAt(0) - 97 - 3.5, 4.5 - Number(sq[1])]; }
function projectSquare(sq, viewport, side = 'w') {
  const [x, z] = sqPos(sq);
  const w = viewport.width, h = viewport.height;
  const aspect = w / h;
  const dist = Math.min(30, 14.2 * Math.max(1, 1.5 / aspect));
  const sign = side === 'w' ? 1 : -1;
  const eye = [0, dist * 0.8, sign * dist * 0.6];
  const target = [0, 0.3, 0];
  const up = [0, 1, 0];
  const norm = (v) => { const l = Math.hypot(...v); return v.map((c) => c / l); };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const fwd = norm([target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]]);
  const right = norm(cross(fwd, up));
  const up2 = cross(right, fwd);
  const v = [x - eye[0], 0.35 - eye[1], z - eye[2]];
  const xv = dot(v, right), yv = dot(v, up2), zv = dot(v, fwd);
  if (zv <= 0.1) return null;
  const tanF = Math.tan(((38 / 2) * Math.PI) / 180);
  const ndcX = xv / (zv * tanF * aspect);
  const ndcY = yv / (zv * tanF);
  return { x: (ndcX * 0.5 + 0.5) * w, y: (0.5 - ndcY * 0.5) * h };
}

async function runDevice(browserKey) {
  const dev = DEVICES[browserKey];
  console.log(`\n========== ${dev.name} → ${BASE} ==========`);
  const browser = await chromium.launch();
  const context = await browser.newContext({ ...dev, locale: 'en-US' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  const loungeUrl = BASE.replace(/\/$/, '') + '/#brain-lounge';
  await page.goto(loungeUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('h1', { timeout: 20000 });
  await sleep(2500); // fonts + reveal animations
  await shot(page, `${browserKey}-01-lounge.png`);

  /* ---------- 1. lounge page ---------- */
  const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
  record(`${browserKey}:lounge:coarse-pointer-emulated`, coarse, `matchMedia(pointer:coarse)=${coarse}`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  record(`${browserKey}:lounge:no-horizontal-overflow`, overflow <= 1, `scrollWidth-innerWidth=${overflow}px`);
  const playButtons = page.locator('button:has-text("Play now"), a:has-text("Open game")');
  const playCount = await playButtons.count();
  record(`${browserKey}:lounge:cartridge-buttons`, playCount === 3, `${playCount}/3 live cartridges`);
  const title = await page.title();
  record(`${browserKey}:lounge:title`, /Brain Lounge/i.test(title), title);

  /* ---------- 2. BrickForge ---------- */
  try {
    await page.locator('article', { hasText: 'BrickForge' }).locator('button:has-text("Play now")').tap();
    await page.waitForSelector('.brickforge-root canvas', { timeout: 15000 });
    await sleep(900);
    const box = await page.locator('.brickforge-root canvas').boundingBox();
    record(`${browserKey}:brick:canvas-fits`, !!box && box.width <= dev.viewport.width + 1 && box.height >= 180,
      box ? `canvas ${Math.round(box.width)}×${Math.round(box.height)}` : 'no canvas');
    await shot(page, `${browserKey}-02-brick-start.png`);

    await page.locator('button:has-text("START FORGING")').tap();
    await page.waitForSelector('button[aria-label="Pause (P)"]', { timeout: 5000 });
    record(`${browserKey}:brick:tap-starts-game`, true, 'pause button appeared');

    // touch drag across canvas bottom (paddle zone) — must not scroll the page
    const scrollBefore = await page.evaluate(() => window.scrollY);
    const cx = box.x + box.width / 2, cy = box.y + box.height * 0.92;
    const session = await context.newCDPSession(page);
    await cdpTouchDrag(session, [
      { x: cx - box.width * 0.35, y: cy }, { x: cx, y: cy },
      { x: cx + box.width * 0.35, y: cy },
    ]);
    await sleep(400);
    const scrolled = (await page.evaluate(() => window.scrollY)) !== scrollBefore;
    const stillPlaying = await page.locator('button[aria-label="Pause (P)"]').isVisible().catch(() => false);
    record(`${browserKey}:brick:touch-drag-no-scroll-no-pause`, !scrolled && stillPlaying, scrolled ? 'page scrolled!' : 'drag kept game playing');
    await shot(page, `${browserKey}-03-brick-playing.png`);

    // tap to launch (quick tap on canvas)
    await cdpTouchTap(session, cx, cy);
    await sleep(500);

    // options respond to touch: pause → RESUME
    await page.locator('button[aria-label="Pause (P)"]').tap();
    const resume = page.locator('button:has-text("RESUME")');
    await resume.waitFor({ timeout: 4000 });
    record(`${browserKey}:brick:pause-overlay-touch`, await resume.isVisible(), 'RESUME visible');
    await shot(page, `${browserKey}-04-brick-paused.png`);
    await resume.tap();
    await sleep(400);
    const resumed = await page.locator('button[aria-label="Pause (P)"]').isVisible().catch(() => false);
    record(`${browserKey}:brick:resume-touch`, resumed, 'back to playing');
  } catch (e) {
    record(`${browserKey}:brick`, false, 'exception: ' + e.message.split('\n')[0]);
    await shot(page, `${browserKey}-brick-FAIL.png`).catch(() => {});
  }

  /* ---------- 3. Arena Chess 3D ---------- */
  try {
    await page.locator('button:has-text("All cartridges")').first().tap().catch(() => {});
    await sleep(600);
    await page.locator('article', { hasText: 'Arena Chess 3D' }).locator('button:has-text("Play now")').tap();
    await page.waitForSelector('button:has-text("Pass & play")', { timeout: 15000 });
    await shot(page, `${browserKey}-05-chess-menu.png`);
    await page.locator('button:has-text("Pass & play")').first().tap();
    await sleep(6500); // scene build + first-frame animation
    const canvas3d = page.locator('canvas').last();
    const cbox = await canvas3d.boundingBox();
    record(`${browserKey}:chess:scene-fills-screen`, !!cbox && cbox.width >= dev.viewport.width * 0.95,
      cbox ? `canvas ${Math.round(cbox.width)}×${Math.round(cbox.height)}` : 'no canvas');
    const vp = dev.viewport;
    const e2 = projectSquare('e2', vp, 'w');
    const e4 = projectSquare('e4', vp, 'w');
    record(`${browserKey}:chess:projection-sane`, !!e2 && !!e4 && e2.y > vp.height * 0.55 && e2.y < vp.height * 0.98,
      e2 ? `e2 → (${Math.round(e2.x)}, ${Math.round(e2.y)})` : 'projection failed');
    const session = await context.newCDPSession(page);

    // Tilt the camera toward top-down first: at the default portrait angle the
    // rank-2 pawns are occluded by the tall rank-1 pieces. OrbitControls:
    // dragging DOWN moves the camera UP (toward top-down).
    await cdpTouchDrag(session, [
      { x: vp.width * 0.85, y: vp.height * 0.30 },
      { x: vp.width * 0.85, y: vp.height * 0.42 },
      { x: vp.width * 0.85, y: vp.height * 0.56 },
      { x: vp.width * 0.85, y: vp.height * 0.70 },
    ]);
    await sleep(1100);
    await cdpShot(session, `${browserKey}-06-chess-tilted.jpg`);

    const beforeSel = await cdpShot(session, `${browserKey}-06-chess-board.jpg`);

    // tap the e2 pawn (candidate scan — take the first tap that highlights something)
    const pill = page.locator('div.rounded-full', { hasText: 'to move' }).first();
    const pillText = () => pill.textContent({ timeout: 2500 }).catch(() => '');
    // tap Y follows the projected e2 position (414 was iPhone-only; taller phones differ)
    const e2Y = Number(process.env.CHESS_E2_Y || Math.round(e2.y));
    let afterSel = null, selDiff = 0;
    // clear any stray selection on the grass first
    await cdpTouchTap(session, Math.round(vp.width * 0.5), Math.round(vp.height * 0.93));
    await sleep(400);
    for (const dy of [0, -14, 14, -28, 28]) {
      await cdpTouchTap(session, e2.x, e2Y + dy);
      await sleep(650);
      afterSel = await cdpShot(session, `${browserKey}-07-chess-selected.jpg`);
      selDiff = await pngDiff(page, beforeSel, afterSel);
      if (selDiff > 3) break;
    }
    const pillWhileSel = await pillText();
    record(`${browserKey}:chess:tap-selects-piece`, selDiff > 3, `pixels=${selDiff} · pill="${pillWhileSel.trim()}"`);

    // tap e4 (two ranks up-screen) → move lands, turn flips to Black
    const e4Y = Number(process.env.CHESS_E4_Y || e2Y - 64);
    let pillAfter = '', moveDiff = 0, afterMove = null;
    for (const dy of [0, -12, 12, -24, 24]) {
      await cdpTouchTap(session, e4.x, e4Y + dy);
      await sleep(2200); // move animation + land
      pillAfter = await pillText();
      afterMove = await cdpShot(session, `${browserKey}-08-chess-moved.jpg`);
      moveDiff = await pngDiff(page, afterSel, afterMove);
      if (/Black/i.test(pillAfter)) break;
      // re-select e2 before trying the next candidate
      await cdpTouchTap(session, e2.x, e2Y);
      await sleep(500);
    }
    const moved = /Black/i.test(pillAfter) || /e4/.test(await page.evaluate(() => document.querySelector('aside')?.textContent || ''));
    record(`${browserKey}:chess:tap-target-moves`, moved && moveDiff > 3, `pill="${pillAfter.trim()}" · pixels=${moveDiff}`);

    // swipe on empty screen area → camera orbit
    const pre = await cdpShot(session, `${browserKey}-09-chess-pre-orbit.jpg`);
    await cdpTouchDrag(session, [
      { x: vp.width * 0.15, y: vp.height * 0.18 }, { x: vp.width * 0.3, y: vp.height * 0.18 },
      { x: vp.width * 0.45, y: vp.height * 0.18 }, { x: vp.width * 0.6, y: vp.height * 0.18 },
    ]);
    await sleep(900);
    const post = await cdpShot(session, `${browserKey}-10-chess-orbited.jpg`);
    const orbitDiff = await pngDiff(page, pre, post);
    record(`${browserKey}:chess:swipe-orbits-camera`, orbitDiff > 3, `pixels=${orbitDiff}`);
    // leave the game (fullscreen overlay blocks the shelf underneath)
    await page.locator('button:has-text("Lounge shelf")').first().tap().catch(() => {});
  } catch (e) {
    record(`${browserKey}:chess`, false, 'exception: ' + e.message.split('\n')[0]);
    await shot(page, `${browserKey}-chess-FAIL.png`).catch(() => {});
  }

  /* ---------- 4. Galica ---------- */
  try {
    // fresh page — the chess run may have crashed its software-WebGL renderer
    const gpage = await context.newPage();
    gpage.on('pageerror', (e) => errors.push(String(e)));
    // hard reload — a same-URL goto() can be same-document and leave a game overlay up
    await gpage.goto('about:blank');
    await gpage.goto(loungeUrl, { waitUntil: 'domcontentloaded' });
    await sleep(2500);
    const [galica] = await Promise.all([
      context.waitForEvent('page', { timeout: 20000 }),
      gpage.locator('article', { hasText: 'Galica' }).locator('a:has-text("Open game")').tap(),
    ]);
    await galica.waitForLoadState('domcontentloaded');
    await sleep(1800);
    const gCoarse = await galica.evaluate(() => matchMedia('(pointer: coarse)').matches);
    const touchPadVisible = await galica.evaluate(() => {
      const el = document.getElementById('touch');
      return el ? getComputedStyle(el).display !== 'none' : false;
    });
    record(`${browserKey}:galica:touchpad-shown-on-coarse`, gCoarse && touchPadVisible, `coarse=${gCoarse} #touch display!=none=${touchPadVisible}`);
    await shot(gpage, `${browserKey}-11-galica-title.png`).catch(() => {});

    const gstate = () => galica.evaluate(() => ({ state, selectIdx, score }));
    const s0 = await gstate();
    record(`${browserKey}:galica:title-state`, s0.state === 'TITLE', `state=${s0.state}`);

    const btnC = (id) => galica.locator(`#${id}`).boundingBox();
    const session = await context.newCDPSession(galica);
    const tapBtn = async (id) => { const b = await btnC(id); await cdpTouchTap(session, b.x + b.width / 2, b.y + b.height / 2); };

    // FIRE → SELECT
    await tapBtn('bF');
    await sleep(600);
    const s1 = await gstate();
    record(`${browserKey}:galica:fire-advances-to-select`, s1.state === 'SELECT', `state=${s1.state}`);

    // left/right change ship selection (3 ships — third tap wraps back to 0)
    await tapBtn('bR');
    await sleep(300);
    const s2 = await gstate();
    await tapBtn('bR');
    await sleep(300);
    const s2b = await gstate();
    await tapBtn('bR');
    await sleep(300);
    const s3 = await gstate();
    record(`${browserKey}:galica:touch-selects-ship`, s2.selectIdx === 1 && s2b.selectIdx === 2 && s3.selectIdx === 0,
      `selectIdx ${s1.selectIdx}→${s2.selectIdx}→${s2b.selectIdx}→${s3.selectIdx} (wraps, 3 ships)`);

    // FIRE → PLAY
    await tapBtn('bF');
    await sleep(1200);
    const s4 = await gstate();
    record(`${browserKey}:galica:launch-into-play`, s4.state === 'PLAY', `state=${s4.state}`);
    await shot(gpage, `${browserKey}-12-galica-play.png`).catch(() => {});

    // SHOP touch nav probe (known gap candidate): inject SHOP state
    await galica.evaluate(() => { state = 'SHOP'; shopIdx = 0; isBossWave = true; score = 900; });
    await sleep(400);
    await tapBtn('bR');
    await sleep(300);
    const shopIdxAfterR = await galica.evaluate(() => shopIdx);
    record(`${browserKey}:galica:shop-touch-nav`, shopIdxAfterR !== 0,
      shopIdxAfterR !== 0 ? 'right button navigates shop rows' : `GAP: shopIdx stuck at ${shopIdxAfterR} — touch cannot reach rows 2-5`);
    await shot(gpage, `${browserKey}-13-galica-shop.png`).catch(() => {});
    // exit shop via BOMB touch (documented affordance)
    await tapBtn('bB');
    await sleep(500);
    const s5 = await gstate();
    record(`${browserKey}:galica:shop-exit-via-bomb`, s5.state === 'PLAY', `state=${s5.state}`);

    await galica.close();
  } catch (e) {
    record(`${browserKey}:galica`, false, 'exception: ' + e.message.split('\n')[0]);
    await shot(page, `${browserKey}-galica-FAIL.png`).catch(() => {});
  }

  /* ---------- page errors ---------- */
  const realErrors = errors.filter((e) => !/favicon|ResizeObserver|Aw, Snap|GPU/i.test(e));
  record(`${browserKey}:no-page-errors`, realErrors.length === 0, realErrors.slice(0, 2).join(' | ') || 'clean');

  await browser.close();
}

const devicesToRun = DEVICE === 'both' ? ['iphone', 'pixel'] : [DEVICE];
for (const d of devicesToRun) await runDevice(d);

const fails = results.filter((r) => !r.ok);
console.log(`\n===== SUMMARY: ${results.length - fails.length}/${results.length} PASS =====`);
if (fails.length) { console.log('FAILURES:'); fails.forEach((f) => console.log(' -', f.id, '—', f.note)); process.exit(1); }
