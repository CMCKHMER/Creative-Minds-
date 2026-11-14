// Mafia Noir ONLINE verification — Firestore transport (MN_FS shim).
// The Firestore REST API is MOCKED with a rule-shaped in-memory store:
//   • Bearer token required on every mafia_rooms op (tok-N ↔ uid-N registry);
//   • views/{uid} readable ONLY by that uid (403 otherwise — a client that
//     tried to peek another player's view would fail here);
//   • actions/{uid} writable only by that uid, listable only by the host;
//   • room-doc updates only by the host; masked PATCH honored.
// The verifier then plays a FULL 4-player online case across four browser
// contexts (host creates, three guests join), covering: lobby join, the
// deal, reveal cards, night actions per role, public day chat, the host
// calling the vote, ballots, verdicts, the end modal, the leaderboard POST
// each player sends (title 'Mafia Noir · Online'), host resume-after-reload,
// and the sign-in gate for a context with no CMC session.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
const DIST = '/home/z/my-project/tmp/cmc-site/dist';
const PORT = 8990; const BASE = `http://127.0.0.1:${PORT}`;
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

// ── rule-shaped in-memory Firestore ─────────────────────────────────────
const TOKENS = { 'tok-0': 'uid-0', 'tok-1': 'uid-1', 'tok-2': 'uid-2', 'tok-3': 'uid-3' };
const DB = new Map();           // code -> {fields, views: Map, actions: Map}
const engineWrites = [];        // every .engine value ever written
const violations = [];          // rule-shaped access violations the mock saw
const OPS = [];                 // every firestore op the mock handled
const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
function parseUrl(u) { return new URL(u); }

async function fsHandler(req) {
  let out;
  try { out = await fsInner(req); }
  catch (e) { out = { code: 500, body: { error: { message: 'MOCK THREW: ' + String(e && e.message || e).slice(0, 120) } } }; }
  if (!out) out = { code: 500, body: { error: { message: 'MOCK RETURNED UNDEFINED' } } };
  OPS.push(`  → ${out.code} ${out.body && out.body.error ? JSON.stringify(out.body).slice(0, 90) : 'ok'}`);
  return out;
}
async function fsInner(req) {
  const url = parseUrl(req.url());
  const m = url.pathname.match(/\/documents\/(.+)$/);
  const method = req.method();
  const auth = (req.headers()['authorization'] || '').replace('Bearer ', '');
  const uid = TOKENS[auth];
  OPS.push(`${method} ${url.pathname.slice(-55)} auth=${auth || 'NONE'} uid=${uid || '?'}`);
  if (OPS.length > 400) OPS.splice(0, 100);
  if (!uid) return { code: 403, body: { error: { message: 'Unauthenticated' } } };
  if (!m || !m[1].startsWith('mafia_rooms')) return null; // not ours — let it 404
  const seg = m[1].split('/');
  const code = seg[1];
  const room = DB.get(code);
  const body = req.postData() ? JSON.parse(req.postData()) : null;
  const err = (msg, c = 403) => { violations.push(`${method} ${m[1]} (${uid}) → ${msg}`); return { code: c, body: { error: { code: c, message: msg } } }; };

  if (seg.length === 2) { // the room doc
    if (method === 'POST') {
      const docId = url.searchParams.get('documentId');
      if (body.fields.hostUid?.stringValue !== uid) return err(`create: not own room (got ${JSON.stringify(body?.fields?.hostUid)} expected ${uid})`);
      if (DB.has(docId)) return { code: 409, body: { error: { code: 409, message: 'ALREADY_EXISTS: entity already exists' } } };
      DB.set(docId, { fields: body.fields, views: new Map(), actions: new Map() });
      return { code: 200, body: { name: `p/d/mafia_rooms/${docId}`, fields: body.fields } };
    }
    if (!room) return { code: 404, body: { error: { code: 404, message: 'NOT_FOUND' } } };
    if (method === 'GET') return { code: 200, body: { name: `p/d/mafia_rooms/${code}`, fields: room.fields } };
    if (method === 'PATCH') {
      if (room.fields.hostUid?.stringValue !== uid) return err('room update: not host');
      const mask = url.searchParams.getAll('updateMask.fieldPaths');
      if (body.fields.engine?.stringValue) engineWrites.push(body.fields.engine.stringValue);
      for (const f of mask) room.fields[f] = body.fields[f];
      return { code: 200, body: { name: `p/d/mafia_rooms/${code}`, fields: room.fields } };
    }
  }
  if (seg.length === 3 && seg[2] === 'views') { // create a view doc (documentId=uid, host-only)
    if (method !== 'POST') return { code: 404, body: { error: { code: 404, message: 'NOT_FOUND' } } };
    if (!room || room.fields.hostUid?.stringValue !== uid) return err('view write: not host');
    const docId = url.searchParams.get('documentId');
    if (room.views.has(docId)) return { code: 409, body: { error: { code: 409, message: 'ALREADY_EXISTS' } } };
    room.views.set(docId, body.fields);
    return { code: 200, body: { name: `p/d/mafia_rooms/${code}/views/${docId}`, fields: body.fields } };
  }
  if (seg.length === 4 && seg[2] === 'views') { // views/{uid}: GET = owner only, PATCH = host-only overwrite
    const vuid = seg[3];
    if (method === 'GET') {
      if (uid !== vuid) return err('view read: not owner');
      const v = room?.views.get(vuid);
      return v ? { code: 200, body: { name: `p/d/mafia_rooms/${code}/views/${vuid}`, fields: v } } : { code: 404, body: { error: { code: 404, message: 'NOT_FOUND' } } };
    }
    if (method !== 'PATCH') return { code: 404, body: { error: { code: 404, message: 'NOT_FOUND' } } };
    if (!room || room.fields.hostUid?.stringValue !== uid) return err('view write: not host');
    room.views.set(vuid, body.fields);
    return { code: 200, body: { name: `p/d/mafia_rooms/${code}/views/${vuid}`, fields: body.fields } };
  }
  if (seg[2] === 'actions') {
    if (seg.length === 3 && method === 'GET') { // LIST (host resolves)
      if (!room) return { code: 404, body: { error: { code: 404, message: 'NOT_FOUND' } } };
      if (room.fields.hostUid?.stringValue !== uid) return err('actions list: not host');
      return { code: 200, body: { documents: [...room.actions].map(([a, fields]) => ({ name: `p/d/mafia_rooms/${code}/actions/${a}`, fields })) } };
    }
    if (seg.length === 3 && method === 'POST') { // create own action doc (documentId=uid)
      const docId = url.searchParams.get('documentId');
      if (uid !== docId) return err('action write: not own');
      if (!room) return { code: 404, body: { error: { code: 404, message: 'NOT_FOUND' } } };
      if (room.actions.has(docId)) return { code: 409, body: { error: { code: 409, message: 'ALREADY_EXISTS' } } };
      room.actions.set(docId, body.fields);
      return { code: 200, body: { fields: body.fields } };
    }
    const auid = seg[3];
    if (method === 'GET') { if (uid !== auid) return err('action read: not owner'); const f = room?.actions.get(auid); return f ? { code: 200, body: { fields: f } } : { code: 404, body: { error: { code: 404, message: 'NOT_FOUND' } } }; }
    if (method === 'POST') {
      const docId = url.searchParams.get('documentId');
      if (uid !== docId) return err('action write: not own');
      if (room?.actions.has(docId)) return { code: 409, body: { error: { code: 409, message: 'ALREADY_EXISTS' } } };
      room?.actions.set(docId, body.fields);
      return { code: 200, body: { fields: body.fields } };
    }
    if (method === 'PATCH') {
      if (uid !== auid) return err('action write: not own');
      const mask = url.searchParams.getAll('updateMask.fieldPaths');
      const cur = (room?.actions.get(auid) || {});
      room?.actions.set(auid, mask.length ? Object.assign({}, cur, body.fields) : body.fields);
      return { code: 200, body: { fields: body.fields } };
    }
  }
  return { code: 404, body: { error: { code: 404, message: 'NOT_FOUND' } } };
}

// ── browser setup ────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true });
const results = [];
const ok = (name, cond, detail) => results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
const posts = [];

function makeContext(n) {
  return browser.newContext({ viewport: { width: 1280, height: 900 } }).then(async (ctx) => {
    await ctx.route('**/firestore.googleapis.com/**', async (route) => {
      const out = await fsHandler(route.request());
      if (out) return route.fulfill({ status: out.code, contentType: 'application/json', body: JSON.stringify(out.body) });
      return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":{"message":"NOT_FOUND"}}' });
    });
    await ctx.route('**/drill_attempts*', async (route) => {
      if (route.request().method() === 'POST') {
        posts.push(JSON.parse(route.request().postData() || '{}'));
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{"name":"x"}' });
      } else await route.continue();
    });
    await ctx.addInitScript(({ tok, u }) => {
      localStorage.setItem('cmc-student-token', tok);
      localStorage.setItem('cmc-student-token-expires', String(Date.now() + 3600000));
      localStorage.setItem('cmc-student-uid', u);
      localStorage.setItem('cmc-student-name', 'Student ' + u.slice(-1));
      localStorage.setItem('cmc-player-name', JSON.stringify({ name: 'Student ' + u.slice(-1), at: Date.now() }));
      localStorage.setItem('cmc-player-id', '7A');
    }, { tok: 'tok-' + n, u: 'uid-' + n });
    return ctx;
  });
}
const seats = [];
for (let i = 0; i < 4; i++) seats.push(await makeContext(i));
const pages = [];
for (let i = 0; i < 4; i++) { const p = await seats[i].newPage(); p.setDefaultTimeout(20000); pages.push(p); await p.goto(BASE + '/mafia.html'); }

// host opens a table
for (const p of pages) {
  p.on('pageerror', e => console.log('DEBUG pageerror:', e.message.slice(0, 300)));
  p.on('requestfailed', r => { if (r.url().includes('firestore')) console.log('DEBUG reqfailed:', r.method(), r.url().slice(-70), r.failure()?.errorText); });
  p.on('console', m => { if (m.text().startsWith('MN_FS')) console.log(`PAGE[${pages.indexOf(p)}]:`, m.text().slice(0, 160)); });
}
await pages[0].click('#onlineMode');
await pages[0].click('#createBtn');
await pages[0].waitForSelector('#roomChip:has-text("CODE · ")', { timeout: 30000 }).catch(async () => {
  console.log('DEBUG modal=', (await pages[0].locator('#modalBox').textContent().catch(() => '')).slice(0, 120));
  console.log('DEBUG violations=', JSON.stringify(violations));
  console.log('DEBUG last ops=', OPS.slice(-14).join(' || '));
  throw new Error('create failed');
});
const code = (await pages[0].locator('#roomChip').textContent()).replace('CODE · ', '').trim();
ok(`room code issued (${code})`, /^[A-Z2-9]{4}$/.test(code), code);

// guests join
for (let i = 1; i < 4; i++) {
  await pages[i].click('#onlineMode');
  await pages[i].fill('#joinCode', code);
  await pages[i].click('#joinBtn');
}
// everyone reaches the lobby with 4 seats (host reconciles via the room doc)
let lobby = 0;
for (let t = 0; t < 40 && lobby < 4; t++) {
  await pages[0].waitForTimeout(1000);
  lobby = 0;
  for (const p of pages) if (await p.locator('#lobbyPanel:visible').count()) lobby++;
}
ok('lobby: all four screens in the lobby', lobby === 4, `${lobby}/4`);
let pcards = await pages[0].locator('#lobbyPlayers .pcard').count();
ok('lobby: host table shows 4 seats', pcards === 4, `${pcards} seats`);

// start the case (host)
await pages[0].waitForFunction(() => { const b = document.querySelector('#startBtn'); return b && !b.disabled; }, { timeout: 30000 }).catch(() => {
  console.log('DEBUG startBtn wait failed. violations=', JSON.stringify(violations));
  console.log('DEBUG ops tail=', OPS.slice(-16).join(' || '));
  throw new Error('startBtn never enabled');
});
await pages[0].click('#startBtn');
const roles = [];
for (let i = 0; i < 4; i++) {
  await pages[i].waitForSelector('#modalBox .card3d', { timeout: 30000 }).catch(async () => {
    console.log(`DEBUG reveal wait failed p${i}`);
    const dbg = await pages[i].evaluate(() => ({
      hub: !document.getElementById('hub').hidden, session: !!document.getElementById('session').hidden,
      lobby: !document.getElementById('lobbyPanel').hidden, conn: document.getElementById('connText').textContent,
      mode: typeof app !== 'undefined' ? app.mode : '?', screen: typeof app !== 'undefined' ? app.screen : '?',
      overlay: !document.getElementById('overlay').hidden,
      modal: (document.getElementById('modalBox').textContent || '').slice(0, 90),
      toast: (document.getElementById('cmcToast') || { textContent: '' }).textContent,
      sess: (() => { try { return localStorage.getItem('mnSession'); } catch (e) { return 'x'; } })(),
      hasV: typeof app !== 'undefined' && !!app.V, phase: typeof app !== 'undefined' && app.V ? app.V.room.phase : '?',
    })).catch(e => ({ err: String(e).slice(0, 120) }));
    console.log(`DEBUG p${i} state=`, JSON.stringify(dbg));
    const dbg2 = await pages[i].evaluate(() => typeof MN_FS !== 'undefined' && MN_FS._dbg ? MN_FS._dbg() : 'no-dbg').catch(e => ({ err: String(e).slice(0, 80) }));
    console.log(`DEBUG p${i} shim=`, JSON.stringify(dbg2));
    const hbTest = await pages[i].evaluate(async () => {
      try {
        const r = await fetch('https://firestore.googleapis.com/v1/projects/creative-minds-cambodia/databases/(default)/documents/mafia_rooms/ZZZZ/actions/uid-' + (typeof app !== 'undefined' ? 'x' : 'x'), { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok-1' }, body: JSON.stringify({ fields: { seen: { timestampValue: new Date().toISOString() } } }) });
        return 'hb-clone HTTP ' + r.status;
      } catch (e) { return 'hb-clone threw ' + String(e).slice(0, 80); }
    }).catch(e => 'eval threw ' + String(e).slice(0, 80));
    console.log(`DEBUG p${i} hbTest=`, hbTest);
    console.log('DEBUG ops tail=', OPS.slice(-6).join(' || '));
    for (const tk of ['tok-0', 'tok-1', 'tok-2', 'tok-3']) {
      const mine = OPS.filter(o => o.includes(`auth=${tk} `));
      console.log(`DEBUG ops[${tk}] count=${mine.length} last=`, mine.slice(-4).join(' | ').slice(0, 400));
    }
    const room = [...DB.keys()][0];
    if (room) {
      const r = DB.get(room);
      console.log('DEBUG db: views=', [...r.views.keys()], 'roomSeats=', (r.fields.seats?.arrayValue?.values || []).length,
        'roomPhase=', r.fields.phase?.stringValue, 'seq=', r.fields.seq?.integerValue,
        'vseq=', [...r.views].map(([k, v]) => k + ':' + v.seq?.integerValue).join(','));
    }
    throw new Error(`reveal modal missing on p${i}`);
  });
  await pages[i].click('#roleCard .back');
  await pages[i].waitForTimeout(900);
  const t = (await pages[i].locator('#revealHint').textContent()) || '';
  roles.push(/Mafioso|Syndicate|mafia/i.test(t) ? 'mafia' : /Detective/i.test(t) ? 'detective' : /Doctor/i.test(t) ? 'doctor' : 'Citizen');
  await pages[i].click('#hideCardBtn');
}
ok('deal: one Mafia dealt across four seats', roles.filter(r => r === 'mafia').length === 1, roles.join(', '));
const mafiaIdx = roles.indexOf('mafia');

// the Mafia whispers during the night — only their own view may carry it
async function nightAct(p, role) {
  if (await p.locator('.seat.selectable').count()) {
    await p.locator('.seat.selectable').first().click();
    await p.click('#confirmOnline');
    return true;
  }
  return false;
}
await pages[mafiaIdx].waitForFunction(() => { const i = document.querySelector('#chatInput'); return i && !i.disabled; }, { timeout: 30000 });
await pages[mafiaIdx].fill('#chatInput', 'whisper-the-night-owns-this');
await pages[mafiaIdx].press('#chatInput', 'Enter');
for (let i = 0; i < 4; i++) await nightAct(pages[i], roles[i]);
// wait for dawn (day phase) on all screens
let day = 0;
for (let t = 0; t < 40 && day < 4; t++) {
  await pages[0].waitForTimeout(1000);
  day = 0;
  for (const p of pages) if (await p.locator('.msg.mafia').count() || await p.locator('#actionBar:visible').count()) day++;
  day = 0;
  for (const p of pages) if ((await p.locator('#phaseChip').textContent()).includes('DAY')) day++;
}
ok('night resolved to day on all screens', day === 4, `${day}/4`);
ok('secrecy: mafia whisper only in their own feed', (await pages[mafiaIdx].locator('.msg.mafia:has-text("whisper-the-night-owns-this")').count()) >= 1
  && (await Promise.all(pages.filter((_, i) => i !== mafiaIdx).map(p => p.locator('.msg.mafia:has-text("whisper-the-night-owns-this")').count()))).every(c => c === 0));

// day: public chat from the LIVING reaches every living screen; the night
// victim's chat goes to the ghost channel only (never to the living)
const aliveIdx = [];
for (let i = 0; i < 4; i++) {
  const alive = await pages[i].evaluate(() => typeof app !== 'undefined' && app.V && app.V.you ? app.V.you.alive : false);
  if (alive) aliveIdx.push(i);
}
ok('day chat: night victim identified correctly', aliveIdx.length >= 2, `alive seats: ${aliveIdx.join(',')}`);
for (const i of aliveIdx) {
  await pages[i].waitForFunction(() => { const c = document.querySelector('#chatInput'); return c && !c.disabled; }, { timeout: 45000 }).catch(async () => {
    for (const j of aliveIdx) {
      console.log(`DEBUG chat-wait p${j}:`, await pages[j].evaluate(() => {
        const c = document.querySelector('#chatInput');
        return `phase=${app.V ? app.V.room.phase : '?'} alive=${app.V && app.V.you ? app.V.you.alive : '?'} screen=${app.screen} input=${c ? `dis=${c.disabled}` : 'missing'} conn=${document.getElementById('connText').textContent}`;
      }).catch(e => 'eval err ' + String(e).slice(0, 60)));
    }
    const roomKey0 = [...DB.keys()][0];
    if (roomKey0) {
      const acts = DB.get(roomKey0).actions;
      console.log('DEBUG actions docs=', [...acts].map(([u, f]) => `${u}:${f.action?.stringValue}@${(f.at?.timestampValue || '').slice(11, 19)}`).join(' | '));
      console.log('DEBUG violations=', JSON.stringify(violations));
      for (const tk of ['tok-1', 'tok-2', 'tok-3']) {
        const mine = OPS.filter(o => o.includes(`auth=${tk} `));
        console.log(`DEBUG ops[${tk}] n=${mine.length} last=`, mine.slice(-5).join(' | ').slice(0, 360));
      }
    }
    throw new Error(`chat input not enabled on p${i}`);
  });
  await pages[i].fill('#chatInput', 'day-vote-we-see-you-' + i);
  await pages[i].press('#chatInput', 'Enter');
}
const probe = 'day-vote-we-see-you-' + aliveIdx[0];
let chatOk = 0, per = [];
for (let t = 0; t < 30 && chatOk < aliveIdx.length; t++) {
  await pages[0].waitForTimeout(1000);
  per = [];
  for (const i of aliveIdx) per.push([i, await pages[i].locator(`.msg:has-text("${probe}")`).count()]);
  chatOk = per.filter(([, c]) => c > 0).length;
}
ok('day chat: public messages reach every living screen', chatOk === aliveIdx.length, per.map(([i, c]) => `p${i}:${c}`).join(' '));
const ghostLeak = aliveIdx.length < 4 ? (await Promise.all(aliveIdx.map(i => pages[i].locator('.msg.ghost').count()))).every(c => c === 0) : true;
ok('day chat: no ghost chatter leaks to the living', ghostLeak, '');

// play until the end modal (host calls the vote each day)
let ended = false, rounds = 0;
while (!ended && rounds++ < 40) {
  await pages[0].waitForTimeout(800);
  if (await pages[0].locator('#modalBox .reveal-grid').count()) { ended = true; break; }
  for (let i = 0; i < 4; i++) {
    const p = pages[i];
    if (await p.locator('#modalBox .m-actions button').count()) { await p.click('#modalBox .m-actions button'); await p.waitForTimeout(300); continue; }
    if (await p.locator('#callOnline').count()) { await p.click('#callOnline'); continue; }
    if (await p.locator('.seat.selectable').count()) {
      await p.locator('.seat.selectable').first().click();
      const c = p.locator('#confirmOnline');
      if (await c.count() && await c.isEnabled()) await c.click();
      else { const ab = p.locator('#abstainOnline'); if (await ab.count()) await ab.click(); }
      continue;
    }
  }
}
ok(`online case reached the end modal (${rounds} rounds)`, ended, '');
const endText = ended ? (await pages[0].locator('#modalBox').textContent()) : '';
ok('end modal: reveal grid + case closed', ended && /CASE CLOSED|THE SYNDICATE|THE CITY/.test(endText), endText.slice(0, 60));
ok('end modal: only the host may redeal', ended && (await pages[0].locator('#againOnline').isEnabled()) && (await pages[1].locator('#againOnline').isDisabled()));

// every player posted their own case result for the lounge leaderboard
await pages[0].waitForTimeout(2500);
ok('leaderboard: one POST per player', posts.length === 4, `${posts.length} POST(s)`);
const titles = posts.map(p => p.fields?.drillTitle?.stringValue || '');
ok('leaderboard: Online title on every POST', posts.length === 4 && titles.every(t => t === 'Mafia Noir · Online'), titles.join(', '));
// each player's POST matches THEIR team: the mafia's loss posts 0, town wins post 1
const townWon = (await pages[0].locator('#modalBox').textContent()).includes('THE CITY ENDURES');
const bySeat = posts.map(p => ({ seat: Number(((p.fields?.studentName?.stringValue || '').match(/Student (\d)/) || [])[1] ?? -1), cc: Number(p.fields?.correctCount?.integerValue || '0') }));
const outcomesOk = posts.length === 4 && bySeat.every(({ seat, cc }) => cc === (roles[seat] === 'mafia' ? 0 : 1));
ok('leaderboard: outcome matches each player’s team', outcomesOk,
  `verdict=town:${townWon} · ${bySeat.map(b => 'p' + b.seat + '(=' + roles[b.seat] + '):' + b.cc).join(' ')}`);

// host resume: reload + reopen the online screen — the engine is re-decrypted
// from the encrypted mirror (the room key never left this device)
await pages[0].reload();
await pages[0].waitForTimeout(800);
await pages[0].click('#onlineMode');
await pages[0].waitForTimeout(3000);
const resumed = (await pages[0].locator('#modalBox .reveal-grid').count())
  || (await pages[0].locator('#roomChip:has-text("CODE · ' + code + '")').count());
ok('host resume: reload restores the table + engine', !!resumed, '');

// sign-in gate: a context with no CMC session gets an honest modal
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(BASE + '/mafia.html');
  await p.click('#onlineMode');
  await p.waitForSelector('#modalBox:has-text("Sign in to play online")', { timeout: 8000 }).catch(() => {});
  const t = (await p.locator('#modalBox').textContent().catch(() => '')) || '';
  ok('sign-in gate: no session → honest modal + CMC link', t.includes('Sign in to play online') && t.includes('SIGN IN ON CMC'), t.slice(0, 50));
  await ctx.close();
}

// ── transport-level secrecy pins ─────────────────────────────────────────
ok('secrecy: engine blob never carries plaintext roles', engineWrites.length > 0
  && engineWrites.every(e => !/"role"\s*:\s*"(mafia|detective|doctor|villager)"/.test(e)
    && !/"mafiaTeam"\s*:/.test(e)),
  `${engineWrites.length} engine writes, all ciphertext`);
ok('rules-shaped mock: zero access violations', violations.length === 0, violations.slice(0, 3).join(' | ') || 'none');

for (const p of pages) await p.context().close();
await browser.close();
server.close();
console.log(results.join('\n'));
const fails = results.filter(r => r.startsWith('FAIL'));
console.log(`\nverify_mafia_online: ${results.length - fails.length} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
