import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
const DIST = '/home/z/my-project/tmp/cmc-site/dist';
const PORT = 8917; const BASE = `http://127.0.0.1:${PORT}`;
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
for (const [name, theme] of [['grid_dark', 'dark'], ['grid_light', 'light']]) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await ctx.route('**firestore.googleapis.com**', r => r.abort());
  await ctx.addInitScript(`try{localStorage.setItem('cmc-student-token','t');localStorage.setItem('cmc-student-role','teacher');localStorage.setItem('cmc-student-uid','u');localStorage.setItem('cmc-student-name','T');localStorage.setItem('cmc-student-email','t@e.edu');localStorage.setItem('cmc-theme','${theme}');}catch(e){}`);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/biweek-planner/`, { waitUntil: 'networkidle' });
  const grid = await page.$('#schedule-grid');
  await grid.scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0); // park pointer so no card is tilted
  await page.waitForTimeout(400);
  await page.screenshot({ path: `/home/z/my-project/scripts/holo_${name}.png` });
  // hover mid-card for the tilt + projector light shot
  const card = (await page.$$('.week-card'))[2];
  await page.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }), card);
  await page.waitForTimeout(400);
  const box = await card.boundingBox();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.4, { steps: 6 });
  await page.waitForTimeout(350);
  await page.screenshot({ path: `/home/z/my-project/scripts/holo_${name}_tilt.png` });
  await ctx.close();
}
await browser.close(); process.exit(0);
