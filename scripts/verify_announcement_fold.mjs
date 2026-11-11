// Verify the compact announcement feed (owner request: "any post that exceeds
// the original content window should be folded with a read more option — keeps
// the hero page compact and scrolling to a minimum").
//
//   - Announcements section (#announcements, first content section on the
//     homepage) is fed two mocked Firestore docs: one LONG post (~4k chars)
//     and one SHORT post.
//   - Long post  → folded to a 600px content window with a bottom fade and a
//     "Read more" button; clicking expands it ("Show less" folds it back).
//   - Short post → rendered exactly as before: no fold, no button.
//   - Admin action row stays visible below the fold region (not rendered here:
//     viewer is not an approved admin).
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { mkdirSync } from 'node:fs';

const DIST = '/home/z/my-project/tmp/cmc-site/dist';
const PORT = 8947; const BASE = `http://127.0.0.1:${PORT}`;
mkdirSync('/home/z/my-project/tmp/cmc-site/scripts/qa', { recursive: true });
const SHOTS = '/home/z/my-project/tmp/cmc-site/scripts/qa';

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, BASE).pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = normalize(join(DIST, p));
    const data = await readFile(file);
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg' };
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(PORT, r));

// Long post body: many paragraphs → far taller than the 600px window.
const longBody = Array.from({ length: 26 }, (_, i) =>
  `Paragraph ${i + 1}. Games in the classroom are a double-edged sword — the chocolate-covered broccoli problem. ` +
  'A well-designed drill rewards the exact skill the lesson targets, while a poorly designed one rewards guessing. ' +
  'At Creative Minds we ship drills with timers, auto-scoring and teacher-visible attempt logs, so the play is always measurable.').join('\n\n');

const doc = (id, fields) => ({
  name: `projects/demo/databases/(default)/documents/announcements/${id}`,
  fields,
  createTime: '2025-12-06T03:21:00.000000Z',
  updateTime: '2025-12-06T03:21:00.000000Z',
});
const str = (s) => ({ stringValue: s });
const payload = {
  documents: [
    doc('post-short', {
      title: str('Happy Halloween everyone!'),
      body: str('Costume party at the Aii CAP campus on Friday — bring your favourite English monster pun.'),
      imageUrl: str(''),
      pinned: { booleanValue: false },
      authorName: str('Creative Minds'),
      authorUid: str('u1'),
      authorEmail: str('news@cmc.edu.kh'),
      createdAt: { timestampValue: '2025-10-31T02:00:00Z' },
      updatedAt: { timestampValue: '2025-10-31T02:00:00Z' },
    }),
    doc('post-long', {
      title: str('Is games always good in teaching?'),
      body: { stringValue: longBody },
      imageUrl: str(''),
      pinned: { booleanValue: false },
      authorName: str('Creative Minds'),
      authorUid: str('u1'),
      authorEmail: str('news@cmc.edu.kh'),
      createdAt: { timestampValue: '2025-12-06T03:21:00Z' },
      updatedAt: { timestampValue: '2025-12-06T03:21:00Z' },
    }),
  ],
};

const browser = await chromium.launch({ headless: true });
const results = [];
const ok = (name, cond, detail) => results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);

const ctx = await browser.newContext({ viewport: { width: 1200, height: 1000 } });
await ctx.addInitScript(() => { try { localStorage.setItem('cmc-theme', 'dark'); } catch (e) {} });
await ctx.route('**googletagmanager.com**', r => r.abort());
await ctx.route('**google-analytics.com**', r => r.abort());
await ctx.route('**fonts.googleapis.com**', r => r.abort());
await ctx.route('**fonts.gstatic.com', r => r.abort());
await ctx.route('**firebaseinstallations.googleapis.com**', r => r.abort());
await ctx.route('**securetoken.googleapis.com**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
await ctx.route('**firestore.googleapis.com**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
// Registered LAST → wins over the generic fulfill for the announcements list URL.
await ctx.route('**/documents/announcements?*', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) }));

const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message.slice(0, 140)));
await page.goto(`${BASE}/`, { waitUntil: 'load' });
await page.waitForTimeout(2200);

// Progressive scroll: LazyMount mounts the board when the viewport nears it.
for (let i = 0; i < 40; i++) {
  const found = await page.evaluate(() => {
    const el = document.getElementById('announcements');
    if (el) { el.scrollIntoView({ block: 'start', behavior: 'instant' }); return true; }
    window.scrollBy({ top: 900, behavior: 'instant' });
    return false;
  });
  if (found) break;
  await page.waitForTimeout(450);
}
await page.waitForSelector('#announcements article', { timeout: 20000 });
await page.waitForTimeout(1000);

const articles = page.locator('#announcements article');
const count = await articles.count();
ok('two mocked posts rendered', count === 2, `count=${count}`);

const long = page.locator('#announcements article', { hasText: 'Is games always good in teaching?' });
const short = page.locator('#announcements article', { hasText: 'Happy Halloween everyone!' });

const longFold = long.locator('div[style*="max-height"]').first();
const longFolded = await longFold.count() > 0;
ok('long post folded to a content window (max-height cap)', longFolded);
if (longFolded) {
  const style = await longFold.evaluate(el => ({ mh: el.style.maxHeight, ov: getComputedStyle(el).overflow }));
  ok('fold window is the 600px original-content cap', style.mh === '600px', `maxHeight=${style.mh}`);
  ok('fold window hides overflow', style.ov === 'hidden', style.ov);
  const visH = await longFold.evaluate(el => el.clientHeight);
  ok('collapsed card is compact (clientHeight ≤ 605px)', visH > 0 && visH <= 605, `clientHeight=${visH}px`);
}

const longBtn = long.getByRole('button', { name: 'Read more' });
ok('long post shows a "Read more" control', await longBtn.count() === 1);
const shortBtnCount = await short.getByRole('button', { name: 'Read more' }).count();
const shortFoldCount = await short.locator('div[style*="max-height"]').count();
ok('short post unfolded (no cap, no button)', shortBtnCount === 0 && shortFoldCount === 0);

await page.screenshot({ path: `${SHOTS}/announcements-folded.png` });

// Expand
await longBtn.click();
await page.waitForTimeout(350);
const expandedFold = await long.locator('div[style*="max-height"]').count();
const showLess = long.getByRole('button', { name: 'Show less' });
ok('Read more expands the post (cap removed)', expandedFold === 0);
ok('expanded post offers "Show less"', await showLess.count() === 1);
const expandedH = await long.evaluate(el => el.scrollHeight);
ok('expanded content is the full 4k-char body (well past 600px)', expandedH > 900, `scrollHeight=${expandedH}px`);
await page.screenshot({ path: `${SHOTS}/announcements-expanded.png` });

// Fold back
await showLess.click();
await page.waitForTimeout(350);
const refolded = await long.locator('div[style*="max-height"]').count();
const readMoreBack = long.getByRole('button', { name: 'Read more' });
ok('Show less folds the post back to the window', refolded === 1 && await readMoreBack.count() === 1);

// Fade gradient present while collapsed
const fade = await long.locator('div[style*="max-height"] > div[aria-hidden="true"]').count();
ok('collapsed post has the soft bottom fade', fade >= 1);

ok('announcements no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
await ctx.close();

await browser.close(); server.close();
console.log(results.join('\n'));
const fails = results.filter(r => r.startsWith('FAIL')).length;
console.log(`\n${results.length - fails}/${results.length} checks passed`);
process.exit(fails ? 1 : 0);
