import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const DIST = '/home/z/my-project/tmp/cmc-site/dist';
const PORT = 8948; const BASE = `http://127.0.0.1:${PORT}`;
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, BASE).pathname);
    if (p.endsWith('/')) p += 'index.html';
    const data = await readFile(normalize(join(DIST, p)));
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg' };
    res.writeHead(200, { 'Content-Type': types[extname(p)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(PORT, r));
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
await ctx.route('**firestore.googleapis.com**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
await ctx.addInitScript(`try{localStorage.setItem('cmc-student-token','t');localStorage.setItem('cmc-student-role','teacher');localStorage.setItem('cmc-student-uid','u');localStorage.setItem('cmc-student-name','T');localStorage.setItem('cmc-student-email','t@e.edu');localStorage.setItem('cmc-theme','light');}catch(e){}`);
const page = await ctx.newPage();
await page.goto(`${BASE}/biweek-planner/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.screenshot({ path: '/home/z/my-project/tmp/cmc-site/scripts/qa/hud/05b-hero-light.png' });
await browser.close(); server.close();
console.log('light hero shot done');
