// Word Creator — browser check of the start screen and of online play.
//
// The first online build was never played on two devices, and it showed:
// scores stayed at 0 on the other device, both players drew the same tiles,
// a reload dealt the opening rack again and no online match could end. Online
// play is now a replay (public/arcade/word-creator/online.js): the room keeps
// a seed, the seats and an append-only move log, and every device rebuilds
// the table from those. This script plays real matches between separate
// signed-in browsers against an in-memory copy of the room store, with the
// word_creator_rooms rules from firestore.rules written out in JS, so a write
// the real rules would refuse is refused here too.
//
//   rules    the rule model refuses the cheats and allows a join and a move
//   offline  start screen, Solo and Pass & Play, word count, icons, no
//            sideways scroll, on a laptop and on a phone
//   two      lobby, room code, join by code, six moves: board, owners,
//            scores, racks, bag and turn agree after every move
//   reload   both devices reload mid-match and rebuild the same table
//   passes   four passes end the match for both; one leaderboard post each
//   three    two classmates join in the same moment and both keep a seat
//   full     a whole match played to the end
//
//   node scripts/verify_word_creator.mjs
//   WC_ONLY=two,full   run some of the above
//   WC_DIST=dir        serve another folder (default ../dist)
//   WC_SHOTS=dir       also save screenshots
//   PW_CHROMIUM=/path  use this Chromium binary (with playwright-core)
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = await import('playwright').catch(() => import('playwright-core'));

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(process.env.WC_DIST || join(HERE, '..', 'dist'));
const SHOTS = process.env.WC_SHOTS ? resolve(process.env.WC_SHOTS) : null;
const PORT = 8974;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.webp': 'image/webp',
  '.gz': 'application/gzip',
};

/** A static server. `gzEncoding` sends .gz files the way some hosts do: already marked as gzip-encoded. */
function serve(port, { gzEncoding = false } = {}) {
  const srv = createServer((req, res) => {
    let p = decodeURIComponent((req.url || '/').split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const f = join(DIST, p);
    if (!f.startsWith(DIST) || !existsSync(f) || statSync(f).isDirectory()) {
      res.writeHead(404);
      res.end();
      return;
    }
    const h = { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' };
    if (extname(f) === '.gz' && gzEncoding) h['Content-Encoding'] = 'gzip';
    res.writeHead(200, h);
    createReadStream(f).pipe(res);
  });
  return new Promise((done) => srv.listen(port, '127.0.0.1', () => done(srv)));
}
// One origin per player. A single-process Chromium shares localStorage between
// contexts on the same origin, which would sign every "device" in as the first
// player. Origins 0-3 are the four seats; 4 and 5 belong to the offline walk
// (5 sends the word list gzip-encoded).
const srvs = [];
for (let i = 0; i < 5; i++) srvs.push(await serve(PORT + i));
srvs.push(await serve(PORT + 5, { gzEncoding: true }));
const UO = (p) => `http://127.0.0.1:${PORT + p.__i}/arcade/word-creator/index.html`;

const b = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || undefined,
  args: ['--no-sandbox', '--disable-gpu', '--single-process', '--no-zygote', '--disable-dev-shm-usage'],
});
const shot = async (page, name) => {
  if (SHOTS) await page.screenshot({ path: join(SHOTS, `${name}.png`) });
};

// ── an in-memory stand-in for the Firestore REST API ────────────────────────
function makeFake({ strictRules = true } = {}) {
  const docs = new Map();
  const attempts = [];
  const log = [];
  let tick = 0;
  const uidOf = (req) => {
    try {
      const t = (req.headers()['authorization'] || '').replace('Bearer ', '');
      return JSON.parse(Buffer.from(t.split('.')[1], 'base64').toString()).user_id;
    } catch {
      return null;
    }
  };
  const plain = (f) => {
    const v = (x) =>
      x.stringValue !== undefined
        ? x.stringValue
        : x.integerValue !== undefined
          ? Number(x.integerValue)
          : x.booleanValue !== undefined
            ? x.booleanValue
            : x.nullValue !== undefined
              ? null
              : x.timestampValue !== undefined
                ? { $ts: Date.parse(x.timestampValue) }
                : x.arrayValue
                  ? (x.arrayValue.values || []).map(v)
                  : x.mapValue
                    ? Object.fromEntries(Object.entries(x.mapValue.fields || {}).map(([k, y]) => [k, v(y)]))
                    : undefined;
    return Object.fromEntries(Object.entries(f).map(([k, y]) => [k, v(y)]));
  };
  const seated = (seats, uid) => seats.some((s) => s.uid === uid);
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  function canCreate(n, id, uid) {
    return (
      n.code === id &&
      n.hostUid === uid &&
      typeof n.hostName === 'string' &&
      n.hostName.length > 0 &&
      n.hostName.length <= 40 &&
      typeof n.seed === 'string' &&
      n.seed.length >= 8 &&
      Number.isInteger(n.seatsWanted) &&
      n.seatsWanted >= 2 &&
      n.seatsWanted <= 4 &&
      n.status === 'waiting' &&
      n.seats.length === 1 &&
      n.seats[0].uid === uid &&
      n.seats[0].host === true &&
      n.moves.length === 0 &&
      n.turn === 0 &&
      n.result === null
    );
  }
  // line for line the update rule in firestore.rules
  function canUpdate(o, n, uid) {
    if (n.code !== o.code || n.hostUid !== o.hostUid || n.hostName !== o.hostName || n.seed !== o.seed || n.seatsWanted !== o.seatsWanted)
      return 'frozen field';
    if (!Array.isArray(n.seats) || !Array.isArray(n.moves)) return 'not lists';
    const join =
      o.status === 'waiting' &&
      !seated(o.seats, uid) &&
      o.seats.length < o.seatsWanted &&
      n.seats.length === o.seats.length + 1 &&
      eq(n.seats.slice(0, o.seats.length), o.seats) &&
      n.seats[o.seats.length].uid === uid &&
      n.seats[o.seats.length].host === false &&
      n.moves.length === 0 &&
      n.turn === 0 &&
      n.result === null &&
      ((n.seats.length === o.seatsWanted && n.status === 'playing') || (n.seats.length < o.seatsWanted && n.status === 'waiting'));
    const move =
      o.status === 'playing' &&
      eq(n.seats, o.seats) &&
      n.moves.length === o.moves.length + 1 &&
      eq(n.moves.slice(0, o.moves.length), o.moves) &&
      o.seats[o.moves.length % o.seats.length].uid === uid &&
      n.moves[o.moves.length].uid === uid &&
      n.turn === n.moves.length % o.seats.length &&
      ((n.status === 'playing' && n.result === null) || (n.status === 'finished' && n.result !== null));
    return join || move ? '' : 'neither a join nor an own-turn move';
  }
  function handle(route, u) {
    if (u.hostname !== 'firestore.googleapis.com') return false;
    const req = route.request();
    const m = req.method();
    const uid = uidOf(req);
    const path = decodeURIComponent(u.pathname.split('/documents')[1] || '');
    const json = (status, body) =>
      route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
    if (m === 'OPTIONS') {
      route.fulfill({
        status: 204,
        headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' },
      });
      return true;
    }
    if (path.startsWith('/drill_attempts') && m === 'POST') {
      attempts.push({ uid, ...plain(JSON.parse(req.postData()).fields) });
      json(200, {});
      return true;
    }
    if (!path.startsWith('/word_creator_rooms')) {
      json(404, { error: { status: 'NOT_FOUND' } });
      return true;
    }
    if (!uid) {
      json(401, { error: { status: 'UNAUTHENTICATED' } });
      return true;
    }
    if (m === 'POST') {
      const id = u.searchParams.get('documentId');
      const fields = JSON.parse(req.postData()).fields;
      if (docs.has(id)) {
        json(409, { error: { status: 'ALREADY_EXISTS', message: 'exists' } });
        return true;
      }
      if (strictRules && !canCreate(plain(fields), id, uid)) {
        log.push('DENIED create ' + uid);
        json(403, { error: { status: 'PERMISSION_DENIED' } });
        return true;
      }
      const d = { fields, updateTime: 't' + ++tick };
      docs.set(id, d);
      log.push('create ' + id + ' by ' + uid);
      json(200, { name: id, ...d });
      return true;
    }
    const id = path.split('/')[2];
    const d = docs.get(id);
    if (m === 'GET') {
      if (!d) json(404, { error: { status: 'NOT_FOUND' } });
      else json(200, { name: id, ...d });
      return true;
    }
    if (m === 'PATCH') {
      if (!d) {
        json(404, { error: { status: 'NOT_FOUND' } });
        return true;
      }
      const want = u.searchParams.get('currentDocument.updateTime');
      if (want && want !== d.updateTime) {
        log.push('CONFLICT ' + uid);
        json(400, { error: { status: 'FAILED_PRECONDITION', message: 'the stored version does not match' } });
        return true;
      }
      const fields = JSON.parse(req.postData()).fields;
      if (strictRules) {
        const why = canUpdate(plain(d.fields), plain(fields), uid);
        if (why) {
          log.push('DENIED update ' + uid + ': ' + why);
          json(403, { error: { status: 'PERMISSION_DENIED' } });
          return true;
        }
      }
      d.fields = fields;
      d.updateTime = 't' + ++tick;
      log.push('update by ' + uid + ' moves=' + plain(fields).moves.length + ' seats=' + plain(fields).seats.length);
      json(200, { name: id, ...d });
      return true;
    }
    json(405, {});
    return true;
  }
  return {
    handle,
    docs,
    attempts,
    log,
    canCreate,
    canUpdate,
    room: (id) => {
      const d = docs.get(id);
      return d ? plain(d.fields) : null;
    },
  };
}

// ── a signed-in browser page with the outside network blocked ───────────────
async function openPage(browser, { w = 1366, h = 860, dpr = 1, theme = 'dark', port, signed = true, user = null, onRoute = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, serviceWorkers: 'block' });
  await ctx.addInitScript(
    ([t, signed]) => {
      try {
        localStorage.setItem('cmc-theme', t);
        if (signed) {
          const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '');
          const uid = (signed && signed.uid) || 'testuid123',
            nm = (signed && signed.name) || 'Sokha';
          const tok = b64({ alg: 'none' }) + '.' + b64({ email_verified: true, user_id: uid }) + '.x';
          const set = (k, v) => {
            if (!localStorage.getItem(k)) localStorage.setItem(k, v);
          };
          set('cmc-student-token', tok);
          set('cmc-student-uid', uid);
          set('cmc-student-email', 't@example.com');
          set('cmc-student-name', nm);
          set('cmc-student-token-expires', String(Date.now() + 3600e3));
          set('cmc-student-verified', '1');
        }
      } catch {}
    },
    [theme, user || signed],
  );
  await ctx.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (onRoute && onRoute(route, u)) return;
    if (u.hostname === '127.0.0.1' || u.protocol === 'data:' || u.protocol === 'blob:') return route.continue();
    return route.abort();
  });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => {
    if (m.type() === 'error') logs.push('console: ' + m.text().slice(0, 200));
  });
  page.on('pageerror', (e) => logs.push('pageerror: ' + String(e.stack || e).slice(0, 600)));
  page.logs = logs;
  return page;
}

let pass = 0,
  fail = 0;
const fails = [];
const ok = (c, msg, extra) => {
  if (c) pass++;
  else {
    fail++;
    fails.push(msg + (extra ? ' :: ' + JSON.stringify(extra).slice(0, 400) : ''));
  }
  console.log((c ? '  ok  ' : '  FAIL') + ' ' + msg + (!c && extra ? ' :: ' + JSON.stringify(extra).slice(0, 400) : ''));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const state = (p) =>
  p.evaluate(() => ({
    screen: G.screen,
    over: G.over,
    turn: G.turn,
    seat: G.online ? G.online.seat : -1,
    lock: G.lock,
    move: G.move,
    passes: G.passes,
    board: G.board.map((r) => r.map((c) => (c ? (c.bl ? c.ch.toLowerCase() : c.ch) : '.')).join('')).join('/'),
    owners: G.board.map((r) => r.map((c) => (c ? c.own : '.')).join('')).join('/'),
    scores: G.players.map((x) => x.score),
    racks: G.players.map((x) =>
      x.rack
        .map((t) => t.id)
        .sort((a, b) => a - b)
        .join(','),
    ),
    bag: G.bag.length,
    shown: [...document.querySelectorAll('#rack .rt')]
      .map((n) => +n.dataset.id)
      .sort((a, b) => a - b)
      .join(','),
    names: G.players.map((x) => x.name),
    bar: document.getElementById('wc-online')?.innerText.replace(/\n/g, ' | '),
    swapOff: document.getElementById('a-swap')?.disabled,
  }));
const same = (a, c, keys) => {
  const d = keys.filter((k) => JSON.stringify(a[k]) !== JSON.stringify(c[k]));
  if (d.length)
    console.log(
      '     differs in:',
      d.join(','),
      d.map((k) => JSON.stringify(a[k]).slice(0, 60) + ' vs ' + JSON.stringify(c[k]).slice(0, 60)).join(' ; '),
    );
  return !d.length;
};
const KEYS = ['board', 'owners', 'scores', 'racks', 'bag', 'turn', 'over', 'passes'];
async function playBest(p) {
  return p.evaluate(() => {
    const me = G.players[G.online.seat];
    if (G.turn !== G.online.seat || G.lock || G.over) return { skipped: true, turn: G.turn, lock: G.lock };
    let ms = [];
    try {
      ms = genMoves(me.rack);
    } catch (e) {}
    if (!ms.length) {
      doPass();
      return { passed: true };
    }
    const mv = ms[0];
    for (const [k, v] of mv.pm) {
      me.rack = me.rack.filter((t) => t.id !== v.tile.id);
      G.pend.set(k, v);
    }
    play();
    return { word: mv.res.main, total: mv.res.total };
  });
}
async function waitFor(p, fn, ms = 9000, arg) {
  try {
    await p.waitForFunction(fn, arg, { timeout: ms });
    return true;
  } catch {
    return false;
  }
}

async function scenario(name, seats, body) {
  console.log('\n== ' + name);
  const fake = makeFake();
  const pages = [];
  const mk = async (i, size) => {
    const p = await openPage(b, {
      w: size?.[0] || 1280,
      h: size?.[1] || 820,
      user: { uid: 'uid-' + 'ABCD'[i], name: ['Dara', 'Sokha', 'Mony', 'Vanna'][i] },
      onRoute: fake.handle,
    });
    p.__i = i;
    pages.push(p);
    return p;
  };
  try {
    await body({ fake, mk, pages });
  } catch (e) {
    ok(false, name + ' threw', String(e).slice(0, 300));
  }
  for (const p of pages) {
    const errs = p.logs.filter((l) => !/ERR_FAILED|net::|status of 404/.test(l) && !(name.startsWith('three') && /status of 400/.test(l)));
    ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
    await p.close().catch(() => {});
  }
  return fake;
}

const which = (process.env.WC_ONLY || 'rules,offline,two,reload,passes,three,full').split(',');

async function openRoom(A, n = 2) {
  await A.goto(UO(A), { waitUntil: 'load' });
  await A.waitForTimeout(900);
  await A.click('#modeOnline');
  await A.waitForURL(/\?online=$/);
  await A.waitForTimeout(900);
  const lob = await A.evaluate(() => ({
    lobby: !document.getElementById('lobby').classList.contains('hide'),
    host: !document.getElementById('lobHost').classList.contains('hide'),
    hub: !document.getElementById('hub').classList.contains('hide'),
    bar: getComputedStyle(document.getElementById('wc-online')).display,
  }));
  ok(lob.lobby && lob.host && !lob.hub && lob.bar === 'none', 'Play Online opens the lobby with the host controls', lob);
  if (n !== 2) await A.click(`#lobSeats button[data-n="${n}"]`);
  await A.click('#lobOpen');
  ok(await waitFor(A, () => /^[A-Z0-9]{5}$/.test(document.getElementById('lobCodeBig').textContent)), 'the host gets a room code on screen');
  return A.evaluate(() => document.getElementById('lobCodeBig').textContent);
}
async function joinRoom(B, code, viaField = true) {
  if (viaField) {
    await B.goto(UO(B) + '?online=', { waitUntil: 'load' });
    await B.waitForTimeout(700);
    await B.fill('#lobCode', code.toLowerCase());
    await B.click('#lobJoin');
    await B.waitForURL(new RegExp('online=' + code));
  } else await B.goto(UO(B) + '?online=' + code, { waitUntil: 'load' });
}

// ── the rule model on its own: what must be refused ─────────────────────────
if (which.includes('rules')) {
  console.log('\n== the room rules refuse what they should');
  const { canCreate, canUpdate } = makeFake();
  const seat = (uid, host = false) => ({ uid, name: uid, host });
  const mv = (n, uid) => ({ n, uid, kind: 'pass', keys: [], letters: [], blanks: [], h: '', at: { $ts: 1000 + n } });
  const base = {
    code: 'ABCDE',
    hostUid: 'h',
    hostName: 'Host',
    seed: 'seedseedseed',
    seatsWanted: 2,
    status: 'waiting',
    seats: [seat('h', true)],
    moves: [],
    cells: [],
    scores: [],
    turn: 0,
    bagSize: 0,
    result: null,
    closed: false,
  };
  const playing = { ...base, status: 'playing', seats: [seat('h', true), seat('g')], moves: [mv(0, 'h')], turn: 1 };
  ok(canCreate(base, 'ABCDE', 'h'), 'a host can open a room');
  ok(!canCreate({ ...base, status: 'playing' }, 'ABCDE', 'h'), 'a room cannot be created already running');
  ok(!canCreate(base, 'ABCDE', 'x'), 'nobody can open a room in another name');
  const joined = { ...base, seats: [seat('h', true), seat('g')], status: 'playing' };
  ok(canUpdate(base, joined, 'g') === '', 'a classmate can take the free seat, and the table starts');
  ok(canUpdate(base, { ...joined, seats: [seat('h', true), seat('z')] }, 'g') !== '', 'a seat can only be taken in your own name');
  ok(canUpdate(base, { ...joined, seats: [seat('g', true), seat('g')] }, 'g') !== '', 'a joiner cannot rewrite the host seat');
  ok(canUpdate(base, { ...joined, status: 'waiting' }, 'g') !== '', 'the last seat must start the table');
  ok(canUpdate(joined, { ...joined, seats: [...joined.seats, seat('z')] }, 'z') !== '', 'a full or running table takes no more players');
  ok(canUpdate(base, { ...joined, seed: 'another-seed' }, 'g') !== '', 'the seed cannot be changed');
  const next = { ...playing, moves: [...playing.moves, mv(1, 'g')], turn: 0 };
  ok(canUpdate(playing, next, 'g') === '', 'the seat on turn can add one move and hand the turn on');
  ok(canUpdate(playing, next, 'h') !== '', 'the host cannot move for a guest');
  ok(canUpdate(playing, { ...playing, moves: [...playing.moves, mv(1, 'h')], turn: 0 }, 'h') !== '', 'nobody moves out of turn');
  ok(canUpdate(playing, { ...next, turn: 1 }, 'g') !== '', 'a mover cannot keep the turn');
  ok(canUpdate(playing, { ...next, moves: [mv(0, 'h'), mv(1, 'g'), mv(2, 'g')] }, 'g') !== '', 'two moves cannot be added at once');
  ok(canUpdate(playing, { ...next, moves: [{ ...mv(0, 'h'), kind: 'play' }, mv(1, 'g')] }, 'g') !== '', 'an earlier move cannot be rewritten');
  ok(canUpdate(playing, { ...playing, scores: [999, 0] }, 'g') !== '', 'scores cannot be written without a move');
  ok(canUpdate(playing, next, 'stranger') !== '', 'somebody without a seat cannot write');
  const done = { ...next, status: 'finished', result: { text: 'Host wins', saved: true } };
  ok(canUpdate(playing, done, 'g') === '', 'the closing move may finish the match');
  ok(canUpdate(playing, { ...next, status: 'finished' }, 'g') !== '', 'a finished match must carry its result');
  ok(canUpdate(done, { ...done, moves: [...done.moves, mv(2, 'h')], turn: 1 }, 'h') !== '', 'a finished room takes no more moves');
}

// ── the start screen and the offline tables ─────────────────────────────────
if (which.includes('offline')) {
  for (const [label, w, h, gz] of [
    ['laptop', 1366, 860, false],
    ['phone', 393, 852, true],
  ]) {
    console.log(`\n== offline, ${label}${gz ? ' (word list sent gzip-encoded)' : ''}`);
    const p = await openPage(b, { w, h });
    p.__i = gz ? 5 : 4;
    await p.goto(UO(p), { waitUntil: 'load' });
    ok(
      await waitFor(p, () => document.getElementById('hubLexCount').textContent.replace(/\D/g, '') > 100000, 15000),
      'the start screen counts the tournament word list once it has loaded',
      await p.evaluate(() => document.getElementById('hubLexCount').textContent),
    );
    const hub = await p.evaluate(() => ({
      over: document.documentElement.scrollWidth - innerWidth,
      cards: ['modeSolo', 'modePass', 'modeOnline'].map((id) => {
        const n = document.getElementById(id);
        return !!n && n.getBoundingClientRect().width > 100 && !!n.querySelector('svg');
      }),
    }));
    ok(hub.cards.every(Boolean), 'three mode cards, each with its icon', hub.cards);
    ok(hub.over <= 0, 'the start screen has no sideways scroll', hub.over);
    await shot(p, `wc-${label}-hub`);
    await p.click('#modePass');
    ok(await waitFor(p, () => !document.getElementById('setup').classList.contains('hide')), 'Pass & Play opens the setup card');
    await p.click('#logo');
    ok(await waitFor(p, () => !document.getElementById('hub').classList.contains('hide')), 'the logo returns to the start screen');
    await p.click('#modeSolo');
    await waitFor(p, () => !document.getElementById('setup').classList.contains('hide'));
    ok(await p.evaluate(() => G.cfg[1].ai === true && G.cfg[0].ai === false), 'Solo seats one player against the AI');
    await p.evaluate(() => start(G.cfg));
    ok(await waitFor(p, () => G.screen === 'game' && document.querySelectorAll('#rack .rt').length === 7), 'the table deals seven tiles');
    await p.waitForTimeout(600);
    const game = await p.evaluate(() => {
      const stage = document.getElementById('stage').getBoundingClientRect();
      const board = document.getElementById('board').getBoundingClientRect();
      return {
        over: document.documentElement.scrollWidth - innerWidth,
        chip: document.getElementById('lexChip').textContent,
        inside: board.left >= stage.left - 1 && board.right <= stage.right + 1 && board.top >= stage.top - 1 && board.bottom <= stage.bottom + 1,
        gaps: [board.top - stage.top, stage.bottom - board.bottom, board.left - stage.left, stage.right - board.right].map(Math.round),
        emptyIcons: [...document.querySelectorAll('button')].filter((n) => n.offsetParent && !n.textContent.trim() && !n.querySelector('svg')).length,
        undefinedText: /undefined/.test(document.body.innerText),
      };
    });
    ok(game.over <= 0, 'the table has no sideways scroll', game.over);
    ok(game.inside, 'the whole board is inside the stage', game.gaps);
    ok(/1\d\d,\d{3}/.test(game.chip), 'the lexicon chip shows the list in play', game.chip);
    ok(game.emptyIcons === 0 && !game.undefinedText, 'no empty icon buttons', [game.emptyIcons, game.undefinedText]);
    // one real move, then the AI answers
    const played = await p.evaluate(() => {
      const me = G.players[0];
      const ms = genMoves(me.rack);
      if (!ms.length) return null;
      const m = ms[0];
      for (const [k, v] of m.pm) {
        me.rack = me.rack.filter((t) => t.id !== v.tile.id);
        G.pend.set(k, v);
      }
      play();
      return { word: m.res.main, total: m.res.total };
    });
    ok(!!played, 'the player can lay a word', played);
    ok(await waitFor(p, () => G.move >= 2 && G.turn === 0 && !G.lock, 20000), 'the AI answers and the turn comes back');
    const after = await p.evaluate(() => ({ scores: G.players.map((x) => x.score), rack: G.players[0].rack.length }));
    ok(played && after.scores[0] === played.total && after.rack === 7, 'the move is scored and the rack is refilled', after);
    await shot(p, `wc-${label}-game`);
    const errs = p.logs.filter((l) => !/ERR_FAILED|net::/.test(l));
    ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
    await p.close().catch(() => {});
  }
}

// ── online play, between separate browsers ──────────────────────────────────
if (which.includes('two'))
  await scenario('two players: lobby, moves, scores, racks', 2, async ({ fake, mk }) => {
    const A = await mk(0),
      B = await mk(1);
    const code = await openRoom(A);
    await shot(A, 'mp-lobby-host');
    ok(new URL(A.url()).searchParams.get('online') === code, 'the host address carries the code (a reload comes back to the table)');
    await joinRoom(B, code);
    ok(
      (await waitFor(A, () => G.screen === 'game')) && (await waitFor(B, () => G.screen === 'game')),
      'both tables start by themselves when the second player is in',
    );
    let a = await state(A),
      c = await state(B);
    ok(a.seat === 0 && c.seat === 1, 'host is seat 0, guest is seat 1', [a.seat, c.seat]);
    ok(same(a, c, KEYS), 'opening state is identical on both devices', { a: a.racks, c: c.racks });
    ok(a.shown === a.racks[0] && c.shown === c.racks[1], 'each device shows its OWN rack', { a: a.shown, c: c.shown });
    ok(a.swapOff && c.swapOff, 'swap is switched off online');
    ok(!a.lock && c.lock, 'only the player on turn can act');
    for (let n = 0; n < 6; n++) {
      const P = n % 2 === 0 ? A : B,
        Q = n % 2 === 0 ? B : A;
      ok(await waitFor(P, () => G.turn === G.online.seat && !G.lock), `move ${n + 1}: the turn reaches seat ${n % 2}`);
      const r = await playBest(P);
      ok(await waitFor(Q, (m) => G.move === m, 9000, n + 1), `move ${n + 1} (${r.word || 'pass'} ${r.total || ''}) arrives on the other device`);
      await sleep(300);
      a = await state(A);
      c = await state(B);
      ok(same(a, c, KEYS), `after move ${n + 1}: board, owners, scores, racks, bag and turn agree`, {
        a: [a.scores, a.bag, a.turn],
        c: [c.scores, c.bag, c.turn],
      });
      ok(a.shown === a.racks[0] && c.shown === c.racks[1], `after move ${n + 1}: nobody is shown the other rack`);
    }
    ok(a.scores[0] > 0 && a.scores[1] > 0, 'both players have points on both devices', a.scores);
    const room = fake.room(code);
    ok(
      room.moves.length === 6 && JSON.stringify(room.scores) === JSON.stringify(a.scores) && room.bagSize === a.bag,
      'the room records the same scores and bag',
      [room.scores, room.bagSize],
    );
    ok(
      !fake.log.some((l) => /DENIED/.test(l)),
      'no write was refused by the rules',
      fake.log.filter((l) => /DENIED/.test(l)),
    );
    await shot(A, 'mp-game-host');
    await shot(B, 'mp-game-guest');
    // a wrong code
    const C = await mk(2);
    await joinRoom(C, 'ZZZZZ', false);
    await C.waitForTimeout(1500);
    const cs = await C.evaluate(() => ({
      status: document.getElementById('lobStatus').textContent,
      box: !document.getElementById('lobJoinBox').classList.contains('hide'),
      lobby: !document.getElementById('lobby').classList.contains('hide'),
    }));
    ok(cs.lobby && /No table with code ZZZZZ/.test(cs.status) && cs.box, 'a wrong code says so and offers the code field again', cs);
    await C.goto(UO(C) + '?online=' + code, { waitUntil: 'load' });
    await C.waitForTimeout(1500);
    const cs2 = await C.evaluate(() => document.getElementById('lobStatus').textContent);
    ok(/already started|full/.test(cs2), 'a third player cannot walk into a running two-seat match', cs2);
  });

if (which.includes('reload'))
  await scenario('reload mid-match rebuilds the true table', 2, async ({ fake, mk }) => {
    const A = await mk(0),
      B = await mk(1);
    const code = await openRoom(A);
    await joinRoom(B, code, false);
    await waitFor(B, () => G.screen === 'game');
    await waitFor(A, () => G.screen === 'game');
    for (let n = 0; n < 5; n++) {
      const P = n % 2 === 0 ? A : B,
        Q = n % 2 === 0 ? B : A;
      await waitFor(P, () => G.turn === G.online.seat && !G.lock);
      await playBest(P);
      await waitFor(Q, (m) => G.move === m, 9000, n + 1);
    }
    await sleep(400);
    const before = await state(A);
    await B.reload({ waitUntil: 'load' });
    ok(await waitFor(B, () => G.screen === 'game'), 'the guest comes back to the table after a reload');
    await sleep(500);
    let c = await state(B);
    ok(same(before, c, KEYS), 'a reloaded guest has the same board, scores, racks and bag as the host', {
      a: [before.scores, before.bag, before.racks[1]],
      c: [c.scores, c.bag, c.racks[1]],
    });
    ok(c.shown === c.racks[1], 'and is shown its current rack, not the opening hand');
    await A.reload({ waitUntil: 'load' });
    ok(await waitFor(A, () => G.screen === 'game'), 'the host comes back too');
    await sleep(500);
    const a2 = await state(A);
    ok(same(before, a2, KEYS) && a2.seat === 0, 'a reloaded host is identical as well', [a2.scores, a2.seat]);
    // play on after both reloads
    const n0 = before.move;
    const P = n0 % 2 === 0 ? A : B,
      Q = n0 % 2 === 0 ? B : A;
    ok(await waitFor(P, () => G.turn === G.online.seat && !G.lock), 'the right player is on turn after the reloads');
    await playBest(P);
    ok(await waitFor(Q, (m) => G.move === m, 9000, n0 + 1), 'play continues after the reloads');
    await sleep(300);
    const a3 = await state(A),
      c3 = await state(B);
    ok(same(a3, c3, KEYS), 'and the two devices still agree');
    ok(fake.attempts.length === 0, 'nothing is posted to the leaderboard mid-match');
  });

if (which.includes('passes'))
  await scenario('everyone passes twice: the match ends for both', 2, async ({ fake, mk }) => {
    const A = await mk(0),
      B = await mk(1);
    const code = await openRoom(A);
    await joinRoom(B, code, false);
    await waitFor(B, () => G.screen === 'game');
    await waitFor(A, () => G.screen === 'game');
    await waitFor(A, () => !G.lock);
    await playBest(A);
    await waitFor(B, () => G.move === 1);
    for (let n = 1; n <= 4; n++) {
      const P = n % 2 === 0 ? A : B;
      await waitFor(P, () => G.turn === G.online.seat && !G.lock && !G.over);
      await P.evaluate(() => doPass());
      await sleep(200);
    }
    ok((await waitFor(A, () => G.over)) && (await waitFor(B, () => G.over)), 'four passes in a row end the match on both devices');
    await sleep(1200);
    const a = await state(A),
      c = await state(B);
    ok(same(a, c, ['board', 'scores', 'racks', 'bag']), 'final scores (with the rack penalty) agree', [a.scores, c.scores]);
    const room = fake.room(code);
    ok(
      room.status === 'finished' && room.result && /wins|heat/.test(room.result.text) && JSON.stringify(room.scores) === JSON.stringify(a.scores),
      'the room is closed with the result and final scores',
      [room.status, room.result, room.scores],
    );
    const over = await A.evaluate(() => !document.getElementById('over').classList.contains('hide'));
    ok(over, 'the result panel is up');
    await shot(A, 'mp-over');
    ok(
      fake.attempts.length === 2 && fake.attempts.every((x) => x.drillSlug === 'word-creator'),
      'each player posts their own result once',
      fake.attempts.map((x) => [x.uid, x.studentName, x.correctCount, x.totalCount]),
    );
    const byUid = Object.fromEntries(fake.attempts.map((x) => [x.uid, x]));
    ok(
      byUid['uid-A']?.correctCount === Math.max(0, a.scores[0]) && byUid['uid-B']?.correctCount === Math.max(0, a.scores[1]),
      'with their own points',
      [byUid['uid-A']?.correctCount, byUid['uid-B']?.correctCount, a.scores],
    );
    // reopen the finished room: same result, no second post
    await B.reload({ waitUntil: 'load' });
    await waitFor(B, () => G.over && G.screen === 'game');
    await sleep(1500);
    const c2 = await state(B);
    ok(same(a, c2, ['board', 'scores']), 'reopening a finished room shows the same final table', c2.scores);
    ok(fake.attempts.length === 2, 'and does not post the match again', fake.attempts.length);
    const D = await mk(2);
    await joinRoom(D, code, false);
    await D.waitForTimeout(1500);
    ok(/already ended/.test(await D.evaluate(() => document.getElementById('lobStatus').textContent)), 'a finished room cannot be joined');
  });

if (which.includes('three'))
  await scenario('three players, two joining in the same moment', 3, async ({ fake, mk }) => {
    const A = await mk(0),
      B = await mk(1),
      C = await mk(2);
    const code = await openRoom(A, 3);
    await Promise.all([joinRoom(B, code, false), joinRoom(C, code, false)]);
    ok(
      (await waitFor(A, () => G.screen === 'game', 12000)) &&
        (await waitFor(B, () => G.screen === 'game', 12000)) &&
        (await waitFor(C, () => G.screen === 'game', 12000)),
      'all three tables start',
    );
    const room = fake.room(code);
    ok(
      room.seats.length === 3 && new Set(room.seats.map((s) => s.uid)).size === 3,
      'both joiners kept their seat',
      room.seats.map((s) => s.name),
    );
    const P = [A, B, C];
    const seats = await Promise.all(P.map((p) => p.evaluate(() => G.online.seat)));
    ok(new Set(seats).size === 3, 'every device has a different seat', seats);
    const bySeat = [];
    P.forEach((p, i) => {
      bySeat[seats[i]] = p;
    });
    for (let n = 0; n < 6; n++) {
      const X = bySeat[n % 3];
      await waitFor(X, () => G.turn === G.online.seat && !G.lock);
      await playBest(X);
      for (const Y of P) await waitFor(Y, (m) => G.move === m, 9000, n + 1);
    }
    await sleep(400);
    const st = await Promise.all(P.map(state));
    ok(
      same(st[0], st[1], KEYS) && same(st[0], st[2], KEYS),
      'after six moves all three devices agree',
      st.map((x) => x.scores),
    );
    ok(
      st.every((x, i) => x.shown === x.racks[seats[i]]),
      'and each shows only its own rack',
    );
  });

if (which.includes('full'))
  await scenario('a whole match, played to the end', 2, async ({ fake, mk }) => {
    const A = await mk(0),
      B = await mk(1);
    const code = await openRoom(A);
    await joinRoom(B, code, false);
    await waitFor(B, () => G.screen === 'game');
    await waitFor(A, () => G.screen === 'game');
    let n = 0,
      agree = true;
    for (; n < 90; n++) {
      const P = n % 2 === 0 ? A : B,
        Q = n % 2 === 0 ? B : A;
      if (await P.evaluate(() => G.over)) break;
      if (!(await waitFor(P, () => (G.turn === G.online.seat && !G.lock) || G.over, 12000))) {
        ok(false, 'turn never arrived at move ' + n, await state(P));
        break;
      }
      if (await P.evaluate(() => G.over)) break;
      await playBest(P);
      if (!(await waitFor(Q, (m) => G.move >= m || G.over, 12000, n + 1))) {
        ok(
          false,
          'move ' + (n + 1) + ' never arrived',
          [await state(P), await state(Q)].map((x) => [x.move, x.turn, x.bar]),
        );
        break;
      }
      if (n % 6 === 5) {
        await sleep(250);
        const a = await state(A),
          c = await state(B);
        if (!same(a, c, ['board', 'scores', 'racks', 'bag'])) {
          agree = false;
          ok(false, 'drift at move ' + (n + 1), [a.scores, c.scores, a.bag, c.bag]);
          break;
        }
      }
    }
    ok((await waitFor(A, () => G.over, 8000)) && (await waitFor(B, () => G.over, 8000)), `the match ends on both devices (after ${n} moves)`);
    await sleep(2200);
    const a = await state(A),
      c = await state(B);
    ok(agree && same(a, c, ['board', 'scores', 'racks', 'bag']), 'final table identical', [a.scores, c.scores, a.bag]);
    const room = fake.room(code);
    ok(room.status === 'finished' && JSON.stringify(room.scores) === JSON.stringify(a.scores), 'room closed with the final scores', [
      room.status,
      room.scores,
      room.result,
    ]);
    ok(
      fake.attempts.length === 2,
      'two leaderboard posts, one each',
      fake.attempts.map((x) => [x.studentName, x.correctCount, x.totalCount]),
    );
    const wins = fake.attempts.filter((x) => x.totalCount === 1).length,
      top = Math.max(...a.scores),
      tie = a.scores[0] === a.scores[1];
    ok(wins === (tie ? 0 : 1), 'exactly one of them is recorded as the winner', [wins, a.scores]);
    ok(!fake.log.some((l) => /DENIED/.test(l)), 'no write was refused by the rules', fake.log.filter((l) => /DENIED/.test(l)).slice(0, 3));
    console.log('   moves:', room.moves.length, 'scores:', a.scores, 'conflicts:', fake.log.filter((l) => /CONFLICT/.test(l)).length);
    await shot(A, 'mp-full-over');
  });

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) console.log(fails.join('\n'));
await b.close();
srvs.forEach((x) => x.close());
process.exit(fail ? 1 : 0);
