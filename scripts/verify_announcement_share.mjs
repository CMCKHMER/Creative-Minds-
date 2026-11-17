// Announcement board — browser check of sharing, links and video.
//
// Readers: a post's video plays, addresses are links, the Share menu hands
// each site the address of the post, and a shared address opens the board at
// that post. Admins: paste a video link or upload a video file, attach a link,
// publish. Runs against the in-memory database of scripts/qa/school_fake.mjs
// (announcement rules written out in JS); video uploads are answered by a
// stand-in for Firebase Storage, and the preview pages are built by the real
// scripts/build_share_pages.mjs.
//
//   node scripts/verify_announcement_share.mjs
//   SHARE_DIST=dir      serve another build (default ../dist)
//   SHARE_SHOTS=dir     also save screenshots
//   PW_CHROMIUM=/path   use this Chromium binary (with playwright-core)
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeFake, makeOpener } from './qa/school_fake.mjs';
const { chromium } = await import('playwright').catch(() => import('playwright-core'));

const HERE = dirname(fileURLToPath(import.meta.url));
const BUILD = resolve(process.env.SHARE_DIST || join(HERE, '..', 'dist'));
const SHOTS = process.env.SHARE_SHOTS ? resolve(process.env.SHARE_SHOTS) : null;
if (!existsSync(join(BUILD, 'index.html'))) {
  console.error(`No build in ${BUILD}. Run "npm run build" first.`);
  process.exit(2);
}
// serve a copy of the build, so the preview pages are not written into dist/
const TMP = mkdtempSync(join(tmpdir(), 'cmc-share-check-'));
const DIST = join(TMP, 'site');
mkdirSync(DIST);
for (const name of readdirSync(BUILD)) if (name !== 'post') symlinkSync(join(BUILD, name), join(DIST, name));
const { openPage, close: closeServers } = makeOpener(DIST, 9040);

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
  await page.screenshot({ path: join(SHOTS, `announce-${name}.png`) });
};
const waitFor = async (fn, ms = 12000) => {
  const t0 = Date.now();
  for (;;) {
    const v = await fn();
    if (v || Date.now() - t0 > ms) return v;
    await new Promise((r) => setTimeout(r, 150));
  }
};

const OWNER = { uid: '5iLvnjzmV8QY7WFZhyTq6PIgcI63', email: 'owner@cmc.edu.kh', name: 'Chan Owner', type: 'teacher' };
const ADMIN = { uid: 'admin-2', email: 'srey@cmc.edu.kh', name: 'Srey Admin', type: 'teacher' };
const TEACHER = { uid: 'teacher-9', email: 'vannak@cmc.edu.kh', name: 'Teacher Vannak', type: 'teacher' };
const S = (v) => ({ stringValue: v });
const T = (v) => ({ timestampValue: v });
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const post = (who, over = {}) => ({
  title: S('Sports day moves to Friday'), body: S('Bring a hat.'), imageUrl: S(''), pinned: { booleanValue: false },
  authorUid: S(who.uid), authorName: S(who.name), authorEmail: S(who.email),
  createdAt: T('2026-11-10T02:00:00Z'), updatedAt: T('2026-11-10T02:00:00Z'), ...over,
});
const YT = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const STORED = 'https://firebasestorage.googleapis.com/v0/b/creative-minds-cambodia.firebasestorage.app/o/announcements%2Fadmin-2%2F1-0a0a0a.mp4?alt=media&token=t';

function seed(fake) {
  fake.call(OWNER, 'PATCH', '/site_config/admins', { fields: { uids: { arrayValue: { values: [S(ADMIN.uid)] } } } });
  // each post is written by its own author: the rules refuse a post stamped with someone else's name
  const put = (id, fields) => fake.call(fields.authorUid.stringValue === ADMIN.uid ? ADMIN : OWNER, 'PATCH', `/announcements/${id}`, { fields }).status;
  return [
    put('postVideo', post(OWNER, {
      title: S('Watch the assembly'), createdAt: T('2026-11-12T02:00:00Z'), updatedAt: T('2026-11-12T02:00:00Z'), videoUrl: S(YT),
      body: S('The recording is here. Sign up at https://example.com/form. Questions: www.example.org (office).'),
      linkUrl: S('https://example.com/timetable.pdf'), linkLabel: S('New timetable'),
    })),
    put('postFile', post(ADMIN, { title: S('Class video'), createdAt: T('2026-11-11T02:00:00Z'), updatedAt: T('2026-11-11T02:00:00Z'), videoUrl: S(STORED), imageUrl: S(`data:image/png;base64,${PNG}`) })),
    put('postPlain', post(OWNER, { title: S('Sports day moves to Friday') })),
    // written after the last deploy: it has no preview page
    put('postNew', post(OWNER, { title: S('Fresh news'), createdAt: T('2026-11-13T02:00:00Z'), updatedAt: T('2026-11-13T02:00:00Z') })),
  ];
}

function checkRules() {
  console.log('\nrules');
  const fake = makeFake();
  ok(seed(fake).every((s) => s === 200), 'the owner and an approved admin can publish, with a video and a link');
  const put = (who, id, over) => fake.call(who, 'PATCH', `/announcements/${id}`, { fields: post(who, over) }).status;
  ok(put(TEACHER, 'x1', {}) === 403, 'a teacher who is not an approved admin cannot publish');
  ok(put(ADMIN, 'x2', { linkUrl: S('javascript:alert(1)') }) === 403, 'a link that is not a web address is refused');
  ok(put(ADMIN, 'x3', { videoUrl: S('data:text/html,<b>x</b>') }) === 403, 'so is such a video address');
  ok(put(ADMIN, 'x4', { linkUrl: S('https://example.com/' + 'a'.repeat(2100)) }) === 403, 'and an over-long address');
  ok(put(ADMIN, 'x5', { linkLabel: S('a'.repeat(81)) }) === 403, 'and over-long link words');
  ok(put(ADMIN, 'x6', {}) === 200, 'a post without video or link is still accepted (older clients)');
  ok(fake.call(ADMIN, 'PATCH', '/announcements/postPlain', { fields: post(OWNER, { linkUrl: S('vbscript:x') }) }).status === 403, 'an edit cannot slip one in either');
  ok(fake.call(null, 'GET', '/announcements/postVideo').status === 200, 'anyone can read a post');
}

const openBoard = async (page, path = '/#announcements') => {
  await page.goto(`${page.base}${path}`, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-testid="announcement-post"]').first().waitFor({ timeout: 30000 });
};
const card = (page, id) => page.locator(`[data-post-id="${id}"]`);
const inView = (page, id) => page.evaluate((pid) => {
  const r = document.querySelector(`[data-post-id="${pid}"]`)?.getBoundingClientRect();
  return !!r && r.top >= -4 && r.top < window.innerHeight * 0.6;
}, id);

async function walk(browser) {
  const fake = makeFake();
  seed(fake);
  // the preview pages, as the deploy writes them — for every post but the newest
  const docs = ['postVideo', 'postFile', 'postPlain'].map((id) => fake.call(null, 'GET', `/announcements/${id}`).json);
  writeFileSync(join(TMP, 'posts.json'), JSON.stringify({ documents: docs }));

  console.log('\nreader');
  const V = await openPage(browser, fake, null);
  const requested = [];
  V.on('request', (r) => requested.push(r.url()));
  const SITE = `${V.base}/`;
  execFileSync(process.execPath, [join(HERE, 'build_share_pages.mjs'), '--from', join(TMP, 'posts.json'), '--out', DIST], { env: { ...process.env, SITE_URL: SITE }, encoding: 'utf8' });
  ok(existsSync(join(DIST, 'news/headlines.json')) && existsSync(join(BUILD, 'news/headlines.json')), 'writing the preview pages leaves the site’s headlines feed alone');
  await openBoard(V);
  ok((await V.locator('[data-testid="announcement-post"]').count()) === 4, 'the board shows the posts');
  const vid = card(V, 'postVideo');
  ok((await vid.locator('[data-testid="post-video"]').getAttribute('data-provider')) === 'youtube', 'a post with a YouTube address shows a video');
  ok((await vid.locator('iframe').count()) === 0 && !requested.some((u) => /youtube|facebook\.com|tiktok/.test(new URL(u).hostname)), 'no player is loaded from a video site before the reader presses play', requested.filter((u) => /youtube|facebook\.com|tiktok/.test(u)));
  await vid.getByTestId('post-video-play').click();
  const frame = await vid.locator('iframe').getAttribute('src');
  ok(frame === 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&autoplay=1', 'pressing play opens the player', frame);
  const links = await vid.locator('[data-testid="post-text-link"]').evaluateAll((as) => as.map((a) => ({ text: a.textContent, href: a.href, target: a.target, rel: a.rel })));
  ok(links.length === 2 && links[0].href === 'https://example.com/form' && links[0].text === 'https://example.com/form' && links[1].href === 'https://www.example.org/', 'addresses typed in the text are links, without the full stop after them', links);
  ok(links.every((l) => l.target === '_blank' && /noopener/.test(l.rel) && /noreferrer/.test(l.rel)), 'they open in a new tab');
  ok(/office/.test(await vid.locator('p.whitespace-pre-wrap').textContent()), 'the rest of the text is unchanged');
  const attached = vid.getByTestId('post-link');
  ok((await attached.getAttribute('href')) === 'https://example.com/timetable.pdf' && /New timetable/.test(await attached.textContent()) && /example\.com/.test(await attached.textContent()), 'the attached link shows its words and where it goes');
  const file = card(V, 'postFile').locator('video');
  ok((await file.getAttribute('src')) === STORED && (await file.getAttribute('controls')) !== null, 'an uploaded video plays in the page');
  ok((await card(V, 'postPlain').locator('[data-testid="post-video"], [data-testid="post-link"]').count()) === 0, 'a post without video or link looks as before');
  await shot(V, 'reader');

  console.log('\nshare');
  ok((await V.locator('[data-testid="post-share-open"]').count()) === 4, 'every post has a Share button, also for a signed-out reader');
  await card(V, 'postVideo').getByTestId('post-share-open').click();
  const menu = card(V, 'postVideo').getByTestId('post-share-menu');
  const pageUrl = `${SITE}post/postVideo/`;
  ok((await waitFor(async () => (await menu.getByTestId('post-share-url').inputValue()) === pageUrl)) === true, 'a post with a preview page is shared by that page', await menu.getByTestId('post-share-url').inputValue());
  const hrefs = await menu.locator('[data-share]').evaluateAll((as) => Object.fromEntries(as.map((a) => [a.dataset.share, a.getAttribute('href')])));
  ok(Object.keys(hrefs).join() === 'facebook,telegram,whatsapp,x,linkedin,email', 'the menu offers Facebook, Telegram, WhatsApp, X, LinkedIn and email', Object.keys(hrefs));
  ok(hrefs.facebook === `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`, 'Facebook is handed the address of the post', hrefs.facebook);
  ok(hrefs.telegram.includes(encodeURIComponent(pageUrl)) && hrefs.telegram.includes('Watch%20the%20assembly') && hrefs.whatsapp.includes(encodeURIComponent(pageUrl)), 'Telegram and WhatsApp get the address and the title');
  await shot(V, 'share-menu');
  await menu.getByTestId('post-share-copy').click();
  ok((await waitFor(async () => /Copied/.test(await menu.getByTestId('post-share-copy').textContent()), 4000)) === true, 'Copy says the link was copied');
  await V.keyboard.press('Escape');
  ok((await V.getByTestId('post-share-menu').count()) === 0, 'Escape closes the menu');
  await card(V, 'postNew').getByTestId('post-share-open').click();
  await V.waitForTimeout(700);
  const newUrl = await card(V, 'postNew').getByTestId('post-share-url').inputValue();
  ok(newUrl === `${SITE}?post=postNew#announcements`, 'a post newer than the last deploy is shared by the site address', newUrl);

  console.log('\na shared address opens the post');
  const html = readFileSync(join(DIST, 'post/postFile/index.html'), 'utf8');
  ok(html.includes('<meta property="og:title" content="Class video" />') && html.includes(`<meta property="og:image" content="${SITE}post/postFile/cover.png" />`) && existsSync(join(DIST, 'post/postFile/cover.png')), 'the preview page carries the post’s title and picture for Facebook');
  const D = await openPage(browser, fake, null);
  await D.goto(`${D.base}/post/postPlain/`, { waitUntil: 'domcontentloaded' });
  await D.locator('[data-post-id="postPlain"]').waitFor({ timeout: 30000 });
  ok(/\?post=postPlain#announcements$/.test(D.url()), 'a person who opens the preview page is sent on to the post', D.url());
  ok((await waitFor(async () => (await card(D, 'postPlain').getAttribute('data-focused')) === 'true' && (await inView(D, 'postPlain')), 8000)) === true, 'the board opens at that post and marks it');
  await D.waitForTimeout(900);
  const frame2 = await D.evaluate(() => ({ inner: [...document.querySelectorAll('section, main, div')].filter((e) => e.scrollTop > 0).length, header: Math.round(document.querySelector('header').getBoundingClientRect().top) }));
  ok(frame2.inner === 0 && frame2.header === 0, 'only the window scrolls: the board is not shifted inside its frame', frame2);
  await shot(D, 'opened-from-link');
  const E = await openPage(browser, fake, null);
  await E.goto(`${E.base}/?post=postNew`, { waitUntil: 'domcontentloaded' });
  ok((await waitFor(async () => (await card(E, 'postNew').getAttribute('data-focused').catch(() => null)) === 'true', 30000)) === true, 'the address works without its # part (some sites drop it)');
  await E.goto(`${E.base}/?post=nosuchpost#announcements`, { waitUntil: 'domcontentloaded' });
  await E.locator('[data-testid="announcement-post"]').first().waitFor({ timeout: 30000 });
  ok((await E.locator('[data-focused="true"]').count()) === 0 && E.errors.length === 0, 'an address for a post that was deleted just shows the board');

  console.log('\nadmin');
  const uploads = [];
  let storageStatus = 200;
  const storage = (route, u) => {
    if (u.hostname !== 'firebasestorage.googleapis.com') return false;
    const req = route.request();
    if (req.method() === 'OPTIONS') {
      route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      return true;
    }
    if (req.method() === 'POST') {
      uploads.push({ name: u.searchParams.get('name'), type: req.headers()['content-type'], auth: (req.headers().authorization || '').slice(0, 9), bytes: (req.postDataBuffer() || Buffer.alloc(0)).length });
      route.fulfill({ status: storageStatus, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: storageStatus === 200 ? JSON.stringify({ name: u.searchParams.get('name'), downloadTokens: 'tok123' }) : '{"error":{"code":403}}' });
      return true;
    }
    route.abort();
    return true;
  };
  const A = await openPage(browser, fake, ADMIN, { intercept: storage });
  await openBoard(A);
  await A.getByRole('button', { name: 'New announcement' }).click();
  await A.getByPlaceholder('Announcement title…').fill('Khmer New Year concert');
  await A.getByPlaceholder(/Write the announcement/).fill('Tickets at the office. Details: https://example.com/concert');
  const video = A.getByTestId('composer-video-url');
  await video.fill('https://www.facebook.com/cmckhmer');
  ok((await A.getByTestId('composer-video-unknown').count()) === 1, 'an address that is not a video is pointed out while typing');
  await A.getByRole('button', { name: 'Publish' }).click();
  ok(/cannot be played/.test(await A.locator('[role="alert"]').last().textContent()) && fake.doc('announcements/auto0001') === null, 'and is not published as a video');
  await video.fill('https://fb.watch/abCdEf/');
  ok((await A.locator('[data-testid="composer-video-preview"] [data-testid="post-video"]').getAttribute('data-provider')) === 'facebook', 'a Facebook video address shows a preview of the player');
  await A.getByTestId('composer-link-url').fill('example.com/tickets');
  await A.getByTestId('composer-link-label').fill('Buy tickets');
  await shot(A, 'composer');
  await A.getByRole('button', { name: 'Publish' }).click();
  const made = await waitFor(() => fake.doc('announcements/auto0001'));
  ok(!!made && made.videoUrl === 'https://fb.watch/abCdEf/' && made.linkUrl === 'https://example.com/tickets' && made.linkLabel === 'Buy tickets' && made.authorUid === ADMIN.uid, 'publishing stores the video, the link and its words', made && { v: made.videoUrl, l: made.linkUrl, w: made.linkLabel });
  await card(A, 'auto0001').waitFor({ timeout: 10000 });
  ok((await card(A, 'auto0001').getByTestId('post-link').getAttribute('href')) === 'https://example.com/tickets' && (await card(A, 'auto0001').locator('[data-testid="post-video"]').getAttribute('data-provider')) === 'facebook', 'and the new post shows them');

  // upload a video file
  await card(A, 'postPlain').getByRole('button', { name: 'Edit' }).click();
  await A.getByTestId('composer-video-file').setInputFiles({ name: 'clip.mp4', mimeType: 'video/mp4', buffer: Buffer.alloc(4096, 7) });
  const stored = await waitFor(async () => { const v = await A.getByTestId('composer-video-url').inputValue(); return v.startsWith('https://firebasestorage') ? v : null; });
  ok(uploads.length === 1 && /^announcements\/admin-2\/\d+-[0-9a-f]{6}\.mp4$/.test(uploads[0].name) && uploads[0].type === 'video/mp4' && uploads[0].auth === 'Firebase ' && uploads[0].bytes === 4096, 'an uploaded file goes to the admin’s own folder, as a video, signed in', uploads[0]);
  ok(!!stored && stored.includes(encodeURIComponent(uploads[0]?.name || 'x')) && stored.endsWith('alt=media&token=tok123'), 'the post gets the address of the stored video', stored);
  ok((await A.locator('[data-testid="composer-video-preview"] video').count()) === 1, 'and the composer previews it');
  await A.getByRole('button', { name: 'Save changes' }).click();
  ok((await waitFor(() => fake.doc('announcements/postPlain').videoUrl === stored)) === true && fake.doc('announcements/postPlain').title === 'Sports day moves to Friday', 'saving keeps the rest of the post');
  await A.getByTestId('composer-video-file').waitFor({ state: 'detached', timeout: 10000 });
  await card(A, 'postFile').getByRole('button', { name: 'Edit' }).click();
  await A.getByTestId('composer-video-file').setInputFiles({ name: 'notes.pdf', mimeType: 'application/pdf', buffer: Buffer.from('x') });
  ok(/not a video/.test(await A.locator('[role="alert"]').last().textContent()) && uploads.length === 1, 'a file that is not a video is refused before anything is sent');
  storageStatus = 403;
  await A.getByTestId('composer-video-file').setInputFiles({ name: 'clip.webm', mimeType: 'video/webm', buffer: Buffer.alloc(64, 1) });
  ok((await waitFor(async () => /switched on/.test(await A.locator('[role="alert"]').last().textContent()))) === true && (await A.getByTestId('composer-video-url').inputValue()) === STORED, 'when upload is not switched on the composer says so and keeps the post as it was');
  ok(fake.log.length === 0, 'the app never sent a write the rules refuse', fake.log);

  console.log('\nphone and light theme');
  const P = await openPage(browser, fake, null, { w: 393, h: 852, theme: 'light' });
  await openBoard(P);
  await card(P, 'postVideo').getByTestId('post-share-open').click({ force: true });
  await P.getByTestId('post-share-menu').waitFor();
  const fit = await P.evaluate(() => {
    const r = document.querySelector('[data-testid="post-share-menu"]').getBoundingClientRect();
    return { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), vw: window.innerWidth, sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  ok(fit.left >= 0 && fit.right <= fit.vw && fit.sideways <= 1, 'the Share menu fits a phone', fit);
  await P.evaluate(() => document.querySelector('[data-testid="post-share-menu"]').scrollIntoView({ block: 'center' }));
  await shot(P, 'phone-light');
  const L = await openPage(browser, fake, null, { theme: 'light' });
  await openBoard(L);
  await card(L, 'postVideo').getByTestId('post-share-open').click({ force: true });
  await shot(L, 'laptop-light');
  // a Share button near the top of the screen opens its menu downward, on top of the next post
  await L.keyboard.press('Escape');
  await L.evaluate(() => { const b = document.querySelector('[data-post-id="postNew"] [data-testid="post-share-open"]'); window.scrollTo({ top: b.getBoundingClientRect().top + window.scrollY - 150, behavior: 'instant' }); });
  await card(L, 'postNew').getByTestId('post-share-open').click({ force: true });
  const side = await L.evaluate(() => {
    const m = document.querySelector('[data-testid="post-share-menu"]');
    const r = m.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.bottom - 30);
    return { side: m.dataset.side, top: Math.round(r.top), onTop: m.contains(top) };
  });
  ok(side.side === 'below' && side.top > 80 && side.onTop, 'near the top of the screen the menu opens downward, above the next post', side);
  await shot(L, 'menu-below');
  for (const [who, page] of [['reader', V], ['from a link', D], ['short link', E], ['admin', A], ['phone', P], ['light', L]]) ok(page.errors.length === 0, `no page errors (${who})`, page.errors);
}

checkRules();
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || undefined,
  args: ['--no-sandbox', '--disable-gpu', '--single-process', '--no-zygote'],
});
try {
  await walk(browser);
} catch (e) {
  ok(false, 'the walk ran to the end', String(e.stack || e).slice(0, 700));
} finally {
  await browser.close().catch(() => {});
  closeServers();
  rmSync(TMP, { recursive: true, force: true });
}
console.log(`\n${pass} passed, ${fail} failed`);
for (const f of fails) console.log('  FAIL ' + f);
process.exit(fail ? 1 : 0);
