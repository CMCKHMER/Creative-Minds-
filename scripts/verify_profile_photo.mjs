// Profile picture — browser check of the panel in the account menu.
//
// A signed-in user opens "Add a profile picture", picks a built-in avatar or
// uploads a photo, and the picture shows in the account button. The photo is
// shrunk in the browser to a 160 px square before it is stored, and the
// stored document is private to the account. Runs against the in-memory
// database of scripts/qa/school_fake.mjs, which applies the user_avatars
// rules written out in JS.
//
//   node scripts/verify_profile_photo.mjs
//   PHOTO_DIST=dir      serve another folder (default ../dist)
//   PHOTO_SHOTS=dir     also save screenshots
//   PW_CHROMIUM=/path   use this Chromium binary (with playwright-core)
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { makeFake, makeOpener } from './qa/school_fake.mjs';
const { chromium } = await import('playwright').catch(() => import('playwright-core'));

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(process.env.PHOTO_DIST || join(HERE, '..', 'dist'));
const SHOTS = process.env.PHOTO_SHOTS ? resolve(process.env.PHOTO_SHOTS) : null;
const { openPage, close: closeServers } = makeOpener(DIST, 9010);

let pass = 0;
let fail = 0;
const fails = [];
const ok = (c, msg, extra) => {
  if (c) pass++;
  else {
    fail++;
    fails.push(msg + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 500) : ''));
  }
  console.log((c ? '  ok  ' : '  FAIL') + ' ' + msg + (!c && extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 500) : ''));
};
const shot = async (page, name) => {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: join(SHOTS, `profile-photo-${name}.png`) });
};
const waitFor = async (fn, ms = 12000) => {
  const t0 = Date.now();
  for (;;) {
    const v = await fn();
    if (v || Date.now() - t0 > ms) return v;
    await new Promise((r) => setTimeout(r, 150));
  }
};

/** A PNG, `w` by `h`: the left half red, the right half blue. */
function twoTonePng(w, h) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const head = Buffer.alloc(13);
  head.writeUInt32BE(w, 0);
  head.writeUInt32BE(h, 4);
  head[8] = 8; // bit depth
  head[9] = 2; // RGB
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (w * 3 + 1);
    for (let x = 0; x < w; x++) {
      const p = row + 1 + x * 3;
      if (x < w / 2) raw[p] = 220;
      else raw[p + 2] = 220;
    }
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const DARA = { uid: 'stu-dara', email: 'dara.family@gmail.com', name: 'Sok Dara', type: 'student' };
const SOPHEA = { uid: 'stu-sophea', email: 'sophea.home@gmail.com', name: 'Sophea', type: 'student' };
const TEACHER = { uid: 'teacher-1', email: 'sreyneang@cmc.edu.kh', name: 'Teacher Sreyneang', type: 'teacher' };
const S = (v) => ({ stringValue: v });
const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';
const fields = (uid, over = {}) => ({ uid: S(uid), kind: S('preset'), photo: S(''), preset: S('bird'), updatedAt: { timestampValue: '2026-11-14T02:00:00Z' }, ...over });

function checkRules() {
  console.log('\nrules');
  const fake = makeFake();
  const put = (user, uid, f) => fake.call(user, 'PATCH', `/user_avatars/${uid}`, { fields: f }).status;
  ok(put(DARA, DARA.uid, fields(DARA.uid)) === 200, 'an account can store a built-in avatar for itself');
  ok(put(DARA, DARA.uid, fields(DARA.uid, { kind: S('photo'), preset: S(''), photo: S(JPEG) })) === 200, 'or a small photo');
  ok(fake.call(DARA, 'GET', `/user_avatars/${DARA.uid}`).status === 200, 'and read it back');
  ok(fake.call(SOPHEA, 'GET', `/user_avatars/${DARA.uid}`).status === 403, 'another student cannot see it');
  ok(fake.call(TEACHER, 'GET', `/user_avatars/${DARA.uid}`).status === 403, 'nor can a teacher');
  ok(fake.call(TEACHER, 'POST', ':runQuery', { structuredQuery: { from: [{ collectionId: 'user_avatars' }] } }).status === 403, 'nobody can list the pictures');
  ok(put(SOPHEA, DARA.uid, fields(DARA.uid)) === 403, 'nobody can change someone else\'s picture');
  ok(put(SOPHEA, SOPHEA.uid, fields(DARA.uid)) === 403, 'or file a picture under another name');
  ok(put(DARA, DARA.uid, fields(DARA.uid, { kind: S('photo'), preset: S(''), photo: S('https://example.com/me.jpg') })) === 403, 'a link is not a picture');
  ok(put(DARA, DARA.uid, fields(DARA.uid, { kind: S('photo'), preset: S(''), photo: S('data:image/svg+xml;base64,PHN2Zz4=') })) === 403, 'an SVG is refused');
  ok(put(DARA, DARA.uid, fields(DARA.uid, { kind: S('photo'), preset: S(''), photo: S('data:image/jpeg;base64,' + 'A'.repeat(90000)) })) === 403, 'a large picture is refused');
  ok(put(DARA, DARA.uid, fields(DARA.uid, { role: S('teacher') })) === 403, 'the record carries nothing but the picture');
  ok(fake.call(SOPHEA, 'DELETE', `/user_avatars/${DARA.uid}`).status === 403, 'nobody can remove someone else\'s picture');
  ok(fake.call(DARA, 'DELETE', `/user_avatars/${DARA.uid}`).status === 200 && fake.doc(`user_avatars/${DARA.uid}`) === null, 'the account can remove its own');
}

const badge = (page) => page.getAttribute('header [aria-expanded] [data-avatar]', 'data-avatar');
async function openPanel(page) {
  await page.locator('header button[aria-expanded]').click();
  await page.getByTestId('profile-photo-open').click();
  await page.getByTestId('profile-photo-modal').waitFor({ timeout: 15000 });
}
/** Average colour of the left and right halves of an image URL, read in the page. */
const halves = (page, url) =>
  page.evaluate(async (src) => {
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
      img.src = src;
    });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const at = (x) => Array.from(g.getImageData(x, Math.floor(c.height / 2), 1, 1).data.slice(0, 3));
    return { w: img.naturalWidth, h: img.naturalHeight, left: at(Math.floor(c.width * 0.15)), right: at(Math.floor(c.width * 0.85)) };
  }, url);
const isRed = ([r, , b]) => r > 150 && b < 90;
const isBlue = ([r, , b]) => b > 150 && r < 90;

async function walk(browser) {
  const fake = makeFake();
  const path = `user_avatars/${DARA.uid}`;

  console.log('\navatar');
  const A = await openPage(browser, fake, DARA);
  await A.goto(`${A.base}/`, { waitUntil: 'domcontentloaded' });
  await A.locator('header button[aria-expanded]').waitFor({ timeout: 20000 });
  ok((await badge(A)) === 'initial', 'without a picture the account button shows the initial');
  await A.locator('header button[aria-expanded]').click();
  ok(/add a profile picture/i.test(await A.getByTestId('profile-photo-open').textContent()), 'the account menu offers "Add a profile picture"');
  await A.getByTestId('profile-photo-open').click();
  await A.getByTestId('profile-photo-modal').waitFor({ timeout: 15000 });
  ok((await A.$$eval('[data-testid="profile-photo-presets"] [data-preset]', (b) => b.length)) >= 12, 'the panel shows the built-in avatars');
  ok(await A.getByTestId('profile-photo-save').isDisabled(), 'Save waits until something is chosen');
  await shot(A, 'panel');
  await A.locator('[data-preset="bird"]').click();
  ok((await A.getAttribute('[data-testid="profile-photo-preview"] [data-avatar]', 'data-avatar')) === 'preset:bird', 'picking an avatar shows it in the preview');
  const drawn = await A.$$eval('[data-testid="profile-photo-presets"] [data-preset]', (btns) => btns.filter((b) => { const g = b.querySelector('svg'); return g && g.getBoundingClientRect().width >= 16; }).length);
  ok(drawn >= 12, 'every avatar is a drawing, so it shows on any device', drawn);
  await shot(A, 'avatar-chosen');
  await A.getByTestId('profile-photo-save').click();
  await A.getByTestId('profile-photo-modal').waitFor({ state: 'detached', timeout: 10000 });
  const stored = fake.doc(path);
  ok(!!stored && stored.kind === 'preset' && stored.preset === 'bird' && stored.photo === '', 'the avatar is stored for the account', stored);
  ok((await badge(A)) === 'preset:bird', 'and shows in the account button at once');
  await A.reload({ waitUntil: 'domcontentloaded' });
  await A.locator('header button[aria-expanded]').waitFor({ timeout: 20000 });
  ok((await badge(A)) === 'preset:bird', 'it is still there after a reload');

  // another device of the same account: nothing cached, the picture comes from the database
  const B = await openPage(browser, fake, DARA);
  await B.goto(`${B.base}/`, { waitUntil: 'domcontentloaded' });
  ok((await waitFor(async () => (await badge(B).catch(() => null)) === 'preset:bird')) === true, 'a second device of the same account shows it too');
  // somebody else on a shared computer does not inherit it
  const C = await openPage(browser, fake, SOPHEA);
  await C.goto(`${C.base}/`, { waitUntil: 'domcontentloaded' });
  await C.locator('header button[aria-expanded]').waitFor({ timeout: 20000 });
  await C.waitForTimeout(1200);
  ok((await badge(C)) === 'initial', 'another account does not see it');

  console.log('\nphoto');
  await openPanel(A);
  await A.getByTestId('profile-photo-file').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
  await A.getByTestId('profile-photo-error').waitFor({ timeout: 5000 });
  ok(/not a picture/i.test(await A.getByTestId('profile-photo-error').textContent()), 'a file that is not a picture is refused, with a reason');
  await A.getByTestId('profile-photo-file').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: twoTonePng(600, 300) });
  await A.locator('[data-testid="profile-photo-preview"] img[data-avatar="photo"]').waitFor({ timeout: 10000 });
  ok((await A.getByTestId('profile-photo-error').count()) === 0, 'a real picture clears the message');
  const preview = await halves(A, await A.getAttribute('[data-testid="profile-photo-preview"] img', 'src'));
  ok(preview.w === 160 && preview.h === 160, 'the photo is made a 160 px square', preview);
  ok(isRed(preview.left) && isBlue(preview.right), 'a wide photo is cut from the middle, not squeezed', preview);
  await shot(A, 'photo-chosen');
  // slide the picture: drag right shows more of its left side
  const box = await A.getByTestId('profile-photo-preview').boundingBox();
  await A.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await A.mouse.down();
  await A.mouse.move(box.x + box.width / 2 + 140, box.y + box.height / 2, { steps: 6 });
  await A.mouse.up();
  const slid = await waitFor(async () => {
    const h = await halves(A, await A.getAttribute('[data-testid="profile-photo-preview"] img', 'src'));
    return isRed(h.left) && isRed(h.right) ? h : null;
  }, 4000);
  ok(!!slid, 'dragging the picture moves it inside the circle');
  await A.getByTestId('profile-photo-save').click();
  await A.getByTestId('profile-photo-modal').waitFor({ state: 'detached', timeout: 10000 });
  const photo = fake.doc(path);
  ok(!!photo && photo.kind === 'photo' && photo.preset === '' && /^data:image\/jpeg;base64,/.test(photo.photo), 'the photo is stored as a small JPEG', photo && { kind: photo.kind, len: photo.photo.length });
  ok(!!photo && photo.photo.length < 30000, 'a few kilobytes, not the original file', photo && photo.photo.length);
  const savedLook = await halves(A, photo.photo);
  ok(savedLook.w === 160 && isRed(savedLook.left) && isRed(savedLook.right), 'what was stored is what the preview showed', savedLook);
  ok((await badge(A)) === 'photo', 'the account button shows the photo');
  await A.locator('header button[aria-expanded]').click();
  ok(/change profile picture/i.test(await A.getByTestId('profile-photo-open').textContent()), 'the menu now offers "Change profile picture"');
  await shot(A, 'menu-with-photo');
  await A.getByTestId('profile-photo-open').click();
  await A.getByTestId('profile-photo-modal').waitFor({ timeout: 15000 });
  await A.getByTestId('profile-photo-remove').click();
  await A.getByTestId('profile-photo-modal').waitFor({ state: 'detached', timeout: 10000 });
  ok(fake.doc(path) === null, 'Remove deletes the picture');
  ok((await badge(A)) === 'initial', 'and the account button goes back to the initial');
  ok(fake.log.length === 0, 'the app never sent a write the rules refuse', fake.log);

  console.log('\nphone and light theme');
  const P = await openPage(browser, fake, SOPHEA, { w: 393, h: 852, theme: 'light' });
  await P.goto(`${P.base}/`, { waitUntil: 'domcontentloaded' });
  await P.getByRole('button', { name: 'Toggle Mobile Menu' }).click({ timeout: 20000 });
  await P.getByTestId('profile-photo-open-mobile').click();
  await P.getByTestId('profile-photo-modal').waitFor({ timeout: 15000 });
  const fit = await P.evaluate(() => {
    const card = document.querySelector('[data-testid="profile-photo-modal"] > div').getBoundingClientRect();
    return { left: card.left, right: card.right, vw: window.innerWidth, sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  ok(fit.left >= 0 && fit.right <= fit.vw && fit.sideways <= 1, 'the panel fits a phone', fit);
  await P.locator('[data-preset="flower"]').click();
  await shot(P, 'phone-light');
  await P.getByTestId('profile-photo-save').click();
  await P.getByTestId('profile-photo-modal').waitFor({ state: 'detached', timeout: 10000 });
  ok(fake.doc(`user_avatars/${SOPHEA.uid}`).preset === 'flower', 'a picture can be chosen from a phone');
  const L = await openPage(browser, fake, SOPHEA, { theme: 'light' });
  await L.goto(`${L.base}/`, { waitUntil: 'domcontentloaded' });
  await waitFor(async () => (await badge(L).catch(() => null)) === 'preset:flower');
  await openPanel(L);
  await shot(L, 'laptop-light');
  await L.keyboard.press('Escape');
  await L.getByTestId('profile-photo-modal').waitFor({ state: 'detached', timeout: 5000 });
  ok(true, 'Escape closes the panel');

  const V = await openPage(browser, fake, null);
  await V.goto(`${V.base}/`, { waitUntil: 'domcontentloaded' });
  await V.waitForTimeout(1500);
  ok((await V.getByTestId('profile-photo-open').count()) === 0 && (await V.locator('header [data-avatar]').count()) === 0, 'a signed-out visitor is not offered the panel');
  for (const [who, page] of [['laptop', A], ['second device', B], ['other account', C], ['phone', P], ['light', L], ['visitor', V]]) ok(page.errors.length === 0, `no page errors (${who})`, page.errors);
}

if (!existsSync(join(DIST, 'index.html'))) {
  console.error(`No build in ${DIST}. Run "npm run build" first.`);
  process.exit(2);
}
checkRules();
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || undefined,
  args: ['--no-sandbox', '--disable-gpu', '--single-process', '--no-zygote'],
});
try {
  await walk(browser);
} catch (e) {
  ok(false, 'the walk ran to the end', String(e.stack || e).slice(0, 600));
} finally {
  await browser.close().catch(() => {});
  closeServers();
}
console.log(`\n${pass} passed, ${fail} failed`);
for (const f of fails) console.log('  FAIL ' + f);
process.exit(fail ? 1 : 0);
