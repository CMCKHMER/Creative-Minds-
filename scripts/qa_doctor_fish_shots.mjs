// Visual-check screenshots for the rebuilt Kid 11 homework page.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { mkdirSync } from 'node:fs';

const DIST = '/home/z/my-project/tmp/cmc-site/dist';
const PORT = 8953; const BASE = `http://127.0.0.1:${PORT}`;
const SHOTS = '/home/z/my-project/tmp/cmc-site/scripts/qa';
mkdirSync(SHOTS, { recursive: true });

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, BASE).pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = normalize(join(DIST, p));
    const data = await readFile(file);
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(PORT, r));

const HW_ROUTE = '**/documents/biweekly_tests/hw-kid11-doctor-fish*';
const hwDoc = JSON.stringify({ fields: { shared: { booleanValue: true } } });

const browser = await chromium.launch();

// Desktop, open homework — top of page (hero + assignment A start).
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
await page.route(HW_ROUTE, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: hwDoc }));
await page.goto(`${BASE}/rfc3/doctor-fish.html`, { waitUntil: 'load' });
await page.waitForTimeout(800);
await page.locator('#stuName').scrollIntoViewIfNeeded().catch(() => {});
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(300);
await page.screenshot({ path: join(SHOTS, 'visual-hero-top.png') });
// typed text in the hero inputs (the reported bug: text could not be seen)
await page.locator('#stuName').fill('Sokha Chan');
await page.locator('#stuDate').fill('11 Nov 2026');
await page.waitForTimeout(200);
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(200);
await page.screenshot({ path: join(SHOTS, 'visual-hero-typed.png') });
// full page overview
await page.screenshot({ path: join(SHOTS, 'visual-full.png'), fullPage: true });
await ctx.close();

// Mobile, open homework.
const mctx = await browser.newContext({ viewport: { width: 393, height: 852 } });
const mpage = await mctx.newPage();
await mpage.route(HW_ROUTE, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: hwDoc }));
await mpage.goto(`${BASE}/rfc3/doctor-fish.html`, { waitUntil: 'load' });
await mpage.waitForTimeout(800);
await mpage.evaluate(() => window.scrollTo(0, 0));
await mpage.waitForTimeout(200);
await mpage.screenshot({ path: join(SHOTS, 'visual-mobile-top.png') });
const overflow = await mpage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
console.log('mobile horizontal overflow px:', overflow);
await mctx.close();

// Locked state (student, not shared).
const lctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const lpage = await lctx.newPage();
await lpage.route(HW_ROUTE, (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
await lpage.goto(`${BASE}/rfc3/doctor-fish.html`, { waitUntil: 'load' });
await lpage.waitForSelector('#hwGate', { timeout: 8000 });
await lpage.waitForTimeout(300);
await lpage.screenshot({ path: join(SHOTS, 'visual-locked.png') });
await lctx.close();

await browser.close();
server.close();
console.log('screenshots done');
