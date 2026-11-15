// Mafia Noir verification — the teacher's upload (upload/mafia.html) shipped
// as public/mafia.html in the Brain Lounge (registry bay 04) with the CMC
// furniture, the three audit bug fixes (public influence channels, roster
// typing focus, online dead-end guard), 4 AI noir images and 6 TTS narrator
// lines. This verifier plays the game for real:
//   • hub furniture: identity card, share kit, AI art, back-to-CMC pill
//   • narrator audio fetched when phases fire (deal/night/dawn/vote)
//   • FULL SOLO CASE to the end modal at Rapid pace — night actions per
//     role, secret ballot, verdicts — then the CLASS LEADERBOARD block is
//     injected and the drill_attempts POST is intercepted and pinned
//     (drillSource 'brain-lounge', slug mafia.html, title 'Mafia Noir · Solo',
//     outcome-encoded correct/total, scorePct 100/50/25)
//   • pass & play: private hand-off screens appear per human
//   • online mode: without a game server the game explains itself and parks
//     the buttons (no more endless RECONNECTING)
//   • rules modal, mobile 393px overflow-free
//   • story (public/mafia-story.js): the case of the day played to the end —
//     case file intro, "say it" sentence, last words, case report, badge
//     points saved; and the page without that script plays as before
// portable: `playwright` if installed, else `playwright-core` + PW_CHROMIUM;
// MAFIA_DIST=<folder> serves another build (default ../dist)
const { chromium } = await import('playwright').catch(() => import('playwright-core'));
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const DIST = resolve(process.env.MAFIA_DIST || join(dirname(fileURLToPath(import.meta.url)), '..', 'dist'));
const PORT = 8977; const BASE = `http://127.0.0.1:${PORT}`;
const server = createServer(async (req, res) => {
  try {
    const file = normalize(decodeURIComponent(new URL(req.url, BASE).pathname));
    const data = await readFile(join(DIST, file === '/' ? 'index.html' : file));
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp3': 'audio/mpeg', '.webm': 'video/webm', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' };
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(PORT, r));
const browser = await chromium.launch({ headless: true, ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM, args: ['--no-sandbox', '--disable-gpu', '--single-process', '--no-zygote'] } : {}) });
// A single-process Chromium (PW_CHROMIUM, used where no sandboxed browser can
// run) dies when a context is closed mid-run — leave those to browser.close().
const closeCtx = (ctx) => (process.env.PW_CHROMIUM ? Promise.resolve() : ctx.close().catch(() => {}));
const results = [];
const ok = (name, cond, detail) => results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);

/* ---- A. shipped artifacts ---- */
for (const [f, min] of [['mafia.html', 100000], ['mafia-art/mafia-mafia.jpg', 50000], ['mafia-art/mafia-detective.jpg', 50000], ['mafia-art/mafia-doctor.jpg', 50000], ['mafia-art/mafia-city.jpg', 80000], ['mafia-art/mafia-city-day.jpg', 80000], ['mafia-art/mafia-villager.jpg', 30000], ['mafia-art/mafia-cardback.jpg', 50000], ['mafia-art/mafia-town-wins.jpg', 80000], ['mafia-audio/narr-night.mp3', 5000]]) {
  const s = await stat(`${DIST}/${f}`).catch(() => null);
  ok(`dist asset: ${f}`, !!s && s.size > min, s ? `${s.size}B` : 'missing');
}

/* ---- B. hub furniture + narrator + online guard (page 1) ---- */
const narrReqs = [];
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('request', r => { if (r.url().includes('mafia-audio/')) narrReqs.push(r.url().split('/').pop()); });
  await page.goto(BASE + '/mafia.html');
  ok('hub: back-to-CMC pill', await page.locator('#cmcHomeBtn').isVisible());
  ok('hub: identity card inputs', await page.locator('#cmcNameIn').isVisible() && await page.locator('#cmcIdIn').isVisible());
  ok('hub: AI art fan portraits', await page.locator('#heroFan img').count() === 3
    && await page.evaluate(() => [...document.querySelectorAll('#heroFan img')].every(i => i.complete && i.naturalWidth > 100)));
  ok('hub: hero skyline art', await page.evaluate(() => { const i = document.querySelector('.hero-art'); return !!i && i.naturalWidth > 400; }));
  ok('hub: share kit row', await page.locator('[data-cmc-share]').isVisible());
  await page.click('[data-cmc-share]');
  ok('hub: share panel opens', await page.locator('#cmcShare.show').count() === 1);
  await page.click('[data-cmc-close]');
  // rules modal
  await page.click('#rulesBtn');
  ok('rules modal', (await page.locator('#modalBox').textContent()).includes('How to Play'));
  await page.waitForFunction(() => { const i = [...document.querySelectorAll('#modalBox .hr-pic img')]; return i.length === 4 && i.every(x => x.complete); }, null, { timeout: 8000 }).catch(() => {});
  ok('rules modal: a picture for each of the 4 roles', await page.evaluate(() => { const i = [...document.querySelectorAll('#modalBox .hr-pic img')]; return i.length === 4 && i.every(x => x.naturalWidth > 100) && new Set(i.map(x => x.getAttribute('src'))).size === 4; }));
  await page.click('#modalBox .m-actions button');
  // online mode without a CMC session → the sign-in gate explains itself
  // (v66+: the transport is Firestore-backed; rooms need a signed-in CMC
  // account — the v65 parked-table modal is gone)
  await page.click('#onlineMode');
  await page.waitForSelector('#modalBox:has-text("Sign in to play online")', { timeout: 20000 }).catch(() => {});
  const modalText = await page.locator('#modalBox').textContent().catch(() => '');
  ok('online gate: no session → honest modal + CMC link (F3)', modalText.includes('Sign in to play online') && modalText.includes('SIGN IN ON CMC'), modalText.slice(0, 60));
  await page.click('#ouBack').catch(() => {});
  ok('online gate: back to modes, no dead-end', await page.evaluate(() => !!document.getElementById('hub') && !document.getElementById('hub').hidden));
  // mobile overflow
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto(BASE + '/mafia.html');
  await page.waitForTimeout(400);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok('mobile 393px: hub overflow-free', overflow <= 0, `scrollW-clientW=${overflow}`);
  await closeCtx(ctx);
}

/* ---- C. full solo case to the end + leaderboard POST (page 2) ---- */
const posts = [];
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('request', r => { if (r.url().includes('mafia-audio/')) narrReqs.push(r.url().split('/').pop()); });
  await page.route('**/drill_attempts*', async route => {
    if (route.request().method() === 'POST') {
      posts.push(JSON.parse(route.request().postData() || '{}'));
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"name":"projects/p/databases/(default)/documents/drill_attempts/x"}' });
    } else route.continue();
  });
  // identity preset → the finished case auto-posts
  await page.addInitScript(() => {
    localStorage.setItem('cmc-player-name', JSON.stringify({ name: 'Vireak Bot', at: Date.now() }));
    localStorage.setItem('cmc-player-id', '7A · 12');
  });
  await page.goto(BASE + '/mafia.html');
  await page.click('#soloMode');
  await page.selectOption('#paceSel', '0.55');
  await page.click('#dealBtn');
  // reveal: flip the card, then hide it
  await page.waitForSelector('#roleCard .back', { timeout: 15000 });
  await page.waitForFunction(() => { const i = document.querySelector('#roleCard .back .cb-art'); return !!i && i.complete; }, null, { timeout: 8000 }).catch(() => {});
  ok('deal: card back shows the painted back', await page.evaluate(() => { const i = document.querySelector('#roleCard .back .cb-art'); if (!i || i.naturalWidth < 300) return false; const a = i.getBoundingClientRect(), b = i.closest('.back').getBoundingClientRect(); return Math.abs(a.width - b.width) < 4 && Math.abs(a.height - b.height) < 4; }));
  await page.click('#roleCard .back');
  await page.waitForSelector('#hideCardBtn:not([hidden])', { timeout: 8000 });
  await page.waitForFunction(() => { const i = document.querySelector('#roleCard .rf-art img'); return !!i && i.complete; }, null, { timeout: 8000 }).catch(() => {});
  const front = await page.evaluate(() => {
    const f = document.querySelector('#roleCard .rolefront'), i = f && f.querySelector('.rf-art img');
    if (!f || !i) return null;
    const box = f.getBoundingClientRect(), d = f.querySelector('.rf-desc').getBoundingClientRect(), x = f.querySelector('.rf-extra').getBoundingClientRect();
    return { art: f.classList.contains('has-art'), w: i.naturalWidth, src: i.getAttribute('src'), name: f.querySelector('.rf-name').textContent,
      fits: d.bottom <= x.top + 1 && x.bottom <= box.bottom && f.scrollHeight <= f.clientHeight };
  });
  const artFor = { Mafia: 'mafia', Detective: 'detective', Doctor: 'doctor', Citizen: 'villager' };
  ok('deal: role card carries its own picture', !!front && front.art && front.w > 300 && front.src === `mafia-art/mafia-${artFor[front.name]}.jpg`, front ? `${front.name} → ${front.src}` : 'no card');
  ok('deal: role card text fits under the picture', !!front && front.fits);
  await page.click('#hideCardBtn');
  const role = (await page.locator('#rolePanel .role-head b').first().textContent() || '').trim();
  ok('solo: role panel reveals a role', ['Mafia', 'Detective', 'Doctor', 'Citizen'].includes(role), role);

  // play nights/days until the end modal (ghost view keeps auto-playing
  // after the human is out — 60 rounds ≈ 5-8 night/day cycles)
  let ended = false, rounds = 0;
  while (!ended && rounds++ < 60) {
    await page.waitForTimeout(700);
    // any modal → press its primary button (dawn reports, verdicts, investigations)
    if (await page.locator('#modalBox .m-actions button').count()) {
      const t = (await page.locator('#modalBox').textContent()) || '';
      if (t.includes('CASE CLOSED') || await page.locator('#modalBox .reveal-grid').count()) { ended = true; break; }
      await page.click('#modalBox .m-actions button');
      await page.waitForTimeout(500);
      continue;
    }
    const barText = (await page.locator('#actionBar').textContent().catch(() => '')) || '';
    if (await page.locator('.seat.selectable').count()) {
      await page.locator('.seat.selectable').first().click();
      const confirm = page.locator('#confirmLocal');
      if (await confirm.count() && await confirm.isEnabled()) { await confirm.click(); await page.waitForTimeout(400); }
      else { const ab = page.locator('#abstainLocal'); if (await ab.count()) await ab.click(); }
      continue;
    }
    if (await page.locator('#voteCallBtn').count()) { await page.click('#voteCallBtn'); await page.waitForTimeout(400); continue; }
    if (await page.locator('#skipLocal').count()) { await page.click('#skipLocal').catch(() => {}); await page.waitForTimeout(600); continue; }
    // night as citizen: nothing to click — the phase advances on its own
    await page.waitForTimeout(1200);
  }
  ok(`solo: full case reached the end modal (${role})`, ended, `${rounds} rounds`);
  const endText = ended ? (await page.locator('#modalBox').textContent()) : '';
  ok('end modal: reveal grid + case stats', ended && await page.locator('#modalBox .reveal-grid').count() === 1 && endText.includes('Nights'));
  ok('end modal: every player tile is visible', ended && await page.evaluate(async () => {
    await new Promise(r => setTimeout(r, 2200));
    const t = [...document.querySelectorAll('#modalBox .rev')];
    return t.length >= 5 && t.every(e => getComputedStyle(e).opacity === '1');
  }));
  {
    const townWon = endText.includes('THE CITY ENDURES');
    await page.waitForFunction(() => { const i = document.querySelector('#modalBox .end-art img'); return !i || i.complete; }, null, { timeout: 8000 }).catch(() => {});
    const art = await page.evaluate(() => { const i = document.querySelector('#modalBox .end-art img'); return i ? i.naturalWidth : 0; });
    ok('end modal: sunrise picture when the city wins, none otherwise', ended && (townWon ? art > 400 : art === 0), `${townWon ? 'city' : 'syndicate'} won · picture ${art}px`);
  }
  ok('end modal: class leaderboard block injected', ended && await page.locator('#modalBox .cmc-lb').count() === 1);
  ok('end modal: identity mirrored', ended && (await page.inputValue('#cmcLbName')) === 'Vireak Bot'
    && (await page.inputValue('#cmcLbId')) === '7A · 12');
  ok('end modal: auto-sent exactly once', posts.length === 1, `${posts.length} POST(s)`);
  if (posts.length) {
    const f = posts[0].fields || {};
    const name = f.studentName?.stringValue || '';
    ok('POST: pipeline fields', f.drillSlug?.stringValue === 'mafia.html'
      && f.drillSource?.stringValue === 'brain-lounge'
      && /^Mafia Noir · Solo$/.test(f.drillTitle?.stringValue || '')
      && name.startsWith('Vireak Bot · 7A · 12'), `${f.drillTitle?.stringValue} · ${name}`);
    const pct = Number(f.scorePct?.integerValue || '0'), c = Number(f.correctCount?.integerValue || '0'), t = Number(f.totalCount?.integerValue || '0');
    ok('POST: outcome-encoded score', [100, 50, 25].includes(pct) && t === 1 && c === (pct === 100 ? 1 : 0), `pct ${pct} · ${c}/${t}`);
    ok('POST: guest branch shape', (f.studentUid?.stringValue || '') === '' && f.classId?.nullValue === null);
  }
  ok('narrator: phase audio fetched during play', narrReqs.length >= 1, [...new Set(narrReqs)].join(', ') || 'none');
  // manual re-send still works after the auto-post (retry path)
  await page.click('#cmcLbSend');
  await page.waitForTimeout(900);
  ok('POST: manual re-send allowed (new case id untouched)', posts.length === 2, `${posts.length} POST(s)`);
  await closeCtx(ctx);
}

/* ---- D. pass & play hand-offs (page 3) ---- */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/mafia.html');
  await page.click('#localMode');
  await page.selectOption('#paceSel', '0.55');
  await page.click('#dealBtn');
  await page.waitForSelector('#modalBox:has-text("PASS THE DEVICE")', { timeout: 15000 }).catch(() => {});
  const t = (await page.locator('#modalBox').textContent().catch(() => '')) || '';
  ok('pass&play: private hand-off screens', t.includes('PASS THE DEVICE'), t.slice(0, 50));
  await page.click('#modalBox .m-actions button');
  await page.waitForSelector('#roleCard .back', { timeout: 10000 }).catch(() => {});
  ok('pass&play: card reveal behind the hand-off', await page.locator('#roleCard .back').count() === 1);
  await closeCtx(ctx);
}

/* ---- E. artwork: phone layout, city-wins screen, and no picture at all ---- */
const fakeEnd = (winner) => {
  const roles = ['mafia', 'detective', 'doctor', 'villager', 'villager', 'mafia', 'villager', 'villager'];
  const players = roles.map((r, i) => ({ id: 'p' + i, name: 'Seat ' + (i + 1), role: r, alive: i % 2 === 0, fate: i % 2 ? 'voted' : null, seed: i + 3, color: '#e8b64c' }));
  showEndModal({ winner, players, you: players[0], room: { night: 3, hostId: 'x' }, stats: { kills: 2, saves: 1, lynch: 2 } }, true);
};
{
  const ctx = await browser.newContext({ viewport: { width: 360, height: 640 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/mafia.html');
  await page.evaluate(fakeEnd, 'town');
  await page.waitForFunction(() => { const i = document.querySelector('#modalBox .end-art img'); return !!i && i.complete; }, null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(400);
  const e = await page.evaluate(() => {
    const box = document.getElementById('modalBox'), i = box.querySelector('.end-art img'), t = box.querySelector('.m-title');
    const b = box.getBoundingClientRect(), a = i ? i.parentNode.getBoundingClientRect() : null, tt = t.getBoundingClientRect(); // the frame, not the picture: it eases in slightly enlarged
    return { w: i ? i.naturalWidth : 0, top: box.scrollTop, scrolls: box.scrollHeight > box.clientHeight + 40, artSeen: !!a && a.top >= b.top - 1 && a.bottom <= innerHeight, titleSeen: tt.top >= b.top && tt.bottom <= innerHeight,
      wide: !!a && Math.abs(a.width - b.width) <= 4, over: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  ok('phone: city-wins screen opens on the picture and the verdict', e.w > 400 && e.top === 0 && e.scrolls && e.artSeen && e.titleSeen, JSON.stringify(e));
  ok('phone: picture spans the box, page overflow-free', e.wide && e.over <= 0, `overflow ${e.over}`);
  await page.evaluate(() => closeModal());
  await page.evaluate(fakeEnd, 'mafia');
  ok('syndicate-wins screen: no sunrise picture', await page.locator('#modalBox .end-art').count() === 0 && (await page.locator('#modalBox').textContent()).includes('THE SYNDICATE OWNS THE NIGHT'));
  // every role card on the narrowest phone: text stays clear of the footer line
  await page.evaluate(() => closeModal());
  await page.setViewportSize({ width: 320, height: 640 });
  const fits = await page.evaluate(async () => {
    const out = [];
    for (const k of ['mafia', 'detective', 'doctor', 'villager']) {
      openModal(`<div class="card3d flipped"><div class="inner"><div class="face front">${roleFrontHTML(k, 'SELF-SAVE: 1 LEFT')}</div></div></div>`);
      const f = document.querySelector('#modalBox .rolefront'), i = f.querySelector('.rf-art img');
      if (!i) { out.push(`${k}:no picture:BAD`); closeModal(); continue; }
      await new Promise(r => { if (i.complete) r(); else { i.onload = r; setTimeout(r, 4000); } });
      const d = f.querySelector('.rf-desc').getBoundingClientRect(), x = f.querySelector('.rf-extra').getBoundingClientRect(), b = f.getBoundingClientRect();
      out.push(`${k}:${Math.round(b.width)}:${i.naturalWidth > 300 && d.bottom <= x.top + 1 && x.bottom <= b.bottom ? 'ok' : 'BAD'}`);
      closeModal();
    }
    return out;
  });
  ok('all four role cards: picture loads and text fits on a 320px phone', fits.every(f => f.endsWith(':ok')), fits.join(' '));
  await closeCtx(ctx);
}
{
  // pictures unreachable (first visit with a dropped connection): the game must look as it did before
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.route('**/mafia-art/**', r => r.abort());
  await page.goto(BASE + '/mafia.html');
  await page.evaluate(() => {
    openModal(`<div class="card3d" id="t1"><div class="inner"><div class="face back">${cardBackSVG()}</div></div></div><div class="card3d flipped" id="t2"><div class="inner"><div class="face front">${roleFrontHTML('doctor', '')}</div></div></div>`);
  });
  await page.waitForFunction(() => !document.querySelector('#t1 .cb-art') && !document.querySelector('#t2 .has-art'), null, { timeout: 8000 }).catch(() => {});
  const fb = await page.evaluate(() => {
    const svg = document.querySelector('#t1 .back svg'), f = document.querySelector('#t2 .rolefront'), ic = f.querySelector('.rf-icon').getBoundingClientRect(), art = f.querySelector('.rf-art');
    return { back: !!svg && svg.getBoundingClientRect().height > 200 && !document.querySelector('#t1 .cb-art'), front: !!art && !f.classList.contains('has-art') && getComputedStyle(art).display === 'none' && ic.width > 80 };
  });
  ok('no pictures: drawn card back still shows', fb.back);
  ok('no pictures: role card falls back to the icon design', fb.front);
  await page.evaluate(() => closeModal());
  await page.evaluate(fakeEnd, 'town');
  await page.waitForFunction(() => !document.querySelector('#modalBox .end-art'), null, { timeout: 8000 }).catch(() => {});
  ok('no pictures: drawn moon and skyline stay as the backdrop', await page.evaluate(() => {
    const bg = document.getElementById('bg'), moon = document.getElementById('moon');
    return !bg.classList.contains('has-art') && !bg.classList.contains('has-day') && getComputedStyle(moon).display !== 'none'
      && getComputedStyle(document.getElementById('bgNight')).opacity === '0' && !!document.querySelector('#skyB svg');
  }));
  ok('no pictures: city-wins screen drops the empty banner', await page.locator('#modalBox .end-art').count() === 0 && await page.locator('#modalBox .m-title').isVisible());
  await closeCtx(ctx);
}

/* ---- F. city backdrops: night city, dawn city, cross-fade with the phase ---- */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/mafia.html');
  await page.waitForFunction(() => { const c = document.getElementById('bg').classList; return c.contains('has-art') && c.contains('has-day'); }, null, { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(2600); // the fade
  const look = () => page.evaluate(() => {
    const o = (id) => Number(getComputedStyle(document.getElementById(id)).opacity), img = (id) => getComputedStyle(document.getElementById(id)).backgroundImage, shown = (id) => getComputedStyle(document.getElementById(id)).display !== 'none';
    return { bgNight: o('bgNight'), bgDay: o('bgDay'), twNight: o('twNight'), twDay: o('twDay'), nightImg: img('bgNight').includes('mafia-city.jpg') && img('twNight').includes('mafia-city.jpg'), dayImg: img('bgDay').includes('mafia-city-day.jpg') && img('twDay').includes('mafia-city-day.jpg'),
      moon: shown('moon'), sun: shown('sun'), sky: shown('skyA') || shown('skyB'), wash: shown('dayWash'), heroArt: getComputedStyle(document.querySelector('.hero-art')).display !== 'none' };
  });
  // A fade is 2.2 s on an idle machine; under load the browser is late, so
  // wait for the layers to settle instead of trusting a fixed pause.
  const settled = (night) => page.waitForFunction((night) => {
    const o = (id) => Number(getComputedStyle(document.getElementById(id)).opacity);
    return night ? o('bgNight') > 0.6 && o('twNight') > 0.49 && o('bgDay') < 0.002 && o('twDay') < 0.002 : o('bgDay') > 0.59 && o('twDay') > 0.54 && o('bgNight') < 0.002 && o('twNight') < 0.002;
  }, night, { timeout: 12000 }).catch(() => {});
  await settled(true);
  const n = await look();
  ok('backdrop at night: night city behind the page and the table', n.nightImg && n.bgNight > 0.4 && n.twNight > 0.3 && n.bgDay < 0.002 && n.twDay < 0.002, JSON.stringify(n));
  ok('backdrop: drawn moon, skyline and old hero strip step aside', !n.moon && !n.sky && !n.heroArt);
  await page.evaluate(() => { document.body.dataset.phase = 'day'; });
  await page.waitForTimeout(2800);
  await settled(false);
  const d = await look();
  ok('backdrop by day: dawn city fades in, night city fades out', d.dayImg && d.bgDay > 0.4 && d.twDay > 0.3 && d.bgNight < 0.002 && d.twNight < 0.002 && !d.sun && !d.wash, JSON.stringify(d));
  await page.evaluate(() => { document.body.dataset.phase = 'night'; });
  // the table stays readable on top of the picture: seats sit above it
  await page.click('#soloMode'); await page.selectOption('#paceSel', '0.55'); await page.click('#dealBtn');
  await page.waitForSelector('#roleCard .back', { timeout: 15000 });
  await page.click('#roleCard .back'); await page.waitForSelector('#hideCardBtn:not([hidden])', { timeout: 8000 }); await page.click('#hideCardBtn');
  await page.waitForSelector('.seat', { timeout: 8000 }).catch(() => {});
  ok('table: every seat is in front of the picture', await page.evaluate(() => {
    const seats = [...document.querySelectorAll('#table .seat')];
    return seats.length >= 5 && seats.every(s => { const r = s.getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, Math.max(r.top + r.height / 2, 70)); return !!e && (s === e || s.contains(e)); });
  }));
  await closeCtx(ctx);
}

/* ---- G. story: case of the day played to the end (public/mafia-story.js) ---- */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.route('**/drill_attempts*', route => route.request().method() === 'POST' ? route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }) : route.continue());
  await page.goto(BASE + '/mafia.html');
  // start from an empty badge: a single-process Chromium (PW_CHROMIUM) shares
  // localStorage between contexts, and section C has already closed a case
  await page.evaluate(() => { localStorage.removeItem('mnCareer'); localStorage.removeItem('mnCounted'); });
  await page.reload();
  await page.waitForSelector('#mnsDesk #mnsDaily', { timeout: 8000 }).catch(() => {});
  const desk = await page.evaluate(() => {
    const d = document.getElementById('mnsDesk'); if (!d) return null;
    const grid = document.querySelector('#hub .mode-grid');
    return { after: grid.nextElementSibling === d, rank: d.querySelector('.mns-rank')?.textContent, note: d.querySelector('.mns-note')?.textContent || '', files: d.querySelectorAll('.mns-files span').length, daily: d.querySelector('.mns-daily-title')?.textContent, titles: window.MNStory.CASES.map(c => c.title) };
  });
  ok('story desk: badge, six case files and the case of the day under the three modes', !!desk && desk.after && desk.rank === 'Rookie' && desk.note.startsWith('0 points') && desk.files === 6 && desk.titles.includes(desk.daily), desk ? `${desk.rank} · ${desk.files} files · ${desk.daily}` : 'no desk');
  const expected = await page.evaluate(() => window.MNStory.dailyDeal(window.MNStory.todayKey(), AI_NAMES));
  await page.click('#mnsDaily');
  await page.waitForSelector('#roleCard .back', { timeout: 15000 });
  const dealt = await page.evaluate(() => ({ roles: L.players.map(p => p.role), names: L.players.slice(1).map(p => p.name), pace: L.pace }));
  ok('case of the day: the table and every card come from the date', JSON.stringify(dealt.roles) === JSON.stringify(expected.roles) && JSON.stringify(dealt.names) === JSON.stringify(expected.names), dealt.roles.join(','));
  await page.evaluate(() => { L.pace = 0.55; });
  await page.click('#roleCard .back'); await page.waitForSelector('#hideCardBtn:not([hidden])', { timeout: 8000 }); await page.click('#hideCardBtn');
  const intro = await page.evaluate(() => { const f = document.getElementById('feed'), kids = [...f.children]; return { first: kids[0]?.textContent || '', story: f.querySelectorAll('.mns-story').length, cast: f.querySelector('.mns-cast')?.textContent || '', prologueAt: kids.findIndex(k => k.textContent === 'PROLOGUE'), castAt: kids.findIndex(k => k.classList.contains('mns-cast')) }; });
  ok('case file: number, opening scene and the cast come before the prologue', /^CASE No\. \d{3}$/.test(intro.first) && intro.story === 3 && /At the table: .+, .+ · /.test(intro.cast) && intro.castAt > 0 && intro.castAt < intro.prologueAt, `${intro.first} · ${intro.story} lines · cast@${intro.castAt} prologue@${intro.prologueAt}`);

  // play to the end: say one accusation as a sentence, give last words if asked
  let ended = false, rounds = 0, said = 0, lastWordsAsked = 0, sayShape = null;
  while (!ended && rounds++ < 160) {
    await page.waitForTimeout(450);
    if (await page.locator('#modalBox .mns-say').count()) {
      const isLast = await page.locator('#mnsLast').count();
      if (isLast) { lastWordsAsked++; await page.fill('#mnsLast', 'I am <b>not</b> the one you want.'); await page.click('#mnsLastGo'); continue; }
      sayShape = await page.evaluate(() => ({ options: [...document.querySelectorAll('#modalBox .mns-say button')].map(b => b.textContent), own: document.getElementById('mnsOwn').value, title: document.querySelector('#modalBox .m-title').textContent }));
      await page.fill('#mnsOwn', sayShape.own + 'they were <i>too</i> calm.'); await page.click('#mnsOwnGo'); said++; continue;
    }
    if (await page.locator('#modalBox .m-actions button').count()) {
      if (await page.locator('#modalBox .reveal-grid').count()) { ended = true; break; }
      await page.click('#modalBox .m-actions button'); continue;
    }
    if (said === 0 && await page.locator('#accuseLocal:not([disabled])').count() && !(await page.locator('.seat.selectable').count())) { await page.click('#accuseLocal'); continue; }
    if (await page.locator('.seat.selectable').count()) {
      await page.locator('.seat.selectable').first().click();
      const c = page.locator('#confirmLocal');
      if (await c.count() && await c.isEnabled()) await c.click(); else { const ab = page.locator('#abstainLocal'); if (await ab.count()) await ab.click(); }
      continue;
    }
    if (await page.locator('#voteCallBtn').count()) { await page.click('#voteCallBtn'); continue; }
    if (await page.locator('#skipLocal').count()) { await page.click('#skipLocal').catch(() => {}); continue; }
    await page.waitForTimeout(700);
  }
  ok('story case: played to CASE CLOSED', ended, `${rounds} rounds`);
  if (sayShape) {
    const who = sayShape.own.replace(/^I suspect | because $/g, '');
    ok('say it: full sentences about the accused, and a sentence to finish', sayShape.options.length >= 3 && sayShape.options.every(o => o.includes(who) && o.endsWith('.')) && /^I suspect .+ because $/.test(sayShape.own) && sayShape.title.includes(who), sayShape.own);
    const mine = await page.evaluate(() => [...document.querySelectorAll('#feed .msg.public .btext')].map(b => ({ text: b.textContent, tags: b.querySelectorAll('i').length })).find(b => b.text.includes('too</i> calm') || b.text.includes('too calm')));
    ok('say it: the sentence is spoken at the table, typed tags shown as text', !!mine && mine.tags === 0 && mine.text.includes('<i>too</i>'), mine ? mine.text : 'not found');
  } else ok('say it: (the player was out before the first discussion — not reached this run)', true);
  await page.waitForTimeout(600);
  const end = await page.evaluate(() => {
    const box = document.getElementById('modalBox'), q = (s) => box.querySelector(s);
    const order = [...box.children].map(e => e.className.split(' ').pop());
    return { kicker: q('.m-kicker')?.textContent || '', epi: q('.mns-epi')?.textContent || '', lead: q('.mns-lead')?.textContent || '', rows: [...box.querySelectorAll('.mns-row')].map(r => ({ label: r.querySelector('b').textContent, text: r.querySelector('span').textContent })),
      career: q('.mns-career')?.textContent || '', order, nights: L.night, winner: L.winner, events: MNS.state.game.events.length, c: MNS.state.game.c, store: JSON.parse(localStorage.getItem('mnCareer') || 'null'),
      lastWords: [...document.querySelectorAll('#feed .mns-lastwords')].length, lynch: L.stats.lynch, jobs: document.querySelectorAll('#feed .mns-job').length, humanOut: L.players[0].fate === 'voted', bTags: document.querySelectorAll('#feed .mns-lastwords b').length,
      youWon: (L.players[0].role === 'mafia') === (L.winner === 'mafia'), alive: L.players[0].alive };
  });
  ok('end screen: the case is named and closes with its own ending and a lead', end.kicker.startsWith(end.c.title + ' · CASE CLOSED') && end.epi === (end.winner === 'town' ? end.c.town : end.c.mafia) && end.lead === end.c.lead, end.kicker);
  const nightsTold = end.rows.filter(r => r.label.startsWith('Night')), daysTold = end.rows.filter(r => r.label.startsWith('Day'));
  ok('case report: one entry for every night and every vote', end.rows.length === end.events && nightsTold.length === end.nights && nightsTold.every(r => r.text.includes('The Syndicate chose')) && daysTold.every(r => /voted out\.$/.test(r.text)), `${nightsTold.length} nights · ${daysTold.length} days`);
  ok('case report sits between the role tiles and the stats', end.order.indexOf('reveal-grid') < end.order.indexOf('mns-report') && end.order.indexOf('mns-report') < end.order.indexOf('stats-row') && end.order.indexOf('stats-row') < end.order.indexOf('mns-career'), end.order.join(' > '));
  ok('last words: one for every player voted out', end.lastWords === end.lynch && (!end.humanOut || lastWordsAsked === 1) && end.bTags === 0, `${end.lastWords} of ${end.lynch} · asked the player ${lastWordsAsked}×`);
  ok('characters: AI lines carry the speaker\'s job', end.jobs >= 1, `${end.jobs} lines`);
  const want = end.youWon ? 100 + (end.alive ? 25 : 0) + 50 : 20, today = await page.evaluate(() => window.MNStory.todayKey());
  ok('badge: points for this case are saved on the device', !!end.store && end.store.xp === want && end.store.games === 1 && end.store.wins === (end.youWon ? 1 : 0) && end.store.daily[today]?.won === end.youWon && end.career.includes(`+${want} points`), end.store ? `${end.store.xp} points (${end.youWon ? 'won' : 'lost'})` : 'nothing saved');
  // back on the hub the desk shows the new total; a reload keeps it
  await page.reload();
  await page.waitForSelector('#mnsDesk', { timeout: 8000 }).catch(() => {});
  const after = await page.evaluate(() => ({ note: document.querySelector('#mnsRank .mns-note')?.textContent || '', go: document.querySelector('#mnsDaily .mns-go')?.textContent || '' }));
  ok('badge: the total survives a reload and today\'s case shows its result', after.note.startsWith(`${want} points`) && after.note.includes('1 case played') && (end.youWon ? after.go.includes('SOLVED') : after.go.includes('TRY AGAIN')), `${after.note.slice(0, 40)} · ${after.go}`);
  ok('story: no page errors', errors.length === 0, errors.join(' | ').slice(0, 200));
  await closeCtx(ctx);
}

/* ---- H. the game without the story script: plays as before ---- */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.route('**/mafia-story.js', route => route.abort());
  await page.goto(BASE + '/mafia.html');
  await page.click('#soloMode'); await page.selectOption('#paceSel', '0.55'); await page.click('#dealBtn');
  await page.waitForSelector('#roleCard .back', { timeout: 15000 });
  await page.click('#roleCard .back'); await page.waitForSelector('#hideCardBtn:not([hidden])', { timeout: 8000 }); await page.click('#hideCardBtn');
  let dawn = '', rounds = 0;
  while (!dawn && rounds++ < 60) {
    await page.waitForTimeout(500);
    dawn = await page.evaluate(() => [...document.querySelectorAll('#feed .msg.system.big')].map(m => m.textContent).find(t => /Their card reads|Everyone wakes up alive/.test(t)) || '');
    if (dawn) break;
    if (await page.locator('#modalBox .m-actions button').count()) { await page.click('#modalBox .m-actions button'); continue; }
    if (await page.locator('.seat.selectable').count()) { await page.locator('.seat.selectable').first().click(); const c = page.locator('#confirmLocal'); if (await c.count() && await c.isEnabled()) await c.click(); continue; }
    if (await page.locator('#skipLocal').count()) await page.click('#skipLocal').catch(() => {});
  }
  ok('without the story script: no desk, the first dawn still reads properly', await page.locator('#mnsDesk').count() === 0 && /(Blue Note Club|Fifth Street lamppost|from the docks)\. Their card reads: |Doctor's hands were quicker\. Everyone wakes up alive\./.test(dawn) && errors.length === 0, (dawn || 'no dawn line').slice(0, 90) + (errors.length ? ' · ' + errors[0] : ''));
  await closeCtx(ctx);
}

await browser.close();
server.close();
console.log(results.join('\n'));
const fails = results.filter(r => r.startsWith('FAIL'));
console.log(`\nverify_mafia: ${results.length - fails.length} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
