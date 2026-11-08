/* Dist smoke: serve dist/, load the main page + studio in headless Chromium,
   and fail on any pageerror or console error. */
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('/home/z/.npm-global/lib/node_modules/playwright');

const DIST = resolve(process.argv[2] || 'dist');
const PORT = 8125;
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.mp4': 'video/mp4',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.woff2': 'font/woff2',
};

const server = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  let file = join(DIST, p);
  if (!existsSync(file) && existsSync(file + '.html')) file = file + '.html';
  if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end('nope'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream' });
  res.end(readFileSync(file));
});

const pages = ['/', '/studio/', '/biweek-planner/'];
const failures = [];

await new Promise((ok) => server.listen(PORT, ok));
const browser = await chromium.launch();

for (const pagePath of pages) {
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  try {
    await page.goto(`http://127.0.0.1:${PORT}${pagePath}`, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(2500);
  } catch (e) {
    errs.push('navigation: ' + e.message);
  }
  if (errs.length) failures.push({ pagePath, errs });
  console.log(`${pagePath} → ${errs.length ? 'FAIL' : 'clean'}`);
  for (const e of errs.slice(0, 6)) console.log('   ', e);
  await page.close();
}

await browser.close();
server.close();
if (failures.length) { console.log('SMOKE FAILED'); process.exit(1); }
console.log('SMOKE CLEAN');
