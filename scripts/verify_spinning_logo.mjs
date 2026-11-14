// Spinning logo verification — the teacher's 360° spin video
// (upload/spining_360_vertical_60036c59.mp4) cut down to ONLY the coin via
// scripts/make_spinning_logo.py (640×640 crop at (49,313) around the disc at
// center (369,633), d≈580, measured from rim-run geometry after the first cut
// at (42,258)/(362,578) sat 55px too high and left an uneven black ring —
// owner: "center logo so black back ground looks even with logo center";
// even ~28px ring on all four sides; the small "Dola AI" watermark's top edge
// lies outside the 320px circle mask and is blacked out in the encode; audio
// stripped; 190-frame loop; 288×288 webm+mp4+poster) and swapped in as the
// official logo everywhere the old cmc-m-logo.png image rendered (Navbar
// 56px, Footer 46px) through SpinLogo.tsx — a circular medallion that
// autoplays muted+loop and freezes on the face-on poster frame under
// prefers-reduced-motion.
import { chromium } from 'playwright';
import { readFile, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
const pexec = promisify(execFile);
const DIST = '/home/z/my-project/tmp/cmc-site/dist';
const PORT = 8961; const BASE = `http://127.0.0.1:${PORT}`;
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, BASE).pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = normalize(join(DIST, p));
    const data = await readFile(file);
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.webm': 'video/webm', '.mp4': 'video/mp4', '.webmanifest': 'application/manifest+json' };
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(PORT, r));
const browser = await chromium.launch({ headless: true });
const results = [];
const ok = (name, cond, detail) => results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);

/* ---- A. assets: cut correctly, loop, no audio ---- */
const IMG = '/home/z/my-project/tmp/cmc-site/public/images';
for (const [f, min] of [['cmc-spin-logo.webm', 100000], ['cmc-spin-logo.mp4', 100000], ['cmc-spin-logo-poster.jpg', 5000]]) {
  const s = await stat(`${IMG}/${f}`).catch(() => null);
  ok(`asset exists: ${f}`, !!s && s.size > min, s ? `${s.size} bytes` : 'missing');
}
for (const f of ['cmc-spin-logo.webm', 'cmc-spin-logo.mp4']) {
  const { stdout } = await pexec('ffprobe', ['-v', 'error', '-show_entries',
    'stream=codec_name,width,height,codec_type', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1', `${IMG}/${f}`]);
  ok(`${f}: 288×288 video-only`, stdout.includes('width=288') && stdout.includes('height=288') && !stdout.includes('codec_type=audio'), stdout.replace(/\n/g, ' · '));
  const dur = Number((stdout.match(/duration=([\d.]+)/) || [])[1]);
  ok(`${f}: ~7.9s full spin loop`, dur > 7.8 && dur < 8.0, String(dur));
}
// watermark + centering checks on the poster (288²):
// (1) the small "Dola AI" watermark's corner (poster x 246-288, y 270-288)
// is blacked out in the encode AND lies outside the 144px circle mask —
// pin it fully dark; (2) the disc must be CENTERED in the frame (owner:
// "center logo so black back ground looks even with logo center") — the
// bright-mass bbox (>120) center must sit within ±12px of (144,144);
// the old (42,258) crop failed this with the disc ~25px low.
{
  const { stdout } = await pexec('ffmpeg', ['-v', 'error', '-i', `${IMG}/cmc-spin-logo-poster.jpg`,
    '-vf', 'crop=42:18:246:270,format=gray', '-f', 'rawvideo', '-pix_fmt', 'gray', '-']);
  let bright = 0;
  for (const b of stdout) if (b > 210) bright++;
  ok('poster corner: watermark zone blacked out', bright < 20, `${bright} bright px of ${stdout.length}`);
}
{
  const { stdout } = await pexec('ffmpeg', ['-v', 'error', '-i', `${IMG}/cmc-spin-logo-poster.jpg`,
    '-vf', 'format=gray', '-f', 'rawvideo', '-pix_fmt', 'gray', '-']);
  const buf = stdout;
  let x0 = 288, y0 = 288, x1 = 0, y1 = 0;
  for (let y = 0; y < 288; y++) for (let x = 0; x < 288; x++) {
    if (buf[y * 288 + x] > 120) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  ok('disc centered in the frame (even black ring)', Math.abs(cx - 144) <= 12 && Math.abs(cy - 144) <= 12,
    `bright bbox center (${cx.toFixed(0)},${cy.toFixed(0)}) — must be (144±12,144±12)`);
}

/* ---- B. source pins: SpinLogo + swaps ---- */
const spin = await readFile('/home/z/my-project/tmp/cmc-site/src/components/SpinLogo.tsx', 'utf8');
ok('SpinLogo: webm + mp4 sources', spin.includes('cmc-spin-logo.webm') && spin.includes('cmc-spin-logo.mp4'));
ok('SpinLogo: autoplay loop muted playsInline', /autoPlay=\{spin\}/.test(spin) && /loop=\{spin\}/.test(spin) && spin.includes('muted') && spin.includes('playsInline'));
ok('SpinLogo: circular medallion mask', spin.includes('rounded-full object-cover'));
ok('SpinLogo: reduced-motion freezes on poster', spin.includes("matchMedia('(prefers-reduced-motion: reduce)')") && spin.includes('cmc-spin-logo-poster.jpg'));
ok('SpinLogo: hidden from AT (aria-hidden)', spin.includes('aria-hidden="true"'));
const nav = await readFile('/home/z/my-project/tmp/cmc-site/src/components/Navbar.tsx', 'utf8');
const foot = await readFile('/home/z/my-project/tmp/cmc-site/src/components/Footer.tsx', 'utf8');
ok('Navbar renders SpinLogo at 56px (owner: "might need to make it larger")', nav.includes('<SpinLogo size={56} className="w-[56px] h-[56px]" />'));
ok('Footer renders SpinLogo at 46px', foot.includes('<SpinLogo size={46} className="w-[46px] h-[46px]" />'));
ok('image logo gone from React sources', !nav.includes('cmc-m-logo') && !foot.includes('cmc-m-logo'));
ok('favicon intentionally still the PNG monogram', (await readFile('/home/z/my-project/tmp/cmc-site/index.html', 'utf8')).includes('./icons/favicon-64.png'));

/* ---- C. browser: it plays, it's round, it loops, both themes, mobile ---- */
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/`, { waitUntil: 'load' });
const header = page.locator('header video').first();
await header.waitFor({ timeout: 8000 });
ok('header video is the spin asset', (await header.evaluate(v => v.currentSrc)).includes('cmc-spin-logo'));
ok('header video decodes 288×288', await header.evaluate(v => v.videoWidth === 288 && v.videoHeight === 288));
await page.waitForTimeout(1300);
const t1 = await header.evaluate(v => v.currentTime);
await page.waitForTimeout(800);
const t2 = await header.evaluate(v => v.currentTime);
ok('header video is PLAYING', t2 > t1, `${t1.toFixed(2)} → ${t2.toFixed(2)}s`);
ok('header video muted + looping', await header.evaluate(v => v.muted && v.loop));
const box = await header.boundingBox();
ok('renders at the 56px slot', Math.abs(box.width - 56) < 2 && Math.abs(box.height - 56) < 2, `${box.width}×${box.height}`);
ok('circular mask applied', (await header.evaluate(v => getComputedStyle(v).borderRadius)) !== '0px');
// light theme: the medallion is self-contained (video element, no remaps touch it)
await page.evaluate(() => document.documentElement.classList.add('light'));
await page.waitForTimeout(400);
ok('still playing in light mode', await header.evaluate(v => !v.paused || v.currentTime > 0));
await page.evaluate(() => document.documentElement.classList.remove('light'));
// footer
const footerV = page.locator('footer video').first();
await footerV.scrollIntoViewIfNeeded();
ok('footer video present + same asset', (await footerV.evaluate(v => v.currentSrc)).includes('cmc-spin-logo'));
await page.screenshot({ path: '/home/z/my-project/tmp/cmc-site/scripts/qa/spin-logo-header.png', clip: { x: 0, y: 0, width: 480, height: 80 } });
// mobile: no overflow, header intact
await page.setViewportSize({ width: 393, height: 850 });
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(600);
const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth - document.documentElement.clientWidth);
ok('mobile 393px: no horizontal overflow', overflow <= 1, `${overflow}px`);
await page.screenshot({ path: '/home/z/my-project/tmp/cmc-site/scripts/qa/spin-logo-mobile.png', clip: { x: 0, y: 0, width: 393, height: 70 } });
// reduced motion: video does not spin (poster frame shows instead)
const rctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const rpage = await rctx.newPage();
await rpage.goto(`${BASE}/`, { waitUntil: 'load' });
const rv = rpage.locator('header video').first();
await rv.waitFor({ timeout: 8000 });
await rpage.waitForTimeout(900);
const ra = await rv.evaluate(v => ({ paused: v.paused, t: v.currentTime, poster: v.poster }));
ok('reduced motion: video not spinning', ra.paused || ra.t < 0.15, JSON.stringify(ra));
ok('reduced motion: poster frame set', ra.poster.includes('cmc-spin-logo-poster'));

await browser.close();
server.close();
console.log(`\nverify_spinning_logo: ${results.filter(r => r.startsWith('PASS')).length} passed, ${results.filter(r => r.startsWith('FAIL')).length} failed`);
results.filter(r => r.startsWith('FAIL')).forEach(r => console.log(r));
process.exit(results.some(r => r.startsWith('FAIL')) ? 1 : 0);
