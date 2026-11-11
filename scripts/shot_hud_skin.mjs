// Screenshots of the bi-weekly planner HUD skin for visual review.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { mkdirSync } from 'node:fs';

const DIST = '/home/z/my-project/tmp/cmc-site/dist';
const PORT = 8947; const BASE = `http://127.0.0.1:${PORT}`;
mkdirSync('/home/z/my-project/tmp/cmc-site/scripts/qa/hud', { recursive: true });
const SHOTS = '/home/z/my-project/tmp/cmc-site/scripts/qa/hud';

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
const seed = `try{localStorage.setItem('cmc-student-token','t');localStorage.setItem('cmc-student-role','teacher');localStorage.setItem('cmc-student-uid','u');localStorage.setItem('cmc-student-name','T');localStorage.setItem('cmc-student-email','t@e.edu');localStorage.setItem('cmc-theme','dark');}catch(e){}`;

// 1. desktop dark — hero
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
await ctx.route('**firestore.googleapis.com**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
await ctx.addInitScript(seed);
const page = await ctx.newPage();
await page.goto(`${BASE}/biweek-planner/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${SHOTS}/01-hero-dark.png` });

// 2. desktop dark — cards
await page.evaluate(() => document.getElementById('featured-week').scrollIntoView({ block: 'start', behavior: 'instant' }));
await page.waitForTimeout(700);
await page.screenshot({ path: `${SHOTS}/02-cards-dark.png` });

// 3. desktop dark — resources + tip + footer + floor
await page.evaluate(() => { const s = document.querySelectorAll('section')[1]; s.scrollIntoView({ block: 'start', behavior: 'instant' }); });
await page.waitForTimeout(700);
await page.screenshot({ path: `${SHOTS}/03-resources-dark.png` });
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(700);
await page.screenshot({ path: `${SHOTS}/04-footer-dark.png` });

// 4. desktop light — hero + cards
await page.evaluate(() => { document.documentElement.setAttribute('data-theme', 'light'); try { localStorage.setItem('cmc-theme', 'light'); } catch (e) {} });
await page.waitForTimeout(700);
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(500);
await page.screenshot({ path: `${SHOTS}/05-hero-light.png` });
await page.evaluate(() => document.getElementById('featured-week').scrollIntoView({ block: 'start', behavior: 'instant' }));
await page.waitForTimeout(600);
await page.screenshot({ path: `${SHOTS}/06-cards-light.png` });
await ctx.close();

// 5. mobile dark — hero + cards
const ctxM = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
await ctxM.route('**firestore.googleapis.com**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
await ctxM.addInitScript(seed);
const pageM = await ctxM.newPage();
await pageM.goto(`${BASE}/biweek-planner/`, { waitUntil: 'networkidle' });
await pageM.waitForTimeout(1200);
await pageM.screenshot({ path: `${SHOTS}/07-hero-mobile.png` });
await pageM.evaluate(() => document.getElementById('featured-week').scrollIntoView({ block: 'start', behavior: 'instant' }));
await pageM.waitForTimeout(600);
await pageM.screenshot({ path: `${SHOTS}/08-cards-mobile.png` });
const ov = await pageM.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
console.log('mobile overflowX delta:', ov);
await ctxM.close();

await browser.close(); server.close();
console.log('shots done');
