import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const DIST = '/home/z/my-project/tmp/cmc-site/dist';
const PORT = 8931; const BASE = `http://127.0.0.1:${PORT}`;
const SHOTS = '/home/z/my-project/tmp/cmc-site/scripts/qa';

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, BASE).pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = normalize(join(DIST, p));
    const data = await readFile(file);
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(PORT, r));

const browser = await chromium.launch({ headless: true });
const results = [];
const ok = (name, cond, detail) => results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);

/* ================= A. THE GAME — Talk to me ================= */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const postedSlugs = [];
  // Fake the CMC stats pipeline endpoints (offline sandbox): token + Firestore REST
  await ctx.route('**securetoken.googleapis.com**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'tok', id_token: 'tok', expires_in: '3600', refresh_token: 'r', project_id: 'p' }) }));
  await ctx.route('**firestore.googleapis.com**', r => { try { const b = r.request().postData() || ''; const m = b.match(/voice-quest-[a-z0-9]+/); if (m && r.request().method() === 'POST') postedSlugs.push(m[0]); } catch {} return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }); });
  await ctx.route('**googletagmanager.com**', r => r.abort());
  await ctx.route('**google-analytics.com**', r => r.abort());
  await ctx.route('**fonts.googleapis.com**', r => r.abort());
  await ctx.route('**fonts.gstatic.com**', r => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message.slice(0, 140)));
  page.on('console', m => { if (m.type() === 'error' && !/firestore|Failed to load|net::|ERR_FAILED|fetch/i.test(m.text())) errors.push('console: ' + m.text().slice(0, 140)); });
  // Silence voice feedback: headless speechSynthesis never fires onend and the
  // engine awaits it, deadlocking the command queue.
  await ctx.addInitScript(`try{localStorage.setItem('vq-settings-v2',JSON.stringify({voiceFeedback:false,sound:false,handsFree:false}));}catch(e){}`);

  await page.goto(`${BASE}/voice-quest.html`, { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  ok('game title', (await page.title()).includes('Talk to me'));
  ok('hero chip says 15 levels · 5 units', await page.getByText('15 levels · 5 units').count() > 0);
  ok('Master Class unit card renders', await page.getByText('Master Class').count() > 0);
  for (const t of ['Set the Table', 'Animal Shelter', 'The Master Key'])
    ok(`level card "${t}" visible`, await page.getByText(t, { exact: false }).count() > 0);
  ok('back-to-CMC link href', await page.getAttribute('a[aria-label="Back to CMC — Creative Minds Network home"]', 'href') === 'https://cmckhmer.github.io/Creative-Minds-/');
  ok('word count chip present', await page.locator('text=practice words').count() > 0);

  await page.screenshot({ path: `${SHOTS}/vq-master-unit.png`, fullPage: false });
  const masterCard = page.locator('div', { hasText: 'Master Class' }).last();
  await page.evaluate(() => { const els = [...document.querySelectorAll('*')].filter(e => e.textContent === 'Master Class'); els.at(-1)?.scrollIntoView({ block: 'center', behavior: 'instant' }); });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/vq-master-card.png` });

  // --- play levels 13, 14, 15 by typing their solutions ---
  const solutions = {
    13: ["Go to the cake and pick it up", "Go to the table", "Put the cake on the table", "Go to the flower and pick it up", "Go to the box", "Put the flower next to the box", "Go to the carrot and pick it up", "Go to the tree", "Put it between the tree and the house", "Clap"],
    14: ["Go to the fish and pick it up", "Go to the cat and give the fish to the cat", "Go to the bone and pick it up", "Go to the dog and give the bone to the dog", "Go to the carrot and pick it up", "Go to the rabbit and give the carrot to the rabbit", "Go to the bread and pick it up", "Go to the bird and give the bread to the bird", "Wave"],
    15: ["Go to the bone and pick it up", "Go to the dog and give the bone to the dog", "Go to the brown ball", "Pick up the brown ball", "Go left nine", "Go down five", "Pick up the biggest fish", "Go to the key and pick it up", "Go to the door and open it", "Go to the star and pick it up", "Put the brown ball on the table", "Dance"],
  };
  const titles = { 13: 'Set the Table', 14: 'Animal Shelter', 15: 'The Master Key' };
  for (const [lv, cmds] of Object.entries(solutions)) {
    const title = titles[lv];
    // start level 13 from its card; 14/15 arrive via the completion screen's "Next level"
    if (!(await page.locator(`[data-level="${lv}"]`).count())) {
      const cardBtn = page.locator('article', { hasText: title }).getByRole('button', { name: /play/i }).first();
      await cardBtn.scrollIntoViewIfNeeded().catch(() => {});
      await cardBtn.click();
      await page.waitForTimeout(1100);
    }
    ok(`level ${lv} started`, (await page.locator(`[data-level="${lv}"]`).count()) > 0);
    let done = false; let lastSay = ''; const trail = [];
    for (const c of cmds) {
      const input = page.locator('#typed-command');
      if (!(await input.count())) break;
      await input.fill(c);
      await page.waitForTimeout(120);
      await page.keyboard.press('Enter');
      // wait for the engine to finish all frames of this command
      await page.waitForFunction(() => document.querySelector('[data-busy]')?.getAttribute('data-busy') === '0', null, { timeout: 9000 }).catch(() => {});
      await page.waitForTimeout(260);
      lastSay = c;
      const goal = await page.locator('[data-goal]').first().getAttribute('data-goal').catch(() => null);
      const resp = await page.evaluate(() => {
        const boxes = [...document.querySelectorAll('div.mt-4.rounded-2xl')];
        return boxes.length ? boxes.at(-1).textContent.replace(/\s+/g, ' ').slice(0, 130) : '';
      });
      trail.push(`goal=${goal} :: ${resp}`);
      if (await page.getByText(/You finished/).count() > 0) { done = true; break; }
    }
    await page.waitForTimeout(900);
    const done2 = await page.getByText(/You finished/).count();
    ok(`level ${lv} completed by typed solution`, done || done2 > 0, `last="${lastSay}" ${trail.slice(-2).join(' ; ')}`);
    await page.screenshot({ path: `${SHOTS}/vq-l${lv}-done.png` });
    // first finish asks who is playing → Skip (guest)
    const skip = page.getByRole('button', { name: /skip/i }).first();
    if (await skip.count()) { await skip.click().catch(() => {}); await page.waitForTimeout(400); }
    // advance: completion screen "Next level", else back to the level list
    const next = page.getByRole('button', { name: /next level/i }).first();
    if (Number(lv) < 15 && await next.count()) {
      await next.click().catch(() => {});
      await page.waitForTimeout(1100);
    } else {
      const exit = page.getByRole('button', { name: /level menu/i }).last();
      if (await exit.count()) { await exit.click().catch(() => {}); await page.waitForTimeout(900); }
    }
  }

  // stars persisted: total should be 9 (3 levels × 3 stars)
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('vq-progress') || '{}'));
  const got = [13, 14, 15].map(n => stored[n]).join(',');
  ok('stars stored for 13/14/15 (3 each)', got === '3,3,3', `vq-progress = ${got}`);
  for (const n of [13, 14, 15]) ok(`stats pipeline POST for voice-quest-l${n}`, postedSlugs.includes(`voice-quest-l${n}`), `captured: ${postedSlugs.join(', ') || 'none'}`);

  // nav pages work
  for (const label of ['Word Book', 'Game Designer', 'How to play']) {
    const b = page.getByRole('button', { name: new RegExp(label, 'i') }).first();
    if (await b.count()) {
      await b.click(); await page.waitForTimeout(500);
      ok(`page "${label}" opens`, true);
      const back = page.getByRole('button', { name: /levels/i }).first();
      if (await back.count()) { await back.click().catch(() => {}); await page.waitForTimeout(300); }
    } else ok(`page "${label}" opens`, false, 'nav button not found');
  }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

/* ================= B. HERO PAGE BUTTONS ================= */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await ctx.route('**firestore.googleapis.com**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await ctx.route('**securetoken.googleapis.com**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await ctx.route('**googletagmanager.com**', r => r.abort());
  await ctx.route('**google-analytics.com**', r => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message.slice(0, 140)));
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await page.waitForTimeout(1400);

  const inView = id => page.evaluate(sid => {
    const el = document.getElementById(sid); if (!el) return -1;
    const r = el.getBoundingClientRect();
    return Math.max(0, Math.min(1, (Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)) / r.height));
  }, id);

  // 1. Quick card TOEFL iBT → #toefl-ibt-mock section
  await page.getByRole('button', { name: /TOEFL iBT Full Mock Test/i }).first().click();
  await page.waitForTimeout(3400);
  const v1 = await inView('toefl-ibt-mock');
  ok('hero card "TOEFL iBT Full Mock Test" scrolls to mock section', v1 > 0.2, `visibility=${v1.toFixed(2)}`);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })); await page.waitForTimeout(700);

  // 2. Quick card Learning Games → Play Lab page
  await page.getByRole('button', { name: /Learning Games/i }).first().click();
  await page.waitForTimeout(1600);
  const hash1 = await page.evaluate(() => location.hash);
  const gamesVisible = await page.getByText(/Play Lab|Talk to me/).count();
  ok('hero card "Learning Games" opens the Play Lab', hash1 === '#games' && gamesVisible > 0, `hash=${hash1} matches=${gamesVisible}`);
  // return home
  const back = page.getByRole('button', { name: /back|home/i }).first();
  if (await back.count()) { await back.click(); await page.waitForTimeout(1200); }
  await page.evaluate(() => { location.hash = '#top'; }); await page.waitForTimeout(900);

  // 3. Explore teacher tools → teacher tools page
  await page.getByRole('button', { name: /Explore teacher tools/i }).first().click();
  await page.waitForTimeout(1600);
  const hash2 = await page.evaluate(() => location.hash);
  const tt = await page.getByText(/Teacher Tools|Dice|Wheel/i).count();
  ok('hero CTA "Explore teacher tools" opens Teacher Tools', hash2 === '#teacher-tools' && tt > 0, `hash=${hash2} matches=${tt}`);
  await page.evaluate(() => { location.hash = '#top'; }); await page.waitForTimeout(900);
  await page.waitForTimeout(800);

  // 4. Quick Drawer: TOEFL iBT Full Mock Test link → mock section
  await page.getByRole('button', { name: /Quick Links/i }).first().click();
  await page.waitForTimeout(600);
  const search = page.getByPlaceholder(/Search tools/i);
  await search.fill('TOEFL iBT Full Mock'); await page.waitForTimeout(400);
  await page.locator('div.fixed.inset-0 button', { hasText: 'TOEFL iBT Full Mock Test' }).first().click();
  await page.waitForTimeout(3400);
  const v2 = await inView('toefl-ibt-mock');
  ok('QuickDrawer "TOEFL iBT Full Mock Test" → mock section', v2 > 0.2, `visibility=${v2.toFixed(2)}`);

  // 5. QuickDrawer: Bi-Weekly Planner → planner hub URL
  await page.getByRole('button', { name: /Quick Links/i }).first().click();
  await page.waitForTimeout(600);
  await page.getByPlaceholder(/Search tools/i).fill('Bi-Weekly Planner'); await page.waitForTimeout(400);
  await page.locator('div.fixed.inset-0 button', { hasText: 'TOEFL ITP Bi-Weekly Planner' }).first().click();
  await page.waitForTimeout(1400);
  const url3 = await page.evaluate(() => location.pathname);
  ok('QuickDrawer "TOEFL ITP Bi-Weekly Planner" → planner hub', url3.includes('/biweek-planner/'), `path=${url3}`);
  await page.goto(`${BASE}/`, { waitUntil: 'load' }); await page.waitForTimeout(1200);

  // 6. QuickDrawer: Printable Assignment Packs → resources section
  await page.getByRole('button', { name: /Quick Links/i }).first().click();
  await page.waitForTimeout(600);
  await page.getByPlaceholder(/Search tools/i).fill('Printable Assignment'); await page.waitForTimeout(400);
  await page.locator('div.fixed.inset-0 button', { hasText: 'Printable Assignment Packs' }).first().click();
  await page.waitForTimeout(1800);
  const v3 = await inView('resources');
  ok('QuickDrawer "Printable Assignment Packs" → resources vault', v3 > 0.2, `visibility=${v3.toFixed(2)}`);

  // 7. Navbar anchor sanity: Assessments
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })); await page.waitForTimeout(700);
  await page.locator('a[href="#toefl-junior-assessments"]').first().click();
  await page.waitForTimeout(4600);
  const h5 = await page.evaluate(() => location.hash);
  const v4 = await inView('toefl-junior-assessments');
  ok('navbar "Assessments" → junior assessments', v4 > 0.1 || h5 === '#toefl-junior-assessments', `visibility=${v4.toFixed(2)} hash=${h5}`);

  await page.screenshot({ path: `${SHOTS}/hp-hero.png` });
  ok('homepage no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

server.close();
await browser.close();
console.log(results.join('\n'));
const fails = results.filter(r => r.startsWith('FAIL')).length;
console.log(`\n${results.length - fails}/${results.length} checks passed`);
process.exit(fails ? 1 : 0);
