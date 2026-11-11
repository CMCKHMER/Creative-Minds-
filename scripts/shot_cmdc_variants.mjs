// One-off visual checks for the dashboard HUD skin: light theme + mobile.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
const DIST = '/home/z/my-project/tmp/cmc-site/dist';
const PORT = 8923; const BASE = `http://127.0.0.1:${PORT}`;
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, BASE).pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = normalize(join(DIST, p));
    const data = await readFile(file);
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.png': 'image/png', '.webm': 'video/webm', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json' };
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(PORT, r));
const browser = await chromium.launch({ headless: true });
const TEACHER_KEYS = `try{localStorage.setItem('cmc-student-token','x'.repeat(40));localStorage.setItem('cmc-student-role','teacher');localStorage.setItem('cmc-student-uid','uid-t');localStorage.setItem('cmc-student-name','CmdT');localStorage.setItem('cmc-student-email','t@e.edu');localStorage.setItem('cmc-student-verified','1');localStorage.setItem('cmc-student-token-expires',String(Date.now()+3600000));}catch(e){}`;
async function shoot(ctx, name, width) {
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  for (let i = 0; i < 40; i++) {
    const found = await page.evaluate(() => !!document.getElementById('firebase-dashboard'));
    if (found) break;
    await page.evaluate(() => window.scrollBy(0, 900));
    await page.waitForTimeout(300);
  }
  await page.evaluate(() => document.getElementById('firebase-dashboard')?.scrollIntoView({ behavior: 'instant' }));
  await page.evaluate(() => window.scrollBy(0, -95));
  await page.waitForTimeout(1200);
  const ovf = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log(`${name}: overflow=${ovf}px`);
  await page.screenshot({ path: `/home/z/my-project/scripts/qa/cmcdc-${name}.png` });
  // second shot: the tests panel + scores card area
  await page.evaluate(() => document.querySelector('#firebase-dashboard [data-hud-panel="bw-tests"]')?.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.waitForTimeout(900);
  await page.screenshot({ path: `/home/z/my-project/scripts/qa/cmcdc-${name}-tests.png` });
  await ctx.close();
}
// light theme desktop
const ctxL = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
await ctxL.route('**firestore.googleapis.com**', r => r.abort());
await ctxL.addInitScript(TEACHER_KEYS + `;try{localStorage.setItem('cmc-theme','light');document.documentElement.classList.add('light');}catch(e){}`);
await shoot(ctxL, 'light', 1440);
// mobile dark
const ctxM = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
await ctxM.route('**firestore.googleapis.com**', r => r.abort());
await ctxM.addInitScript(TEACHER_KEYS);
await shoot(ctxM, 'mobile', 390);
await browser.close(); server.close();
console.log('done');
