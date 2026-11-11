// Verify the Kid 11 online-homework feature (owner request: "add this to the
// Kid 11 card as online homework section. need for this to be abled to be
// shared as homework, and a student completion submit button").
//
//   - public/rfc3/doctor-fish.html — faithful transcription of the teacher's
//     Unit 14 "Doctor Fish" live worksheet: all 30 auto-graded questions with
//     the original answer key, plus a Submit-to-Teacher completion button and
//     a Share menu (Copy Link / WhatsApp / Telegram / Email) and back-to-CMC.
//   - The completion submit POSTs to the public drill_attempts collection:
//     guest branch (studentUid '', name 1–40 chars, classId null, no
//     inviteMode key) when the visitor is not signed in — intercepted here
//     and field-checked; signed-in flow reuses cmc-student-token.
//   - Kid 11 card: own "Online homework" section with an Open link and a
//     Share button (native sheet → clipboard fallback, "Link copied" check
//     icon), driven by the new 'Online homework' material kind.
import { chromium } from 'playwright';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { mkdirSync } from 'node:fs';

const DIST = '/home/z/my-project/tmp/cmc-site/dist';
const PORT = 8951; const BASE = `http://127.0.0.1:${PORT}`;
mkdirSync('/home/z/my-project/tmp/cmc-site/scripts/qa', { recursive: true });
const SHOTS = '/home/z/my-project/tmp/cmc-site/scripts/qa';

let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => {
  if (cond) { pass++; console.log(`  ok  ${label}`); }
  else { fail++; console.log(`FAIL  ${label}${extra ? ' — ' + extra : ''}`); }
};

// ── static server over dist/ ─────────────────────────────────────────────
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, BASE).pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = normalize(join(DIST, p));
    const data = await readFile(file);
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(PORT, r));

// ── 1. static checks on the worksheet build ──────────────────────────────
console.log('static · dist/rfc3/doctor-fish.html');
let ws = '';
try { ws = await readFile(join(DIST, 'rfc3/doctor-fish.html'), 'utf8'); } catch {}
ok(ws.length > 20000, 'worksheet shipped into dist/ (non-trivial size)', `${ws.length} bytes`);

const answers = [...ws.matchAll(/data-answer="([^"]+)"/g)].map(m => m[1]);
// The teacher's original answer key — transcription must match EXACTLY.
const KEY = ['h','b','d','f','a','e','c','g', 'a','b','a','b','a','b', 'T','T','F','F','T', 'in particular','spring','treat','nutrients|nutrient','surround','suffering from|suffer from','severe','permanent', 'thus','moreover','in particular'];
ok(answers.length === 30 && JSON.stringify(answers) === JSON.stringify(KEY), 'all 30 graded questions present with the teacher answer key intact', `got ${answers.length}: ${answers.join(',')}`);

for (const [needle, label] of [
  ['Submit to Teacher', 'submit-to-teacher button present'],
  ['function submitCompletion', 'completion submit handler present'],
  ['documents/drill_attempts', 'posts to the drill_attempts pipeline'],
  ["drillSource: { stringValue: 'rfc3' }", 'drillSource rfc3 (Kid 11 book source)'],
  ["drillSlug:   { stringValue: 'doctor-fish.html' }", 'drillSlug pinned to doctor-fish.html'],
  ['cmc-student-token', 'signed-in students submit under their session token'],
  ['cmc-student-refresh-token', 'expired sessions refresh via securetoken'],
  ['classId:       { nullValue: null }', 'classId null (guest-branch compliant)'],
  ["studentUid:  { stringValue: uid }", 'studentUid empty for guests / real uid signed-in'],
  ['Add your name first', 'name gate before submit'],
  ['Back to CMC', 'back-to-CMC button (rfc3 worksheet pattern)'],
  ['wa.me', 'share: WhatsApp'],
  ['t.me/share', 'share: Telegram'],
  ['mailto:', 'share: Email'],
  ['cmcCopyLink', 'share: copy link'],
]) ok(ws.includes(needle), label);
ok(!ws.includes('inviteMode'), 'no inviteMode key (rules notInviteMode guard satisfied)');
ok(!/TODO|XXX|【/.test(ws), 'no leftover placeholders');

// ── 2. Kid 11 card bundle carries the homework section ───────────────────
console.log('static · KidGradeHub bundle');
const assets = await readdir(join(DIST, 'assets'));
const hubChunk = assets.find((f) => f.startsWith('KidGradeHub-') && f.endsWith('.js'));
ok(!!hubChunk, 'KidGradeHub chunk exists in dist/assets');
if (hubChunk) {
  const hub = await readFile(join(DIST, 'assets', hubChunk), 'utf8');
  ok(hub.includes('Online homework'), 'Online homework section in the Kid 11 card bundle');
  ok(hub.includes('doctor-fish.html'), 'Kid 11 card links the Doctor Fish worksheet');
  ok(hub.includes('Submit to Teacher'), 'card copy explains the submit button');
  ok(hub.includes('Share '), 'share button on the homework row');
}

// ── 3. worksheet behavior in a real browser ──────────────────────────────
console.log('browser · worksheet');
const submits = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
const page = await ctx.newPage();
await page.route('**firestore.googleapis.com/**', (route) => route.abort());
await page.route('**/documents/drill_attempts*', async (route) => {
  const req = route.request();
  submits.push({ headers: req.headers(), body: JSON.parse(req.postData() || '{}') });
  await route.fulfill({ status: 200, contentType: 'application/json', body: '{"name":"projects/demo/databases/(default)/documents/drill_attempts/verify"}' });
});
await page.goto(`${BASE}/rfc3/doctor-fish.html`, { waitUntil: 'load' });

ok((await page.title()).includes('Doctor Fish'), 'worksheet page loads with its own title');
ok(await page.locator('[data-answer]').count() === 30, '30 graded questions render in the DOM');
ok(await page.locator('#cmc-back-btn').count() === 1, 'back-to-CMC button renders');
ok(await page.locator('#results').isHidden(), 'results card hidden before checking');

// Name gate: submitting without a name must not fire any network call.
await page.locator('#submitBtn').click();
await page.waitForTimeout(400);
const toast = await page.locator('#cmcToast').textContent();
ok(!!toast && toast.includes('Add your name first'), 'empty name → warning toast, no submit', `toast="${toast}"`);
ok(submits.length === 0, 'no Firestore POST without a name');

// Check Answers with nothing filled → 0/30.
await page.getByRole('button', { name: 'Check Answers' }).click();
await page.waitForTimeout(300);
ok((await page.locator('#scoreNum').textContent())?.trim() === '0 / 30  (0%)', 'check with blanks scores 0 / 30 (0%)');
ok(await page.locator('#results').isVisible(), 'results card shows after checking');

// Guest completion submit → intercepted payload field-checked.
await page.fill('#stuName', 'Dara Verify');
await page.locator('#submitBtn').click();
await page.waitForFunction(() => document.getElementById('submitBtn')?.textContent?.includes('Submitted to teacher'), null, { timeout: 8000 }).catch(() => {});
ok(submits.length === 1, 'completion POST fired exactly once', `${submits.length}`);
if (submits.length === 1) {
  const f = submits[0].body.fields || {};
  const v = (k) => f[k] && (f[k].stringValue ?? f[k].integerValue ?? f[k].timestampValue);
  ok(v('drillSlug') === 'doctor-fish.html', 'payload drillSlug', JSON.stringify(f.drillSlug));
  ok(v('drillTitle') === 'Unit 14 · Doctor Fish', 'payload drillTitle', JSON.stringify(f.drillTitle));
  ok(v('drillSource') === 'rfc3', 'payload drillSource rfc3');
  ok(v('studentName') === 'Dara Verify', 'payload studentName');
  ok(v('studentUid') === '', 'payload studentUid empty (guest branch)');
  ok(v('scorePct') === '0' && v('correctCount') === '0' && v('totalCount') === '30', 'payload score 0/30 → pct 0');
  ok(f.classId && f.classId.nullValue === null, 'payload classId null');
  ok(!!v('submittedAt'), 'payload submittedAt timestamp');
  ok(!('inviteMode' in (submits[0].body.fields || {})), 'payload carries no inviteMode key');
  ok(!submits[0].headers['authorization'], 'guest POST sends no Authorization header');
}

// Perfect run → 30/30, resubmit records the better score (append-only feed).
await page.evaluate(() => {
  document.querySelectorAll('[data-answer]').forEach((q) => {
    const key = q.getAttribute('data-answer').split('|')[0];
    const sel = q.querySelector('select'); if (sel) { sel.value = key; return; }
    const inp = q.querySelector('input'); if (inp) { inp.value = key; return; }
    const b = q.querySelector(`button[data-val="${key}"]`); if (b) b.click();
  });
});
await page.getByRole('button', { name: 'Check Answers' }).click();
await page.waitForTimeout(300);
ok((await page.locator('#scoreNum').textContent())?.trim() === '30 / 30  (100%)', 'correct run scores 30 / 30 (100%)');
await page.locator('#submitBtn').click();
await page.waitForTimeout(900);
const last = submits.at(-1);
ok(submits.length === 2 && last && last.body.fields.correctCount?.integerValue === '30' && last.body.fields.scorePct?.integerValue === '100', 're-submit records the 30/30 completion');

// Share menu → Copy Link puts the homework URL on the clipboard.
await page.locator('.bar .ghost', { hasText: 'Share' }).click();
await page.waitForTimeout(250);
ok(await page.locator('#cmcShare').evaluate((el) => el.classList.contains('open')), 'share menu opens (no native share sheet on desktop)');
await page.locator('#cmcShare button', { hasText: 'Copy Link' }).click();
await page.waitForTimeout(350);
const clip = await page.evaluate(() => navigator.clipboard.readText());
ok(clip.endsWith('/rfc3/doctor-fish.html'), 'copy-link puts the homework URL on the clipboard', clip);

await page.screenshot({ path: join(SHOTS, 'doctor-fish-submitted.png'), fullPage: false });
await ctx.close();

// ── 4. Kid 11 card on the SPA ────────────────────────────────────────────
console.log('browser · Kid 11 card');
const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx2.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
const page2 = await ctx2.newPage();
await page2.route('**firestore.googleapis.com/**', (route) => route.abort());
await page2.goto(`${BASE}/`, { waitUntil: 'load' });
await page2.waitForTimeout(1200);
await page2.evaluate(() => {
  const el = document.getElementById('kid-grades');
  if (el) el.scrollIntoView({ block: 'center', behavior: 'instant' });
  else window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' });
});
await page2.waitForSelector('#kid-grades article', { timeout: 20000 });
await page2.waitForFunction(() => document.body.textContent?.includes('Online homework'), null, { timeout: 15000 });
await page2.waitForTimeout(600);

const kid11card = page2.locator('#kid-grades article').filter({ hasText: 'Reading Future Create 3' });
ok(await kid11card.count() === 1, 'Kid 11 card renders with its book heading');
ok((await kid11card.textContent())?.includes('5 resources'), 'Kid 11 badge counts the homework (5 resources)');
const hwLink = kid11card.locator('a[aria-label*="homework: Doctor Fish"]');
ok(await hwLink.count() === 1, 'Online homework row has an Open link for the Doctor Fish worksheet');
ok((await hwLink.getAttribute('href'))?.endsWith('/rfc3/doctor-fish.html'), 'homework link points at the worksheet');
ok((await kid11card.textContent())?.includes('Submit to Teacher'), 'card explains the completion submit button');
const shareBtn = kid11card.locator('button[aria-label^="Share Doctor Fish"]');
ok(await shareBtn.count() === 1, 'homework row has its own Share button');
await shareBtn.click();
await page2.waitForTimeout(500);
const clip2 = await page2.evaluate(() => navigator.clipboard.readText().catch(() => ''));
ok(clip2.endsWith('/rfc3/doctor-fish.html'), 'card Share button copies the absolute homework URL (clipboard fallback)', clip2);
ok(await shareBtn.locator('svg.lucide-check').count() === 1, 'share button flips to the check icon after copying');
await kid11card.screenshot({ path: join(SHOTS, 'doctor-fish-kid11-card.png') });
await ctx2.close();
await browser.close();
server.close();

console.log(`\nverify_doctor_fish: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
