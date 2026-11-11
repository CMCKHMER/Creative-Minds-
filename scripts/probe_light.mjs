// Probe: what does the consolebar + panel-head compute to in LIGHT mode?
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
const DIST = '/home/z/my-project/tmp/cmc-site/dist';
const PORT = 8925; const BASE = `http://127.0.0.1:${PORT}`;
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
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
await ctx.route('**firestore.googleapis.com**', r => r.abort());
await ctx.addInitScript(TEACHER_KEYS + `;try{localStorage.setItem('cmc-theme','light');document.documentElement.classList.add('light');}catch(e){}`);
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
for (let i = 0; i < 40; i++) {
  const found = await page.evaluate(() => !!document.getElementById('firebase-dashboard'));
  if (found) break;
  await page.evaluate(() => window.scrollBy(0, 900));
  await page.waitForTimeout(300);
}
await page.waitForTimeout(800);
const info = await page.evaluate(() => {
  const sec = document.getElementById('firebase-dashboard');
  const bar = sec.querySelector('.cmcdc-consolebar');
  const cs = getComputedStyle(bar);
  const r = bar.getBoundingClientRect();
  const head = sec.querySelector('.cmcdc-panel-head');
  return {
    barRect: { top: Math.round(r.top), h: Math.round(r.height) },
    barBg: cs.background.slice(0, 140),
    barDisplay: cs.display,
    sectionTop: Math.round(sec.getBoundingClientRect().top),
    headColor: getComputedStyle(head).color,
  };
});
console.log(JSON.stringify(info, null, 1));
await browser.close(); server.close();
