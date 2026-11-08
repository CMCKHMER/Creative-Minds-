/* Visual check: screenshots of the hero (video) and studio docs (menu + handles). */
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('/home/z/.npm-global/lib/node_modules/playwright');

const DIST = resolve(process.argv[2] || 'dist');
const PORT = 8129;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp4': 'video/mp4', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = join(DIST, p);
  if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end('nope'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((ok) => server.listen(PORT, ok));
const browser = await chromium.launch();

// 1. hero with the looping video
const home = await browser.newPage({ viewport: { width: 1440, height: 860 } });
await home.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load' });
await home.waitForTimeout(2600);
const vid = await home.evaluate(() => { const v = document.querySelector('.cmc-hero-video'); return v ? { t: v.currentTime, paused: v.paused, w: v.videoWidth } : null; });
console.log('hero video state:', JSON.stringify(vid));
await home.screenshot({ path: '/tmp/render/hero_video.png' });
await home.close();

// 2. studio docs: image selected + handles + right-click menu
const st = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await st.goto(`http://127.0.0.1:${PORT}/studio/`, { waitUntil: 'load' });
await st.waitForTimeout(1000);
await st.evaluate(() => window.welcomeChoose('doc'));
await st.waitForTimeout(600);
await st.evaluate(() => {
  const dl = document.getElementById('docLayer');
  dl.focus();
  document.execCommand('insertHTML', false, '<p>Sample paragraph for the smoke screenshot.</p><p><br></p>');
  dl.insertAdjacentHTML('beforeend', '<p><img id="shotImg" class="doc-img" style="width:220px" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAKklEQVR4nO3NMQEAIAzAsIF/z0OGBx4SQm7u7OzMbIAAAQIECBAgQIAAAQIECBAgQIDAxy7VAAGt9nO2AAAAAElFTkSuQmCC" alt=""></p>');
});
await st.evaluate(() => {
  const img = document.getElementById('shotImg');
  if (img) { img.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAKklEQVR4nO3NMQEAIAzAsIF/z0OGBx4SQm7u7OzMbIAAAQIECBAgQIAAAQIECBAgQIDAxy7VAAGt9nO2AAAAAElFTkSuQmCC'; img.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
});
await st.waitForTimeout(400);
await st.evaluate(() => {
  const img = document.getElementById('shotImg');
  if (img) img.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 700, clientY: 420 }));
});
await st.waitForTimeout(400);
await st.screenshot({ path: '/tmp/render/studio_docs_menu.png' });
console.log('screenshots written');
await browser.close();
server.close();
