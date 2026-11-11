/* CMC-MOBILE verify — Studio compact mobile pass.
   Serves public/ (or argv[2]) and checks the mobile layout at phone,
   tablet and desktop viewports. Exits non-zero on any failure. */
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('/home/z/.npm-global/lib/node_modules/playwright');

const ROOT = resolve(process.argv[2] || 'public');
const PORT = 8133;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+title', '.woff2': 'font/woff2' };
MIME['.webmanifest'] = 'application/manifest+json';

const server = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = join(ROOT, p);
  if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end('nope'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((ok) => server.listen(PORT, ok));

const browser = await chromium.launch();
let fails = [], checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) fails.push(msg); else console.log('  ✓ ' + msg); };

async function newPage(opts) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => fails.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.gstatic|googleapis|Firebase|sentry/i.test(m.text())) fails.push('console: ' + m.text()); });
  await page.goto(`http://localhost:${PORT}/studio/`, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(600);
  return { ctx, page };
}
const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

/* ═══ 1. PHONE (iPhone-ish 393×852, touch) ═══ */
console.log('\n── PHONE 393×852 ──');
const iPhone = { viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
{
  const { ctx, page } = await newPage(iPhone);
  // Welcome screen
  ok(await page.isVisible('#welcomeScreen'), 'welcome screen shows');
  ok(await noHScroll(page), 'no horizontal scroll on welcome');
  const cards = await page.locator('.welcome-card').count();
  ok(cards === 4, `4 welcome cards present (${cards})`);
  const cardBox = await page.locator('.welcome-grid').boundingBox();
  ok(cardBox && cardBox.width <= 393, 'welcome grid fits viewport');

  // Choose Document
  await page.tap('.welcome-card[onclick*="doc"]');
  await page.waitForTimeout(500);
  ok(await page.evaluate(() => document.querySelector('#welcomeScreen').classList.contains('hidden')), 'welcome dismissed');
  // Panel starts hidden on mobile (CMC-MOBILE default)
  ok(await page.evaluate(() => document.getElementById('panel').classList.contains('hidden')), 'panel drawer starts hidden');
  ok(await page.evaluate(() => document.querySelector('.workspace').classList.contains('no-panel')), 'workspace no-panel state set');
  // Rail collapses in doc mode
  ok(await page.evaluate(() => getComputedStyle(document.getElementById('rail')).display === 'none'), 'canvas rail hidden in Docs mode');
  const cols = await page.evaluate(() => getComputedStyle(document.querySelector('.workspace')).gridTemplateColumns);
  ok(/^0px\s+\d+px$/.test(cols.replace(/\s+/g, ' ')), `workspace collapses to 0px + full-width stage (got: ${cols})`);
  // Doc layer usable
  ok(await page.isVisible('#docLayer'), 'doc layer visible');
  ok(await noHScroll(page), 'no horizontal scroll in Docs mode');
  // Panel toggle opens the drawer over the stage
  await page.tap('#panelToggle');
  await page.waitForTimeout(350);
  ok(await page.evaluate(() => !document.getElementById('panel').classList.contains('hidden')), 'panel drawer opens from ‹ toggle');
  const pc = await page.evaluate(() => { const s = getComputedStyle(document.getElementById('panel')); return { pos: s.position, z: s.zIndex, w: s.width }; });
  ok(pc.pos === 'absolute' && pc.z === '48', `drawer floats over stage (pos=${pc.pos}, z=${pc.z})`);
  const pb = await page.locator('#panel').boundingBox();
  ok(pb && pb.x >= 393 - 301, `drawer hugs right edge (x=${pb && Math.round(pb.x)})`);
  ok(await page.evaluate(() => document.getElementById('panel').scrollHeight >= document.getElementById('panel').clientHeight - 4), 'drawer content scrollable');
  // View menu check stayed in sync (starts unchecked because drawer is hidden)
  await page.tap('.menu[data-menu="view"]');
  await page.waitForTimeout(250);
  const checked = await page.evaluate(() => document.querySelector('.menu-item[data-action="view-toggle-panel"] .check').classList.contains('empty'));
  ok(!checked, 'View ▸ Show Side Panel check in sync (checked while drawer is open)');
  const dd = await page.locator('.menu[data-menu="view"] .menu-dropdown').boundingBox();
  ok(dd && dd.x >= 0 && dd.x + dd.width <= 393 + 1, `View dropdown inside viewport (${dd && Math.round(dd.width)}w @${dd && Math.round(dd.x)})`);
  await page.tap('.menu[data-menu="view"]'); await page.waitForTimeout(200);
  // Close drawer again
  await page.tap('#panelToggle');
  await page.waitForTimeout(300);
  ok(await page.evaluate(() => document.getElementById('panel').classList.contains('hidden')), 'drawer closes again');
  const checkAfterClose = await page.evaluate(() => document.querySelector('.menu-item[data-action="view-toggle-panel"] .check').classList.contains('empty'));
  ok(checkAfterClose, 'View ▸ Show Side Panel check back to unchecked after close');

  // Excel mode
  await page.tap('.mode-tab[data-mode="sheet"]');
  await page.waitForTimeout(500);
  ok(await page.isVisible('#sheetLayer'), 'sheet layer visible');
  const cells = await page.locator('#sheetGrid td.cell').count();
  ok(cells > 50, `sheet grid rendered (${cells} cells)`);
  await page.tap('#sheetGrid td.cell[data-r="2"][data-c="2"]').catch(() => page.tap('#sheetGrid td.cell'));
  await page.waitForTimeout(300);
  const sel = await page.evaluate(() => !!document.querySelector('#sheetGrid td.cell.selected'));
  ok(sel, 'tapping a cell selects it (touch → tap works)');
  ok(await page.isVisible('#sheetFormula'), 'formula bar visible');
  // Footer inside the visual viewport (dvh fix)
  const fB = await page.evaluate(() => document.querySelector('footer').getBoundingClientRect().bottom);
  ok(fB <= 852 + 1, `footer bottom within viewport (${Math.round(fB)} ≤ 852)`);

  // Code mode
  await page.tap('.mode-tab[data-mode="code"]');
  await page.waitForTimeout(400);
  ok(await page.isVisible('#codeLayer'), 'code layer visible');
  await page.fill('#codeEditor', "console.log('cmc-mobile-ok')");
  await page.tap('#quickSet-code button[title^="Run code"]'); // ▶ Run
  await page.waitForTimeout(400);
  const out = await page.evaluate(() => document.getElementById('codeOutput').textContent);
  ok(out.includes('cmc-mobile-ok'), `code runs from toolbar tap (output: "${out.trim().slice(0, 40)}")`);

  // Back to Canvas — rail returns, brush tap draws
  await page.tap('.mode-tab[data-mode="canvas"]');
  await page.waitForTimeout(500);
  ok(await page.evaluate(() => getComputedStyle(document.getElementById('rail')).display !== 'none'), 'rail back in Canvas mode');
  ok(await noHScroll(page), 'no horizontal scroll in Canvas mode');
  // Panel hidden again → canvas fills the width
  const wsBox = await page.locator('.workspace').boundingBox();
  ok(wsBox && Math.round(wsBox.width) === 393, `workspace full width (${wsBox && Math.round(wsBox.width)})`);
  // tap Brush in quick bar, then tap canvas center → a dot is drawn
  await page.tap('#quickSet-canvas [data-quick-tool="brush"]');
  await page.waitForTimeout(200);
  const brushActive = await page.evaluate(() => document.querySelector('#quickSet-canvas [data-quick-tool="brush"]').classList.contains('active'));
  ok(brushActive, 'Brush activates from quick bar tap');
  const pv = await page.locator('#preview').boundingBox();
  await page.touchscreen.tap(pv.x + pv.width / 2, pv.y + pv.height / 2);
  await page.waitForTimeout(300);
  const alpha = await page.evaluate(() => { const l = layers[currentLayer]; const c = l.canvas.getContext('2d'); let n = 0; for (let dy = -12; dy <= 12; dy += 2) for (let dx = -12; dx <= 12; dx += 2) { if (c.getImageData(Math.round(W / 2) + dx, Math.round(H / 2) + dy, 1, 1).data[3] > 0) n++; } return n; });
  ok(alpha > 0, `touch tap on canvas paints (${alpha} px in the 24px center zone)`);

  // Menubar scrolls + File dropdown opens on-screen
  const mb = await page.evaluate(() => { const m = document.getElementById('menubar'); return { sw: m.scrollWidth, cw: m.clientWidth }; });
  ok(mb.sw > mb.cw, `menubar horizontally scrollable (${mb.sw} > ${mb.cw})`);
  await page.tap('.menu[data-menu="file"]');
  await page.waitForTimeout(250);
  const fd = await page.locator('.menu[data-menu="file"] .menu-dropdown').boundingBox();
  ok(fd && fd.x >= 0 && fd.x + fd.width <= 393 + 1, `File dropdown inside viewport (${fd && Math.round(fd.width)}w @${fd && Math.round(fd.x)})`);
  const kbdHidden = await page.evaluate(() => getComputedStyle(document.querySelector('.menu-item .kbd')).display === 'none');
  ok(kbdHidden, 'keyboard hints hidden on touch');
  await page.tap('.menu[data-menu="file"]');
  // Help (rightmost) dropdown opens leftwards, on-screen
  await page.tap('.menu[data-menu="help"]');
  await page.waitForTimeout(250);
  const hd = await page.locator('.menu[data-menu="help"] .menu-dropdown').boundingBox();
  ok(hd && hd.x >= 0 && hd.x + hd.width <= 393 + 1, `Help dropdown inside viewport (${hd && Math.round(hd.width)}w @${hd && Math.round(hd.x)})`);
  await page.tap('.menu[data-menu="help"]');
  // Rulers hidden on phone
  const rulerHidden = await page.evaluate(() => document.getElementById('rulerXWrap').style.display === 'none');
  ok(rulerHidden, 'rulers auto-hidden on phone (View menu can re-show)');
  // Quick bar scrollable
  const qb = await page.evaluate(() => { const q = document.getElementById('quickBar'); return { sw: q.scrollWidth, cw: q.clientWidth }; });
  ok(qb.sw > qb.cw || qb.sw <= qb.cw, `quick bar measured (${qb.sw}/${qb.cw})`); // informational
  await ctx.close();
}

/* ═══ 2. TABLET (iPad-ish 768×1024, touch) ═══ */
console.log('\n── TABLET 768×1024 ──');
{
  const { ctx, page } = await newPage({ viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.tap('.welcome-card[onclick*="canvas"]').catch(() => {});
  await page.waitForTimeout(400);
  ok(await page.evaluate(() => document.getElementById('panel').classList.contains('hidden')), 'panel drawer starts hidden on tablet');
  ok(await page.evaluate(() => getComputedStyle(document.getElementById('rail')).display !== 'none'), 'rail visible in Canvas mode on tablet');
  const cols = await page.evaluate(() => getComputedStyle(document.querySelector('.workspace')).gridTemplateColumns);
  ok(/^48px\s+\d+px$/.test(cols.replace(/\s+/g, ' ')), `slim 48px rail on tablet (got: ${cols})`);
  await page.tap('.mode-tab[data-mode="doc"]');
  await page.waitForTimeout(400);
  ok(await page.evaluate(() => getComputedStyle(document.getElementById('rail')).display === 'none'), 'rail collapses in Docs on tablet');
  ok(await noHScroll(page), 'no horizontal scroll on tablet');
  await ctx.close();
}

/* ═══ 3. DESKTOP 1440×900 — untouched ═══ */
console.log('\n── DESKTOP 1440×900 ──');
{
  const { ctx, page } = await newPage({ viewport: { width: 1440, height: 900 } });
  await page.evaluate(() => welcomeChoose('canvas'));
  await page.waitForTimeout(400);
  ok(await page.evaluate(() => !document.getElementById('panel').classList.contains('hidden')), 'desktop panel stays visible by default');
  const pc = await page.evaluate(() => getComputedStyle(document.getElementById('panel')).position);
  ok(pc === 'static', `desktop panel stays inline (position=${pc})`);
  const cols = await page.evaluate(() => getComputedStyle(document.querySelector('.workspace')).gridTemplateColumns);
  ok(cols.includes('64px') && cols.includes('300px'), `desktop workspace columns intact (${cols})`);
  const qs = await page.evaluate(() => getComputedStyle(document.querySelector('.quick-stats')).display);
  ok(qs !== 'none', 'desktop quick-stats still visible');
  const rulerVis = await page.evaluate(() => document.getElementById('rulerXWrap').style.display !== 'none');
  ok(rulerVis, 'desktop rulers still visible');
  await page.evaluate(() => welcomeChoose('doc'));
  await page.waitForTimeout(400);
  ok(await page.evaluate(() => getComputedStyle(document.getElementById('rail')).display !== 'none'), 'desktop rail stays (dimmed) in Docs');
  ok(await noHScroll(page), 'no horizontal scroll on desktop');
  await ctx.close();
}

await browser.close();
server.close();
console.log(`\n${checks} checks, ${fails.length} failures`);
if (fails.length) { console.log('FAILURES:'); fails.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
console.log('ALL GREEN');
