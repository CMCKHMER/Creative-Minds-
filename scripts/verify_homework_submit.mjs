// Kid 11 online homework — does "Submit to Teacher" really arrive?
//
// Owner report (Nov 2026, third time): "student said they submitted yet I'm
// not seeing some students' scores." The six homework pages
// (public/rfc3/unit2hw, unit3hw, unit4hw, unit13hw, unit15hw, doctor-fish)
// post the score to Firestore with the sign-in token kept on the device.
// That token lives one hour. When it has run out the page must swap the
// saved refresh token for a new one and post again.
//
// The swap was sent with `Content-Type: application/json` and a form body
// (`grant_type=refresh_token&refresh_token=…`). Google answers that with
// HTTP 400 "Invalid JSON payload", so no student whose sign-in was more than
// an hour old could hand in under their account. Students who had signed in
// within the hour were unaffected — hence "some students".
//
// This check opens every page in a browser as a student, presses Submit, and
// answers the network the way Google does:
//   · the score post is refused (401) with the old token, accepted with a
//     new one, and refused (403) with no token — the last one is what the
//     live database does until the newest firestore.rules are published;
//   · the token swap is refused (400) unless the body matches its
//     Content-Type, exactly like securetoken.googleapis.com.
//
//   node scripts/verify_homework_submit.mjs
//   HW_ROOT=dir        serve another folder (default ../public)
//   PW_CHROMIUM=/path  use this Chromium binary (with playwright-core)
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = await import('playwright').catch(() => import('playwright-core'));

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(process.env.HW_ROOT || join(HERE, '..', 'public'));
const PORT = 8971;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const PAGES = ['unit2hw.html', 'unit3hw.html', 'unit4hw.html', 'unit13hw.html', 'unit15hw.html', 'doctor-fish.html'];

const server = createServer(async (req, res) => {
  let path = decodeURIComponent((req.url || '/').split('?')[0]);
  if (path.endsWith('/')) path += 'index.html';
  const file = join(ROOT, normalize(path));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  try {
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }).end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((done) => server.listen(PORT, '127.0.0.1', done));

let passed = 0;
let failed = 0;
const check = (ok, label, detail = '') => {
  if (ok) { passed += 1; console.log(`PASS ${label}`); }
  else { failed += 1; console.log(`FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
};

// A browser per student: each one must start with nothing remembered, and a
// single-process Chromium does not survive closing a window.
const launch = () => chromium.launch({
  executablePath: process.env.PW_CHROMIUM || undefined,
  args: ['--no-sandbox', '--disable-gpu', '--single-process', '--no-zygote'],
});

const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (tag) => `${b64u({ alg: 'none' })}.${b64u({ user_id: 'student-1', email: 'dara@example.com', email_verified: true, tag })}.sig`;
const OLD_TOKEN = jwt('old');
const NEW_TOKEN = jwt('new');
const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

/**
 * One student, one page, one press of Submit.
 *   tokenAge   'fresh' — signed in within the hour; 'old' — the token ran out
 *   guestRule  whether the database accepts a post without an account
 *   refresh    'google' — the token service behaves like Google's;
 *              'down' — it cannot be reached
 *   waiting    true — do not press Submit: the device already holds a score
 *              that failed to send earlier, and opening the page must send it
 */
async function submitOnce(file, { tokenAge, guestRule, refresh = 'google', waiting = false }) {
  const browser = await launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  const log = { posts: [], swaps: [] };

  await context.route('**/*', (route) => {
    const request = route.request();
    const url = request.url();
    if (url.startsWith(ORIGIN)) return route.continue();

    // "Is this homework shared with the class?" — yes, all of them.
    if (/\/documents\/biweekly_tests\//.test(url)) {
      const doc = url.split('/biweekly_tests/')[1].split('?')[0];
      return json(route, 200, { name: `projects/x/databases/(default)/documents/biweekly_tests/${doc}`, fields: { shared: { booleanValue: true } } });
    }

    // The token swap, answered the way securetoken.googleapis.com answers.
    if (url.startsWith('https://securetoken.googleapis.com/v1/token')) {
      const type = (request.headers()['content-type'] || '').toLowerCase();
      const body = request.postData() || '';
      log.swaps.push({ type, body });
      if (refresh === 'down') return route.abort('internetdisconnected');
      let fields = null;
      if (type.includes('application/json')) {
        try { fields = JSON.parse(body); } catch { fields = null; }
        if (!fields) return json(route, 400, { error: { code: 400, message: 'Invalid JSON payload received. Unexpected token.', status: 'INVALID_ARGUMENT' } });
      } else if (type.includes('application/x-www-form-urlencoded')) {
        fields = Object.fromEntries(new URLSearchParams(body));
      }
      if (!fields || fields.grant_type !== 'refresh_token' || fields.refresh_token !== 'refresh-1') {
        return json(route, 400, { error: { code: 400, message: 'MISSING_REFRESH_TOKEN', status: 'INVALID_ARGUMENT' } });
      }
      return json(route, 200, { id_token: NEW_TOKEN, refresh_token: 'refresh-2', expires_in: '3600', user_id: 'student-1' });
    }

    // The score post, answered the way the database rules answer.
    if (request.method() === 'POST' && /\/documents\/drill_attempts(\?|$)/.test(url)) {
      const auth = request.headers().authorization || '';
      const fields = JSON.parse(request.postData() || '{}').fields || {};
      const uid = fields.studentUid?.stringValue ?? null;
      const entry = { auth: auth === `Bearer ${NEW_TOKEN}` ? 'new' : auth === `Bearer ${OLD_TOKEN}` ? 'old' : auth ? 'other' : 'none', uid, name: fields.studentName?.stringValue, slug: fields.drillSlug?.stringValue, status: 0 };
      if (entry.auth === 'old' && tokenAge === 'old') entry.status = 401;
      else if (entry.auth === 'old' || entry.auth === 'new') entry.status = uid === 'student-1' ? 200 : 403;
      else if (entry.auth === 'none') entry.status = guestRule && uid === '' ? 200 : 403;
      else entry.status = 401;
      log.posts.push(entry);
      return entry.status === 200
        ? json(route, 200, { name: 'projects/x/databases/(default)/documents/drill_attempts/abc' })
        : json(route, entry.status, { error: { code: entry.status, status: entry.status === 401 ? 'UNAUTHENTICATED' : 'PERMISSION_DENIED' } });
    }

    // Fonts, analytics, anything else off-site: not part of this check.
    return route.abort();
  });

  await context.addInitScript(([token, age, waitingKey]) => {
    try {
      if (localStorage.getItem('cmc-verify-seeded')) return;
      localStorage.setItem('cmc-verify-seeded', '1');
      localStorage.setItem('cmc-student-token', token);
      localStorage.setItem('cmc-student-token-expires', String(Date.now() + (age === 'old' ? -3 * 3600_000 : 3000_000)));
      localStorage.setItem('cmc-student-refresh-token', 'refresh-1');
      localStorage.setItem('cmc-student-role', 'student');
      localStorage.setItem('cmc-student-email', 'dara@example.com');
      localStorage.setItem('cmc-student-uid', 'student-1');
      localStorage.setItem('cmc-student-name', 'Sok Dara');
      if (waitingKey) localStorage.setItem(waitingKey, JSON.stringify({ name: 'Sok Dara', mode: 'a', correct: 7, total: 9, at: Date.now() - 86_400_000 }));
    } catch { /* storage not ready on about:blank */ }
  }, [OLD_TOKEN, tokenAge, waiting ? `cmc-hw-outbox:${file}:a:sok dara` : '']);

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  await page.goto(`${ORIGIN}/rfc3/${file}`);
  await page.waitForSelector('#submitBtn', { state: 'visible', timeout: 15000 });
  // The share check runs when the page opens; let it settle so no lock covers the button.
  await page.waitForTimeout(700);
  if (waiting) {
    // Nothing is pressed: the page sends what it kept, on its own.
    await page.waitForFunction(() => !Object.keys(localStorage).some((k) => k.startsWith('cmc-hw-outbox:')), null, { timeout: 6000, polling: 100 }).catch(() => undefined);
  } else {
    await page.click('#submitBtn');
    // The button reads "Submitting…" until the page has its final answer.
    await page.waitForFunction(() => {
      const text = document.getElementById('submitBtn')?.textContent || '';
      return /Submitted to teacher|Try again/.test(text);
    }, null, { timeout: 15000, polling: 100 });
  }
  const result = await page.evaluate(() => ({
    button: document.getElementById('submitBtn')?.textContent || '',
    toast: document.getElementById('cmcToast')?.textContent || '',
    note: document.getElementById('cmcOutboxNote')?.textContent || '',
    noteShown: (document.getElementById('cmcOutboxNote')?.style.display || 'none') !== 'none',
    outbox: Object.keys(localStorage).filter((k) => k.startsWith('cmc-hw-outbox:')).length,
    token: localStorage.getItem('cmc-student-token'),
  }));
  await browser.close().catch(() => undefined);
  return { ...result, ...log, errors, accepted: log.posts.filter((p) => p.status === 200) };
}

for (const file of PAGES) {
  // 1. Signed in within the hour: one post, under the account.
  const fresh = await submitOnce(file, { tokenAge: 'fresh', guestRule: false });
  check(
    fresh.accepted.length === 1 && fresh.accepted[0].uid === 'student-1' && fresh.swaps.length === 0 && /Submitted to teacher/.test(fresh.button),
    `${file}: a student signed in within the hour hands in under their account`,
    JSON.stringify({ posts: fresh.posts, button: fresh.button }),
  );

  // 2. THE BUG. Signed in more than an hour ago, and the database takes no
  //    post without an account: the page must renew the sign-in and hand in.
  const old = await submitOnce(file, { tokenAge: 'old', guestRule: false });
  check(
    old.swaps.length === 1 && old.swaps[0].type.includes('application/x-www-form-urlencoded'),
    `${file}: the sign-in renewal is sent as a form, the way Google accepts it`,
    JSON.stringify(old.swaps),
  );
  check(
    old.accepted.length === 1 && old.accepted[0].auth === 'new' && old.accepted[0].uid === 'student-1',
    `${file}: a student signed in over an hour ago still hands in under their account`,
    JSON.stringify(old.posts),
  );
  check(
    /Submitted to teacher/.test(old.button) && /Submitted!/.test(old.toast) && old.outbox === 0 && !old.noteShown,
    `${file}: … and is told so, with nothing left waiting on the device`,
    JSON.stringify({ button: old.button, toast: old.toast, outbox: old.outbox }),
  );
  check(old.token === NEW_TOKEN, `${file}: the renewed sign-in is kept for the next homework`);
  check(old.posts.every((p) => p.name === 'Sok Dara' && p.slug === file), `${file}: the post names the student and the page`, JSON.stringify(old.posts));

  // 3. The renewal cannot be reached (dead Wi-Fi halfway): the page falls
  //    back to a post without the account. With the newest rules live it
  //    arrives; without them it is kept on the device and says so.
  const viaGuest = await submitOnce(file, { tokenAge: 'old', guestRule: true, refresh: 'down' });
  check(
    viaGuest.accepted.length === 1 && viaGuest.accepted[0].uid === '' && /Submitted to teacher/.test(viaGuest.button),
    `${file}: if the renewal fails, the score is still handed in by name`,
    JSON.stringify(viaGuest.posts),
  );
  const stuck = await submitOnce(file, { tokenAge: 'old', guestRule: false, refresh: 'down' });
  check(
    stuck.accepted.length === 0 && /Try again/.test(stuck.button) && /Not sent yet/.test(stuck.toast) && stuck.outbox === 1 && stuck.noteShown,
    `${file}: if nothing gets through, the student is told it was NOT sent and it is kept to retry`,
    JSON.stringify({ posts: stuck.posts, button: stuck.button, toast: stuck.toast, outbox: stuck.outbox }),
  );

  // 4. A score that failed to send before this fix is still on the device.
  //    Opening the homework again sends it, with no button pressed.
  const kept = await submitOnce(file, { tokenAge: 'old', guestRule: false, waiting: true });
  check(
    kept.accepted.length === 1 && kept.accepted[0].auth === 'new' && kept.accepted[0].uid === 'student-1' && kept.outbox === 0 && /Sent to your teacher/.test(kept.toast),
    `${file}: a score kept from an earlier failed send goes out when the page is opened again`,
    JSON.stringify({ posts: kept.posts, outbox: kept.outbox, toast: kept.toast }),
  );

  const errors = [...fresh.errors, ...old.errors, ...viaGuest.errors, ...stuck.errors, ...kept.errors];
  check(errors.length === 0, `${file}: no page errors`, errors.slice(0, 2).join(' | '));
}

server.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
