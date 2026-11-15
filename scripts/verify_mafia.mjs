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
for (const [f, min] of [['mafia.html', 100000], ['mafia-art/mafia-mafia.jpg', 50000], ['mafia-art/mafia-detective.jpg', 50000], ['mafia-art/mafia-doctor.jpg', 50000], ['mafia-art/mafia-city.jpg', 80000], ['mafia-art/mafia-villager.jpg', 30000], ['mafia-art/mafia-cardback.jpg', 50000], ['mafia-art/mafia-town-wins.jpg', 80000], ['mafia-audio/narr-night.mp3', 5000]]) {
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
  ok('no pictures: city-wins screen drops the empty banner', await page.locator('#modalBox .end-art').count() === 0 && await page.locator('#modalBox .m-title').isVisible());
  await closeCtx(ctx);
}

await browser.close();
server.close();
console.log(results.join('\n'));
const fails = results.filter(r => r.startsWith('FAIL'));
console.log(`\nverify_mafia: ${results.length - fails.length} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
