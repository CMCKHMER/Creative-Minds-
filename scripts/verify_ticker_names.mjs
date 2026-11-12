// Verify the "Gmail sign-ins show emails instead of names on the completion
// ticker" fix (owner report, Nov 2026).
//
// ROOT CAUSE: Google/Gmail sign-ins can return an empty profile displayName
// (supervised child accounts, Workspace directory privacy) and the auth
// layer stored the EMAIL ADDRESS as cmc-student-name; every submit path then
// posted that email as studentName, so the homepage completion ticker (and
// the dashboard feed / game leaderboard) showed raw emails instead of names.
//
// THE FIX (layered):
//   1. auth writes never store an email as the name (firebaseAuth/studentAuth);
//   2. submitScore treats a stored email-as-name as unknown — asks once
//      (pre-filled with the friendly form of the account email) or derives
//      "Mam Ry" from "mam.ry@aii.edu.kh"; a signed-in completion is NEVER
//      dropped and NEVER shows a raw email;
//   3. every static page heals a poisoned stored name at load and guards
//      every read (CMC_NG runtime / cmc-shared.js / worksheet guards);
//   4. display surfaces prettify historical email-named rows (ticker,
//      dashboard feed, game leaderboard).
//
// These checks drive the REAL built pages in dist/ (Playwright) with a
// stubbed Firestore REST transport.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { readdirSync } from 'node:fs';

const DIST = '/home/z/my-project/tmp/cmc-site/dist';
const PORT = 8977; const BASE = `http://127.0.0.1:${PORT}`;
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

// ── shared browser context helpers ───────────────────────────────────────
const JWT = 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({ email_verified: true, email: 'mam.ry@aii.edu.kh', user_id: 'student-uid-1' })).toString('base64url') + '.sig';
const POISONED_SEED = {
  'cmc-student-token': JWT,
  'cmc-student-token-expires': String(Date.now() + 3600_000),
  'cmc-student-refresh-token': 'verify-refresh-token',
  'cmc-student-role': 'student',
  'cmc-student-email': 'mam.ry@aii.edu.kh',
  'cmc-student-uid': 'student-uid-1',
  'cmc-student-name': 'mam.ry@aii.edu.kh', // the pre-fix poisoned value
};
const SHARE_DOC = (doc) => JSON.stringify({
  name: `projects/demo/databases/(default)/documents/biweekly_tests/${doc}`,
  fields: { shared: { booleanValue: true } },
});

/** Block everything external, fulfil the given Firestore shapes, pass 127.0.0.1. */
function makeRouter({ runQueryRows, aggCount, shareDocs = {}, recorded = [], log }) {
  return async (route) => {
    const url = route.request().url();
    if (!url.startsWith('http://127.0.0.1')) {
      // Firestore REST stubs
      if (url.includes(':runQuery')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(runQueryRows || []) });
        return;
      }
      if (url.includes(':runAggregationQuery')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ result: { aggregateFields: { count: { integerValue: String(aggCount ?? 0) } } } }]) });
        return;
      }
      for (const [key, body] of Object.entries(shareDocs)) {
        if (url.includes(`/documents/${key}`) && !url.includes(':runQuery')) {
          await route.fulfill({ status: 200, contentType: 'application/json', body });
          return;
        }
      }
      if (url.includes('ticker_stats')) { await route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":{"code":404}}' }); return; }
      if (route.request().method() === 'POST' && url.includes('/documents/drill_attempts')) {
        recorded.push({
          body: route.request().postDataJSON()?.fields || {},
          auth: route.request().headers()['authorization'] || '',
        });
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ name: 'projects/demo/databases/(default)/documents/drill_attempts/VERIFY1' }) });
        return;
      }
      if (log) log.push(url);
      await route.abort();
      return;
    }
    await route.continue();
  };
}

const browser = await chromium.launch();

// ── 1. static source pins ────────────────────────────────────────────────
console.log('static · source guards');
const read = async (p) => await readFile(join('/home/z/my-project/tmp/cmc-site', p), 'utf8').catch(() => '');

const studentNameTs = await read('src/lib/studentName.ts');
ok(studentNameTs.includes('export function looksLikeEmail'), 'studentName.ts exports looksLikeEmail');
ok(studentNameTs.includes('export function friendlyNameFromEmail'), 'studentName.ts exports friendlyNameFromEmail');
ok(studentNameTs.includes('export function displayStudentName'), 'studentName.ts exports displayStudentName');
ok(studentNameTs.includes('export function selfHealStoredStudentName'), 'studentName.ts exports selfHealStoredStudentName');

const fbAuth = await read('src/lib/firebaseAuth.ts');
ok(/cmc-student-name',\s*\n?\s*session\.displayName \|\| profile\.displayName \|\| ''/.test(fbAuth), 'persistSession stores NO email fallback (firebaseAuth)');
ok(fbAuth.includes('selfHealStoredStudentName()'), 'restoreSession runs the boot self-heal (firebaseAuth)');

const stAuth = await read('src/lib/studentAuth.ts');
ok(stAuth.includes("displayNameOverride || user.displayName || ''"), 'persistSessionFromSdkUser stores NO email fallback (studentAuth)');

const submitScore = await read('src/lib/submitScore.ts');
ok(submitScore.includes("!looksLikeEmail(signedInName)"), 'resolveStudentName rejects email-shaped stored names');
ok(submitScore.includes('displayStudentName(signedInEmail) ||'), 'signed-in fallback derives a friendly name (completion never dropped)');
ok(submitScore.includes("friendlyNameFromEmail(signedInEmail)"), 'prompt is pre-filled with the friendly account name');

const sharedJs = await read('public/assets/js/cmc-shared.js');
ok(sharedJs.includes('cmcHealStoredName()'), 'cmc-shared.js heals the stored name at load');
ok(sharedJs.includes('cmcLooksLikeEmail(name)'), 'CMC.submitDrill refuses email-shaped names');

const fbAuthDist = await readFile(join(DIST, 'index.html'), 'utf8');
const bundleJs = fbAuthDist.match(/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0] || '';
ok(!!bundleJs, 'built index bundle referenced from dist/index.html', bundleJs);
if (bundleJs) {
  const bundle = await readFile(join(DIST, bundleJs), 'utf8');
  ok(bundle.includes('cmc-student-name'), 'built index bundle touches cmc-student-name');
}
// the "Who's playing?" modal ships inside the lazy submitScore chunk
const ssChunk = readdirSync(join(DIST, 'assets')).find(n => /^submitScore-.*\.js$/.test(n));
ok(!!ssChunk, 'submitScore chunk present in dist/assets', ssChunk || 'none');
if (ssChunk) {
  const ss = await readFile(join(DIST, 'assets', ssChunk), 'utf8');
  ok(ss.includes('cmc-pn-input'), 'built submitScore chunk carries the name prompt modal');
  ok(ss.includes('cmc-student-name'), 'built submitScore chunk reads cmc-student-name');
}

for (const hw of ['doctor-fish.html', 'unit13hw.html', 'unit15hw.html']) {
  const src = await read(`public/rfc3/${hw}`);
  const dist = await read(`dist/rfc3/${hw}`);
  ok(src.includes('cmcNameOf') && src.includes("cmc-student-'+'name'") === false && src.includes('cmcLooksLikeEmail'), `${hw} carries the inline email guard`);
  ok(dist.includes('cmcNameOf'), `dist/rfc3/${hw} shipped with the guard`);
  ok(dist.includes('cmc-student-name') === true, `dist/rfc3/${hw} still reads cmc-student-name`);
}

// standalone pages: guard injected + reads rewired
const standalone = ['voice-quest.html', 'word-forge.html', 'writequest.html', 'syntax-clash-pro.html', 'toefl-ibt/index.html', 'arcade/galica/index.html', 'studio/index.html', 'rfc3/dictation.html', 'rfc3/review-tests.html', 'rfc3/unscramble.html', 'rfc2/rfc2dic.html', 'rfc2/rfc2un.html', 'rfc2/rfc2unittest.html'];
for (const f of standalone) {
  const dist = await read(`dist/${f}`);
  ok(dist.includes('CMC_NG_NO_EMAIL_AS_NAME'), `dist/${f} has the CMC_NG guard`);
  const rec = (dist.match(/window\.CMC_NG\.get\(\)/g) || []).length;
  ok(rec >= 1, `dist/${f} reads go through CMC_NG.get (${rec})`);
  // the guard itself must not be self-referential
  const guardBlock = /<script>\/\* CMC_NG_NO_EMAIL_AS_NAME[\s\S]*?<\/script>/.exec(dist)?.[0] || '';
  ok(!guardBlock.includes('window.CMC_NG.get():localStorage'), `dist/${f} guard is not self-recursive`);
}

// display surfaces prettify historical rows
for (const [f, marker] of [
  ['src/components/TickerBanner.tsx', 'displayStudentName'],
  ['src/components/FirebaseDashboard.tsx', 'displayStudentName'],
  ['src/components/GameLeaderboard.tsx', 'displayStudentName'],
]) {
  const src = await read(f);
  ok(src.split(marker).length - 1 >= 2, `${f} prettifies parsed names`);
}

// ── 2. cmc-shared.js heal drives real static pages ───────────────────────
console.log('browser · cmc-shared.js heal (planner practice page)');
{
  const ctx = await browser.newContext();
  await ctx.route('**/*', makeRouter({ runQueryRows: [], aggCount: 0 }));
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((seed) => { for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); }, POISONED_SEED);
  await page.goto(`${BASE}/biweek-planner/tests/diagnostic.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);
  const healed = await page.evaluate(() => localStorage.getItem('cmc-student-name'));
  ok(healed === 'Mam Ry', 'stored email-as-name healed in place by cmc-shared.js', `got ${healed}`);
  const emailKept = await page.evaluate(() => localStorage.getItem('cmc-student-email'));
  ok(emailKept === 'mam.ry@aii.edu.kh', 'email key untouched by the heal');
  await ctx.close();
}

// ── 3. worksheet guard: prefill + submit never carry an email ────────────
console.log('browser · homework worksheet guard (unit15hw)');
{
  const recorded = [];
  const ctx = await browser.newContext();
  await ctx.route('**/*', makeRouter({
    runQueryRows: [],
    aggCount: 0,
    shareDocs: {
      'hw-kid11-u15-hw1': SHARE_DOC('hw-kid11-u15-hw1'),
      'hw-kid11-u15-hw2': SHARE_DOC('hw-kid11-u15-hw2'),
      'hw-kid11-u15-hw3': SHARE_DOC('hw-kid11-u15-hw3'),
    },
    recorded,
  }));
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((seed) => { for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); }, POISONED_SEED);
  await page.goto(`${BASE}/rfc3/unit15hw.html?hw=a`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700); // share-gate fetch + heal + prefill
  const stored = await page.evaluate(() => localStorage.getItem('cmc-student-name'));
  ok(stored === 'Mam Ry', 'worksheet head-guard healed the stored name', `got ${stored}`);
  const heroVal = await page.evaluate(() => {
    const inp = [...document.querySelectorAll('.assignment .meta input')]
      .find((el) => (el.getAttribute('aria-label') || '').toLowerCase().indexOf('date') === -1);
    return inp ? inp.value : '';
  });
  ok(heroVal === 'Mam Ry', 'hero name prefill shows the friendly name', `got ${heroVal}`);
  ok(!heroVal.includes('@'), 'hero name prefill carries no @');
  // submit HW1
  await page.click('#submitBtn');
  await page.waitForTimeout(500);
  ok(recorded.length >= 1, 'Submit-to-Teacher POST fired (share gate open)');
  if (recorded.length) {
    const body = recorded[0].body;
    ok(body.studentName?.stringValue === 'Mam Ry', 'submitted studentName is the friendly name', JSON.stringify(body.studentName));
    ok(!String(body.studentName?.stringValue || '').includes('@'), 'submitted studentName carries no @');
    ok(body.studentUid?.stringValue === 'student-uid-1', 'signed-in submission carries the real uid');
    ok(!!recorded[0].auth, 'signed-in submission carries the Bearer token');
    ok(body.drillSlug?.stringValue === 'unit15hw.html' || String(body.drillSlug?.stringValue || '').includes('unit15'), 'drill slug intact');
  }
  await page.screenshot({ path: join(SHOTS, 'ticker_names_u15_prefill.png') });
  await ctx.close();
}

// ── 4. React submitScore: email-name → prompt → friendly name ────────────
console.log('browser · built submitScore module (learning-games path)');
{
  const recorded = [];
  const ctx = await browser.newContext();
  await ctx.route('**/*', makeRouter({ runQueryRows: [], aggCount: 0, recorded }));
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  const chunkName = readdirSync(join(DIST, 'assets')).find(n => /^submitScore-.*\.js$/.test(n));
  ok(!!chunkName, 'submitScore chunk present in dist/assets', chunkName || 'none');
  if (!chunkName) throw new Error('submitScore chunk missing from dist/assets');
  // Let the app boot FIRST — the homepage's restoreSession self-heal runs at
  // boot and cleans any poisoned seed, so the prompt path is exercised by
  // seeding AFTER boot (a student signing in mid-session, or a stale tab).
  await page.waitForTimeout(1800);
  await page.evaluate((seed) => { for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); }, POISONED_SEED);
  await page.evaluate(async (chunk) => {
    const mod = await import(new URL(`/assets/${chunk}`, location.href).href);
    window.__cmcSubmit = mod;
    window.__cmcSubmitFns = Object.values(mod).filter(v => typeof v === 'function');
  }, chunkName);
  // first submit — poisoned name → the prompt appears pre-filled with "Mam Ry"
  const submit1 = page.evaluate(async () => {
    const fns = Object.values(window.__cmcSubmit).filter(v => typeof v === 'function');
    for (const fn of fns) {
      await Promise.resolve(fn({
        drillSlug: 'sound-match', drillTitle: 'Sound Match', drillSource: 'learning-games',
        scorePct: 80, correctCount: 8, totalCount: 10, durationSeconds: 30,
      })).catch(() => {});
    }
    return true;
  });
  await page.waitForTimeout(400);
  const modal = await page.evaluate(() => !!document.querySelector('[data-cmc-player-name-modal]'));
  ok(modal, 'name prompt appears for a signed-in student with an email-as-name');
  if (modal) {
    const prefill = await page.evaluate(() => document.querySelector('[data-cmc-player-name-modal] input')?.value || '');
    ok(prefill === 'Mam Ry', 'prompt is pre-filled with the friendly account name', `got ${prefill}`);
    await page.click('[data-cmc-player-name-modal] .cmc-pn-save');
    await submit1;
    await page.waitForTimeout(400);
    const healed = await page.evaluate(() => localStorage.getItem('cmc-student-name'));
    ok(healed === 'Mam Ry', 'prompt answer self-heals cmc-student-name', `got ${healed}`);
  }
  await page.waitForTimeout(300);
  ok(recorded.length >= 1, 'submission recorded for the signed-in student');
  if (recorded.length) {
    const withEmail = recorded.filter(r => String(r.body.studentName?.stringValue || '').includes('@'));
    ok(withEmail.length === 0, 'no submitted row carries an email as the name');
    const good = recorded.find(r => r.body.studentName?.stringValue === 'Mam Ry');
    ok(!!good, 'submitted row shows "Mam Ry"');
    ok(recorded.every(r => r.body.studentUid?.stringValue === 'student-uid-1'), 'rows carry the signed-in uid');
  }
  // second submit — self-healed, NO prompt
  recorded.length = 0;
  const modalBefore = await page.evaluate(() => !!document.querySelector('[data-cmc-player-name-modal]'));
  ok(!modalBefore, 'modal fully removed after save');
  await page.evaluate(async () => {
    const fns = Object.values(window.__cmcSubmit).filter(v => typeof v === 'function');
    for (const fn of fns) {
      await Promise.resolve(fn({
        drillSlug: 'voice-quest-l1', drillTitle: 'Voice Quest L1', drillSource: 'learning-games',
        scorePct: 90, correctCount: 9, totalCount: 10,
      })).catch(() => {});
    }
  });
  await page.waitForTimeout(400);
  const modal2 = await page.evaluate(() => !!document.querySelector('[data-cmc-player-name-modal]'));
  ok(!modal2, 'no second prompt after self-heal');
  ok(recorded.length >= 1 && recorded.every(r => r.body.studentName?.stringValue === 'Mam Ry'), 'second submission flows with the healed name');
  await ctx.close();
}

// ── 5. ticker renders prettified names for historical rows ──────────────
console.log('browser · completion ticker with historical email rows');
{
  const now = Date.now();
  const iso = (ms) => new Date(ms).toISOString();
  const doc = (name, slug, src, pct, ms) => ({
    document: {
      name: `projects/demo/databases/(default)/documents/drill_attempts/${slug}-${encodeURIComponent(name)}-${ms}`,
      fields: {
        drillSlug: { stringValue: slug },
        drillTitle: { stringValue: slug },
        drillSource: { stringValue: src },
        studentName: { stringValue: name },
        studentUid: { stringValue: '' },
        scorePct: { integerValue: String(pct) },
        submittedAt: { timestampValue: iso(ms) },
      },
    },
  });
  const runQueryRows = [
    doc('mam.ry@aii.edu.kh', 'sound-match', 'learning-games', 88, now - 60_000),
    doc('Ry Sovanreach', 'doctor-fish.html', 'rfc3', 90, now - 120_000),
    doc('sophea_chan05@gmail.com', 'voice-quest-l1', 'learning-games', 70, now - 180_000),
    doc('Guest', 'brickforge', 'brain-lounge', 60, now - 240_000),
    { document: undefined },
  ];
  const ctx = await browser.newContext();
  await ctx.route('**/*', makeRouter({ runQueryRows, aggCount: 5 }));
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  // ticker mounts + first refresh after 800ms
  await page.waitForTimeout(2500);
  const marquee = await page.evaluate(() => {
    const el = document.querySelector('[aria-label="Live activity ticker"]');
    if (!el) return null;
    // text of the marquee only — the inline keyframe CSS (@keyframes) is not content
    const clone = el.cloneNode(true);
    clone.querySelectorAll('style').forEach(n => n.remove());
    return clone.textContent || '';
  });
  ok(marquee !== null, 'ticker banner mounted');
  if (marquee !== null) {
    ok(marquee.includes('Mam Ry'), 'ticker shows the prettified name for the email row', marquee.slice(0, 120));
    ok(marquee.includes('Sophea Chan05'), 'ticker prettifies underscore gmail handles');
    ok(marquee.includes('Ry Sovanreach'), 'real names pass through untouched');
    ok(!/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(marquee), 'no email address anywhere in the ticker text');
    ok(marquee.includes('Guest'), 'guest label passes through');
  }
  await page.screenshot({ path: join(SHOTS, 'ticker_names_homepage.png') });
  await ctx.close();
}

await browser.close();
server.close();
console.log(`\nverify_ticker_names: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
