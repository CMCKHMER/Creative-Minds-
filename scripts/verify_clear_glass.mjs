// Verify the clear-glass + glowing-blue-text pass:
//   A. Bi-weekly planner hub (teacher-gated; bypassed via seeded session)
//      - .glass fill thinned to the new stops, week-card 3D stage intact,
//        neon-blue glowing text on card headings/labels/buttons, card
//        scanlines REMOVED while the circuit texture is KEPT (owner call),
//        light-theme variants
//   B. Live Class Results command center (homepage #firebase-dashboard)
//      - scanlines GONE from section + panels, clear glass fills,
//        glowing blue text on stats/panel heads/console bar/h2,
//        tables untouched (no glow on td), 3D stage + brackets intact
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { mkdirSync } from 'node:fs';

const DIST = '/home/z/my-project/tmp/cmc-site/dist';
const PORT = 8942; const BASE = `http://127.0.0.1:${PORT}`;
mkdirSync('/home/z/my-project/tmp/cmc-site/scripts/qa', { recursive: true });
const SHOTS = '/home/z/my-project/tmp/cmc-site/scripts/qa';

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, BASE).pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = normalize(join(DIST, p));
    const data = await readFile(file);
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg' };
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(PORT, r));

const browser = await chromium.launch({ headless: true });
const results = [];
const ok = (name, cond, detail) => results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);

/* ================= A. BI-WEEKLY PLANNER HUB ================= */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('cmc-student-token', 'local-verify');
      localStorage.setItem('cmc-student-role', 'teacher');
      localStorage.setItem('cmc-student-email', 'verify@school.edu.kh');
      localStorage.setItem('cmc-theme', 'dark');
    } catch (e) {}
  });
  await ctx.route('**googletagmanager.com**', r => r.abort());
  await ctx.route('**google-analytics.com**', r => r.abort());
  await ctx.route('**firebaseinstallations.googleapis.com**', r => r.abort());
  await ctx.route('**firestore.googleapis.com**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await ctx.route('**securetoken.googleapis.com**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message.slice(0, 120)));
  await page.goto(`${BASE}/biweek-planner/`, { waitUntil: 'load' });
  await page.waitForTimeout(2200);

  const gateOff = await page.evaluate(() => !document.documentElement.classList.contains('cmc-teacher-gate-locked'));
  ok('planner gate bypassed (teacher session seeded)', gateOff);

  const card = page.locator('.week-card').first();
  await card.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(600);

  const glassBg = await card.evaluate(el => getComputedStyle(el).backgroundImage);
  ok('week-card glass thinned (0.055 stop present)', glassBg.includes('rgba(125, 211, 252, 0.055)'), glassBg.slice(0, 120));
  ok('week-card glass old heavy fill gone', !glassBg.includes('rgba(125, 211, 252, 0.1)') || glassBg.includes('0.055'));

  const h3Shadow = await card.locator('h3').first().evaluate(el => getComputedStyle(el).textShadow);
  ok('week-card title glows blue', h3Shadow !== 'none' && h3Shadow.includes('rgba(147, 222, 255'), h3Shadow.slice(0, 90));
  const pShadow = await card.locator('p').first().evaluate(el => getComputedStyle(el).textShadow);
  ok('week-card paragraph glows blue', pShadow !== 'none' && pShadow.includes('rgba(147, 222, 255'), pShadow.slice(0, 90));
  const lblShadow = await card.locator('.btn-label').first().evaluate(el => getComputedStyle(el).textShadow);
  ok('drill button label glows blue', lblShadow !== 'none' && lblShadow.includes('rgba(147, 222, 255'), lblShadow.slice(0, 90));
  const chipShadow = await card.locator('.week-chip').first().evaluate(el => getComputedStyle(el).textShadow);
  ok('week chip glows blue', chipShadow !== 'none' && chipShadow.includes('rgba(147, 222, 255'), chipShadow.slice(0, 90));

  const beforeBg = await card.evaluate(el => getComputedStyle(el, '::before').backgroundImage);
  ok('planner card scanlines REMOVED (clear glass, no lines through panels)', !beforeBg.includes('repeating-linear-gradient'), beforeBg.slice(0, 100));
  const projBg = beforeBg;
  ok('planner projector light kept', projBg.includes('radial-gradient'));
  ok('week-card circuit texture KEPT (owner: only scanlines removed)', glassBg.includes('data:image/svg+xml'), glassBg.slice(0, 100));
  const glowLayers = (h3Shadow.match(/rgba\(/g) || []).length;
  ok('neon text glow is a 4-layer emission (core + 3 halos)', glowLayers >= 4, `${glowLayers} shadow layers`);

  // 3D stage intact: rest translateZ 48 (read matrix m43 while bobbing)
  const m43 = await card.evaluate(el => {
    const tr = getComputedStyle(el).transform;
    const m = new DOMMatrixReadOnly(tr);
    return m.m43;
  });
  ok('week-card rest hover Z intact (44–52 band)', m43 >= 42 && m52ok(m43), `m43=${m43.toFixed(1)}`);
  function m52ok(v) { return v <= 52; }

  await page.screenshot({ path: `${SHOTS}/planner-clear-dark.png` });

  // Light theme
  await page.evaluate(() => { document.documentElement.setAttribute('data-theme', 'light'); try { localStorage.setItem('cmc-theme', 'light'); } catch (e) {} });
  await page.waitForTimeout(700);
  const lightBg = await card.evaluate(el => getComputedStyle(el).backgroundImage);
  ok('light week-card glass thinned (0.62 stop)', lightBg.includes('rgba(255, 255, 255, 0.62)'), lightBg.slice(0, 110));
  const lightShadow = await card.locator('h3').first().evaluate(el => getComputedStyle(el).textShadow);
  ok('light theme glow retuned (14,165,233)', lightShadow.includes('rgba(14, 165, 233'), lightShadow.slice(0, 90));
  const lightGlowLayers = (lightShadow.match(/rgba\(/g) || []).length;
  ok('light theme neon glow is 4-layer too', lightGlowLayers >= 4, `${lightGlowLayers} shadow layers`);
  await page.screenshot({ path: `${SHOTS}/planner-clear-light.png` });
  ok('planner no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

/* ================= B. COMMAND CENTER (student area) ================= */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await ctx.route('**googletagmanager.com**', r => r.abort());
  await ctx.route('**google-analytics.com**', r => r.abort());
  await ctx.route('**fonts.googleapis.com**', r => r.abort());
  await ctx.route('**fonts.gstatic.com**', r => r.abort());
  await ctx.route('**firestore.googleapis.com**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await ctx.route('**securetoken.googleapis.com**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message.slice(0, 120)));
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  // Progressive scroll: LazyMount only mounts the dashboard chunk when the
  // viewport approaches it, and the section id exists only after mount.
  for (let i = 0; i < 40; i++) {
    const found = await page.evaluate(() => {
      const el = document.getElementById('firebase-dashboard');
      if (el) { el.scrollIntoView({ block: 'start', behavior: 'instant' }); return true; }
      window.scrollBy({ top: 900, behavior: 'instant' });
      return false;
    });
    if (found) break;
    await page.waitForTimeout(450);
  }
  await page.waitForSelector('.cmcdc-stat', { timeout: 20000 });
  await page.waitForTimeout(800);

  const sec = page.locator('#firebase-dashboard');
  const secBefore = await sec.evaluate(el => getComputedStyle(el, '::before').backgroundImage);
  ok('section scanlines REMOVED', !secBefore.includes('repeating-linear-gradient'), secBefore.slice(0, 100));
  ok('section vignette kept', secBefore.includes('radial-gradient'));

  const stat = page.locator('.cmcdc-stat').first();
  const statBg = await stat.evaluate(el => getComputedStyle(el).backgroundImage);
  ok('stat glass cleared (0.055 stop)', statBg.includes('rgba(125, 211, 252, 0.055)'), statBg.slice(0, 110));
  const statBefore = await stat.evaluate(el => getComputedStyle(el, '::before').backgroundImage);
  ok('stat panel scanlines REMOVED', !statBefore.includes('repeating-linear-gradient'), statBefore.slice(0, 110));
  ok('stat projector glow boosted + floor light', statBefore.includes('rgba(147, 222, 255, 0.2)') && statBefore.includes('linear-gradient(0deg'));

  const statP = await stat.locator('p').first().evaluate(el => getComputedStyle(el).textShadow);
  ok('stat text glows blue', statP.includes('rgba(147, 222, 255'), statP.slice(0, 90));

  const panel = page.locator('.cmcdc-panel').first();
  const panelBefore = await panel.evaluate(el => getComputedStyle(el, '::before').backgroundImage);
  ok('big panel scanlines REMOVED', !panelBefore.includes('repeating-linear-gradient'));
  const panelBg = await panel.evaluate(el => getComputedStyle(el).backgroundImage);
  ok('panel glass cleared (0.05 stop)', panelBg.includes('rgba(125, 211, 252, 0.05)'), panelBg.slice(0, 110));
  const headShadow = await panel.locator('.cmcdc-panel-head').evaluate(el => getComputedStyle(el).textShadow);
  ok('panel header glows blue', headShadow.includes('rgba(147, 222, 255'), headShadow.slice(0, 90));

  const tdShadow = await panel.evaluate(el => {
    const td = el.querySelector('td');
    return td ? getComputedStyle(td).textShadow : '(no table in this state)';
  });
  ok('data tables untouched (no glow)', tdShadow === 'none' || tdShadow.startsWith('(no table'), tdShadow.slice(0, 60));

  const barTitle = await page.locator('.cmcdc-consolebar-title').evaluate(el => getComputedStyle(el).textShadow);
  ok('console bar title glows', barTitle.includes('rgba(125, 211, 252'), barTitle.slice(0, 80));

  const h2 = page.locator('#firebase-dashboard .cmc-h2').first();
  const h2Shadow = await h2.evaluate(el => getComputedStyle(el).textShadow);
  ok('section h2 glows blue', h2Shadow.includes('rgba(56, 189, 248'), h2Shadow.slice(0, 90));
  const gradSpan = await h2.locator('.cmc-gradient-text').evaluate(el => getComputedStyle(el).textShadow);
  ok('gradient-text shielded from glow (stays crisp)', gradSpan === 'none', gradSpan);

  // 3D stage intact
  const m43 = await stat.evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m43);
  ok('stat rest translateZ(44) intact (40–48 band)', m43 >= 40 && m43 <= 48, `m43=${m43.toFixed(1)}`);
  const brackets = await stat.evaluate(el => getComputedStyle(el, '::after').backgroundImage);
  ok('HUD brackets kept', brackets.includes('linear-gradient') && brackets.split('linear-gradient').length > 4);

  await page.screenshot({ path: `${SHOTS}/cmdc-clear-dark.png` });
  ok('command center no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

await browser.close();
server.close();
console.log(results.join('\n'));
const fails = results.filter(r => r.startsWith('FAIL')).length;
console.log(`\n${results.length - fails}/${results.length} checks passed`);
process.exit(fails ? 1 : 0);
