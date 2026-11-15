// Mafia Noir ONLINE verification — Firestore transport (MN_FS shim).
//
// The Firestore REST API is EMULATED in memory, and the emulation is shaped
// after FIRESTORE, not after the client. (The first version of this mock
// accepted whatever the shim sent — a create POSTed to a document path, an
// "ALREADY_EXISTS" word inside the error message — so it passed 20/20 while
// no table could be opened on the real database.) What it enforces:
//   • createDocument is POST to a COLLECTION path with ?documentId=…; a POST
//     to a document path is 400 INVALID_ARGUMENT;
//   • a taken id is HTTP 409, status ALREADY_EXISTS, message
//     "Document already exists: <name>" (the status word is NOT in the message);
//   • PATCH without a mask replaces the document, with a mask touches only
//     the masked fields, with currentDocument.exists=true needs the document;
//   • list with orderBy drops documents that lack the ordering field;
//   • the mafia_rooms block of firestore.rules, including email_verified:
//     room read = any verified user; create = code == id, hostUid == caller,
//     hostName/engine strings, status 'open'; update/delete = host;
//     views/{uid}: read = that uid, write = host;
//     actions/{uid}: read = that uid or host, write = that uid, delete = host.
// Every refusal is recorded in `violations`; the run must end with none.
//
// The verifier then plays a FULL 4-player online case (host creates, three
// guests join), covering: lobby join, presence, the deal, reveal cards, night
// actions per role, public day chat, the host calling the vote, ballots,
// verdicts, the end modal, the leaderboard POST each player sends, host
// resume-after-reload, the sign-in gate and the unverified-email gate.
//
//   node scripts/verify_mafia_online.mjs
//   MAFIA_DIST=public   serve another folder (default ../dist)
//   PW_CHROMIUM=/path   use this Chromium binary (with playwright-core)
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = await import('playwright').catch(() => import('playwright-core'));
const DIST = resolve(process.env.MAFIA_DIST || join(dirname(fileURLToPath(import.meta.url)), '..', 'dist'));
// One ORIGIN per seat: some headless Chromium builds share localStorage
// across browser contexts, and every player needs their own CMC session.
const PORT = 8990; const ORIGIN = (n) => `http://127.0.0.1:${PORT + n}`; const BASE = ORIGIN(0);
const servers = [];
for (let n = 0; n < 6; n++) {
  const server = createServer(async (req, res) => {
    try {
      const file = normalize(decodeURIComponent(new URL(req.url, BASE).pathname));
      const data = await readFile(join(DIST, file === '/' ? 'index.html' : file));
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp3': 'audio/mpeg', '.webm': 'video/webm', '.svg': 'image/svg+xml', '.json': 'application/json' };
      res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
      res.end(data);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(r => server.listen(PORT + n, '127.0.0.1', r));
  servers.push(server);
}

// ── strict in-memory Firestore (REST) ───────────────────────────────────
const TOKENS = {
  'tok-0': { uid: 'uid-0', verified: true }, 'tok-1': { uid: 'uid-1', verified: true },
  'tok-2': { uid: 'uid-2', verified: true }, 'tok-3': { uid: 'uid-3', verified: true },
  'tok-unverified': { uid: 'uid-unverified', verified: false },
};
const DB = new Map();           // code -> {fields, views: Map, actions: Map}
const engineWrites = [];        // every .engine value ever written
const violations = [];          // every refusal the emulator handed out
const OPS = [];                 // every firestore op the emulator handled
const DOCS = 'projects/creative-minds-cambodia/databases/(default)/documents/';
const E = (code, status, message) => ({ code, body: { error: { code, message, status } } });
const NOT_FOUND = (name) => E(404, 'NOT_FOUND', `Document "${DOCS}${name}" not found.`);
const str = (v) => !!v && typeof v.stringValue === 'string';

async function fsHandler(req) {
  let out;
  try { out = await fsInner(req); }
  catch (e) { out = E(500, 'INTERNAL', 'EMULATOR THREW: ' + String(e && e.message || e).slice(0, 120)); }
  OPS.push(`  → ${out.code} ${out.body && out.body.error ? JSON.stringify(out.body).slice(0, 110) : 'ok'}`);
  return out;
}
async function fsInner(req) {
  const url = new URL(req.url());
  const m = url.pathname.match(/\/documents\/(.+)$/);
  const method = req.method();
  const auth = (req.headers()['authorization'] || '').replace('Bearer ', '');
  const who = TOKENS[auth];
  const uid = who ? who.uid : null;
  OPS.push(`${method} ${url.pathname.slice(-55)}${url.search.slice(0, 40)} auth=${auth || 'NONE'} uid=${uid || '?'}`);
  if (OPS.length > 400) OPS.splice(0, 100);
  const path = m ? m[1] : '';
  const refuse = (out) => { violations.push(`${method} ${path}${url.search.slice(0, 40)} (${uid || 'anon'}) → ${out.code} ${out.body.error.status}`); return out; };
  if (auth && !who) return refuse(E(401, 'UNAUTHENTICATED', 'Request had invalid authentication credentials.'));
  const DENIED = () => refuse(E(403, 'PERMISSION_DENIED', 'Missing or insufficient permissions.'));
  const seg = path.split('/');
  if (seg[0] !== 'mafia_rooms') return DENIED(); // nothing else is in this emulator's rules
  const verified = !!who && who.verified;        // isVerifiedUser()
  const body = req.postData() ? JSON.parse(req.postData()) : null;
  const fields = (body && body.fields) || {};
  const isDocPath = seg.length % 2 === 0;
  const mask = url.searchParams.getAll('updateMask.fieldPaths');
  const mustExist = url.searchParams.get('currentDocument.exists') === 'true';

  // createDocument: POST …/{collection}?documentId=ID — never a document path
  if (method === 'POST' && isDocPath) return refuse(E(400, 'INVALID_ARGUMENT', `Document parent name "${DOCS}${seg.slice(0, -1).join('/')}" lacks "/" at index ${DOCS.length + seg.slice(0, -1).join('/').length}.`));
  if ((method === 'PATCH' || method === 'DELETE') && !isDocPath) return refuse(E(400, 'INVALID_ARGUMENT', 'Invalid document name.'));

  const code = seg[1];
  const room = code ? DB.get(code) : null;
  const hostUid = room ? room.fields.hostUid?.stringValue : null;
  const applyPatch = (cur) => {
    if (!mask.length) return fields;                       // no mask: replace the document
    const next = Object.assign({}, cur || {});
    for (const f of mask) { if (f in fields) next[f] = fields[f]; else delete next[f]; }
    return next;
  };

  // ── /mafia_rooms and /mafia_rooms/{code} ──
  if (seg.length === 1) {
    if (method !== 'POST') return DENIED();                // no list rule a client could satisfy here
    const id = url.searchParams.get('documentId');
    if (!id) return refuse(E(400, 'INVALID_ARGUMENT', 'documentId is required in this emulator.'));
    const allowed = verified && fields.code?.stringValue === id && fields.hostUid?.stringValue === uid
      && str(fields.hostName) && fields.status?.stringValue === 'open' && str(fields.engine);
    if (!allowed) return DENIED();
    if (DB.has(id)) return E(409, 'ALREADY_EXISTS', `Document already exists: ${DOCS}mafia_rooms/${id}`);
    DB.set(id, { fields, views: new Map(), actions: new Map() });
    if (fields.engine?.stringValue) engineWrites.push(fields.engine.stringValue);
    return { code: 200, body: { name: `${DOCS}mafia_rooms/${id}`, fields } };
  }
  if (seg.length === 2) {
    if (method === 'GET') {
      if (!verified) return DENIED();
      return room ? { code: 200, body: { name: `${DOCS}${path}`, fields: room.fields } } : NOT_FOUND(path);
    }
    if (method === 'PATCH') {
      if (!room) {                                          // a PATCH on a missing doc is a CREATE for the rules
        if (mustExist) return verified ? NOT_FOUND(path) : DENIED();
        return DENIED();
      }
      if (!(verified && uid === hostUid)) return DENIED();
      if (fields.engine?.stringValue) engineWrites.push(fields.engine.stringValue);
      room.fields = applyPatch(room.fields);
      return { code: 200, body: { name: `${DOCS}${path}`, fields: room.fields } };
    }
    if (method === 'DELETE') { if (!(room && verified && uid === hostUid)) return DENIED(); DB.delete(code); return { code: 200, body: {} }; }
    return DENIED();
  }

  // ── subcollections: views/{uid}, actions/{uid} ──
  const sub = seg[2];
  if (sub !== 'views' && sub !== 'actions') return DENIED();
  const isHost = verified && !!room && uid === hostUid;    // rules: get(room).data.hostUid — no room, no host
  const store = room ? room[sub] : null;
  if (seg.length === 3) {
    if (method === 'GET') {                                 // LIST: must be provably allowed for every doc
      if (sub !== 'actions' || !isHost) return DENIED();
      let docs = [...store].map(([id, f]) => ({ name: `${DOCS}${path}/${id}`, fields: f }));
      const order = (url.searchParams.get('orderBy') || '').replace(/`/g, '').split(' ')[0];
      if (order) docs = docs.filter(d => order in d.fields).sort((a, b) => String(a.fields[order].timestampValue || '').localeCompare(String(b.fields[order].timestampValue || '')));
      return { code: 200, body: docs.length ? { documents: docs } : {} };
    }
    if (method === 'POST') {
      const id = url.searchParams.get('documentId');
      const allowed = sub === 'views' ? isHost : (verified && uid === id);
      if (!allowed || !room) return DENIED();
      if (store.has(id)) return E(409, 'ALREADY_EXISTS', `Document already exists: ${DOCS}${path}/${id}`);
      store.set(id, fields);
      return { code: 200, body: { name: `${DOCS}${path}/${id}`, fields } };
    }
    return DENIED();
  }
  const docId = seg[3];
  if (method === 'GET') {
    const allowed = sub === 'views' ? (verified && uid === docId) : (verified && (uid === docId || isHost));
    if (!allowed) return DENIED();
    const f = store && store.get(docId);
    return f ? { code: 200, body: { name: `${DOCS}${path}`, fields: f } } : NOT_FOUND(path);
  }
  if (method === 'PATCH') {
    const allowed = sub === 'views' ? isHost : (verified && uid === docId);
    if (!allowed) return DENIED();
    if (!room) return NOT_FOUND(path);                      // (real Firestore would create an orphan; the client never does this)
    if (mustExist && !store.has(docId)) return NOT_FOUND(path);
    store.set(docId, applyPatch(store.get(docId)));
    return { code: 200, body: { name: `${DOCS}${path}`, fields: store.get(docId) } };
  }
  if (method === 'DELETE') { if (!isHost) return DENIED(); store.delete(docId); return { code: 200, body: {} }; }
  return DENIED();
}

// ── browser setup ────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true, ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM, args: ['--no-sandbox', '--disable-gpu', '--single-process', '--no-zygote'] } : {}) });
const results = [];
const ok = (name, cond, detail) => results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
const posts = [];

function makeContext(n) {
  return browser.newContext({ viewport: { width: 1280, height: 900 } }).then(async (ctx) => {
    await ctx.route('**/firestore.googleapis.com/**', async (route) => {
      const out = await fsHandler(route.request());
      return route.fulfill({ status: out.code, contentType: 'application/json', body: JSON.stringify(out.body) });
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
for (let i = 0; i < 4; i++) { const p = await seats[i].newPage(); p.setDefaultTimeout(20000); pages.push(p); await p.goto(ORIGIN(i) + '/mafia.html'); }

// host opens a table
for (const p of pages) {
  p.on('pageerror', e => console.log('DEBUG pageerror:', e.message.slice(0, 300)));
  p.on('requestfailed', r => { if (r.url().includes('firestore')) console.log('DEBUG reqfailed:', r.method(), r.url().slice(-70), r.failure()?.errorText); });
  p.on('console', m => { if (m.text().startsWith('MN_FS')) console.log(`PAGE[${pages.indexOf(p)}]:`, m.text().slice(0, 160)); });
}
// instrument the chat routing on every screen: which texts reach handleO?
for (const p of pages) {
  await p.evaluate(() => {
    try {
      window._chatCalls = [];
      const orig = window.handleO;
      if (typeof orig === 'function') window.handleO = function (m) {
        try { if (m && m.type === 'chat') window._chatCalls.push((m.message?.channel || '') + ':' + String(m.message?.text || '').slice(0, 26)); } catch (e) {}
        return orig(m);
      };
    } catch (e) {}
  });
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

// W6: the pace selects live in the lobby panel — the host picks the fastest
// pace (their first render already pushed the 30/60/30 defaults to the shim;
// the selectOptions below pin the same values explicitly). The v66 build
// never read these selects — rooms always ran the 90/150/45 defaults.
await pages[0].waitForSelector('#cfgNight', { state: 'visible', timeout: 20000 });
await pages[0].selectOption('#cfgNight', '30');
await pages[0].selectOption('#cfgDay', '60');
await pages[0].selectOption('#cfgVote', '30');

// W6 pin: the host's pace picks ride to the host engine and back into every
// player's view (night 30 / day 60 / vote 30)
let cfg = null;
for (let t = 0; t < 15 && !cfg; t++) {
  await pages[0].waitForTimeout(1000);
  cfg = await pages[1].evaluate(() => app.V && app.V.room && app.V.room.config
    ? { night: Number(app.V.room.config.night), day: Number(app.V.room.config.day), vote: Number(app.V.room.config.vote) } : null).catch(() => null);
}
ok('lobby: host pace config reaches every seat (30/60/30)', !!cfg && cfg.night === 30 && cfg.day === 60 && cfg.vote === 30, cfg ? JSON.stringify(cfg) : 'no config in view');

// presence: nobody has done anything for longer than the 16s "away" window,
// only heartbeats went out. The next table update must still show all four
// as connected (the host used to skip heartbeats when no new action came in,
// so idle players — and the host itself — turned grey).
await pages[0].waitForTimeout(18000);
await pages[0].evaluate(() => sendO({ type: 'chat', text: 'presence ping' }));
let dots = null;
for (let t = 0; t < 12; t++) {
  await pages[0].waitForTimeout(1000);
  dots = await pages[2].evaluate(() => ({ live: document.querySelectorAll('#lobbyPlayers .conn.dot.live').length, off: document.querySelectorAll('#lobbyPlayers .conn.dot.off').length,
    got: /presence ping/.test(document.body.textContent || '') })).catch(() => null);
  if (dots && dots.got) break;
}
ok('lobby: idle players stay connected after 18s of heartbeats only', !!dots && dots.got && dots.live === 4 && dots.off === 0, JSON.stringify(dots));
// nobody typed a name: every seat carries its CMC account name, not "Stranger"
const names = await pages[0].evaluate(() => [...document.querySelectorAll('#lobbyPlayers .pcard b')].map(b => b.textContent.trim()));
ok('lobby: seats carry the account names', names.length === 4 && names.every(n => /^Student \d$/.test(n)), names.join(', '));

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

// the Mafia whispers during the night — only their own view may carry it.
// HARDENED (the v66 flake): the driver used to click seat+confirm blindly —
// if the view hadn't synced yet the confirm click no-oped, no action doc was
// posted and the host waited out the full phase timer while the chat-wait
// died at 45s. Now: poll for a selectable seat (≤10s), wait for the confirm
// button to be ENABLED before clicking (≤4s), fall back to the abstain
// button, and settle before moving on.
async function actOn(p) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      for (let t = 0; t < 20 && !(await p.locator('.seat.selectable').count()); t++) await p.waitForTimeout(500);
      if (!(await p.locator('.seat.selectable').count())) return false;
      await p.locator('.seat.selectable').first().click({ timeout: 5000 });
      const c = p.locator('#confirmOnline');
      let clicked = false;
      for (let t = 0; t < 10; t++) {
        if (await c.count() && await c.isEnabled()) { await c.click({ timeout: 5000 }); clicked = true; break; }
        await p.waitForTimeout(400);
      }
      if (!clicked) { const ab = p.locator('#abstainOnline'); if (await ab.count()) { await ab.click({ timeout: 5000 }).catch(() => {}); return true; } return false; }
      await p.waitForTimeout(600);
      return true;
    } catch (e) { await p.waitForTimeout(600); } // a re-render detached the element — retry
  }
  return false;
}
await pages[mafiaIdx].waitForFunction(() => { const i = document.querySelector('#chatInput'); return i && !i.disabled; }, { timeout: 30000 });
await pages[mafiaIdx].fill('#chatInput', 'whisper-the-night-owns-this');
await pages[mafiaIdx].press('#chatInput', 'Enter');
for (let i = 0; i < 4; i++) await actOn(pages[i]);
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
if (day !== 4 || !(await pages[mafiaIdx].locator('.msg.mafia:has-text("whisper-the-night-owns-this")').count())) {
  console.log('DEBUG whisper-miss dump: mafiaIdx=', mafiaIdx);
  const roomKey = [...DB.keys()][0];
  if (roomKey) {
    const views = DB.get(roomKey).views;
    for (const [u, f] of views) {
      const feed = f.feed?.arrayValue?.values || [];
      console.log(`DEBUG view ${u} seq=${f.seq?.integerValue} len=${feed.length} mafia-tail=`, JSON.stringify(feed.slice(-4).map(v => (v.mapValue.fields.channel?.stringValue || '') + ':' + (v.mapValue.fields.text?.stringValue || '').slice(0, 30))));
    }
  }
}
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
if (chatOk < aliveIdx.length) {
  console.log('DEBUG chat-miss dump:');
  const roomKey = [...DB.keys()][0];
  if (roomKey) {
    const acts = DB.get(roomKey).actions;
    console.log('DEBUG action docs=', [...acts].map(([u, f]) => `${u}:${f.action?.stringValue}@${(f.at?.timestampValue || '').slice(11, 19)} text=${(f.text?.stringValue || '').slice(0, 24)}`).join(' | '));
    const views = DB.get(roomKey).views;
    for (const [u, f] of views) {
      const feed = f.feed?.arrayValue?.values || [];
      console.log(`DEBUG view ${u} seq=${f.seq?.integerValue} len=${feed.length} tail=`, JSON.stringify(feed.slice(-3).map(v => (v.mapValue.fields.fromId?.stringValue || '') + ':' + (v.mapValue.fields.text?.stringValue || '').slice(0, 24))));
    }
  }
  for (const j of aliveIdx) console.log(`DEBUG p${j} chatCalls=`, await pages[j].evaluate(() => (window._chatCalls || []).slice(-6)).catch(e => 'err'), 'domMsgs=', await pages[j].evaluate(() => document.querySelectorAll('#feed .msg').length).catch(() => '?'));
}
ok('day chat: public messages reach every living screen', chatOk === aliveIdx.length, per.map(([i, c]) => `p${i}:${c}`).join(' '));

// EVERY living player's line must reach EVERY living screen. (The probe above
// only follows the first speaker; a guest used to receive the first public
// line of a case and nothing after it, and a guest's own line only left the
// host when the host next did something.)
let grid = [];
for (let t = 0; t < 20; t++) {
  await pages[0].waitForTimeout(1000);
  grid = [];
  for (const viewer of aliveIdx) for (const speaker of aliveIdx) grid.push([viewer, speaker, await pages[viewer].locator(`.msg:has-text("day-vote-we-see-you-${speaker}")`).count()]);
  if (grid.every(([, , c]) => c === 1)) break;
}
ok('day chat: every living player’s line reaches every living screen, once', grid.length > 0 && grid.every(([, , c]) => c === 1),
  grid.filter(([, , c]) => c !== 1).map(([v, sp, c]) => `p${v} sees p${sp}×${c}`).join(' ') || `${aliveIdx.length}×${aliveIdx.length} delivered`);

// a GUEST says the same thing twice while the host stays silent: both lines
// arrive everywhere, with the speaker's name on them
const guest = aliveIdx.find((i) => i !== 0);
const listener = aliveIdx.find((i) => i !== 0 && i !== guest) ?? aliveIdx.find((i) => i !== guest);
if (guest !== undefined && listener !== undefined) {
  for (let k = 0; k < 2; k++) {
    await pages[guest].fill('#chatInput', 'same-words-again');
    await pages[guest].press('#chatInput', 'Enter');
    await pages[guest].waitForTimeout(2600);   // one actions doc per player: leave the host a poll between the two
  }
  let twice = [0, 0];
  for (let t = 0; t < 15; t++) {
    twice = [await pages[listener].locator('.msg:has-text("same-words-again")').count(), await pages[0].locator('.msg:has-text("same-words-again")').count()];
    if (twice[0] === 2 && twice[1] === 2) break;
    await pages[0].waitForTimeout(1000);
  }
  ok('day chat: a guest’s repeated line arrives twice without the host acting', twice[0] === 2 && twice[1] === 2, `guest p${listener} sees ${twice[0]}, host sees ${twice[1]}`);
  const named = await pages[0].evaluate(() => {
    const m = [...document.querySelectorAll('#feed .msg')].filter((e) => /same-words-again/.test(e.textContent || '')).pop();
    return m ? (m.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60) : '';
  });
  ok('day chat: the host’s screen names the speaker', new RegExp('Student ' + guest).test(named) && !/undefined/.test(named), named);
}
const ghostLeak = aliveIdx.length < 4 ? (await Promise.all(aliveIdx.map(i => pages[i].locator('.msg.ghost').count()))).every(c => c === 0) : true;
ok('day chat: no ghost chatter leaks to the living', ghostLeak, '');

// play until the end modal (host calls the vote each day; 80 rounds ≈ the
// full case with headroom at the 30/60/30 pace)
let ended = false, rounds = 0;
while (!ended && rounds++ < 80) {
  await pages[0].waitForTimeout(800);
  if (await pages[0].locator('#modalBox .reveal-grid').count()) { ended = true; break; }
  for (let i = 0; i < 4; i++) {
    const p = pages[i];
    if (await p.locator('#modalBox .m-actions button').count()) { await p.click('#modalBox .m-actions button', { timeout: 5000 }).catch(() => {}); await p.waitForTimeout(300); continue; }
    if (await p.locator('#callOnline').count()) { await p.click('#callOnline', { timeout: 5000 }).catch(() => {}); continue; }
    if (await p.locator('.seat.selectable').count()) await actOn(p);
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
// each player's POST matches THEIR team (whatever the verdict): team won →
// 1/1, team lost → 0/1 — the mafia wins when the town doesn't
const townWon = (await pages[0].locator('#modalBox').textContent()).includes('THE CITY ENDURES');
const bySeat = posts.map(p => ({ seat: Number(((p.fields?.studentName?.stringValue || '').match(/Student (\d)/) || [])[1] ?? -1), cc: Number(p.fields?.correctCount?.integerValue || '0') }));
const outcomesOk = posts.length === 4 && bySeat.every(({ seat, cc }) => cc === (((roles[seat] === 'mafia') !== townWon) ? 1 : 0));
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
  await p.goto(ORIGIN(4) + '/mafia.html');
  await p.click('#onlineMode');
  await p.waitForSelector('#modalBox:has-text("Sign in to play online")', { timeout: 8000 }).catch(() => {});
  const t = (await p.locator('#modalBox').textContent().catch(() => '')) || '';
  ok('sign-in gate: no session → honest modal + CMC link', t.includes('Sign in to play online') && t.includes('SIGN IN ON CMC'), t.slice(0, 50));
}

// a signed-in account whose email is NOT verified: the rules deny it, and the
// game must say so plainly instead of "the table is closed to you"
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route('**/firestore.googleapis.com/**', async (route) => {
    const out = await fsHandler(route.request());
    return route.fulfill({ status: out.code, contentType: 'application/json', body: JSON.stringify(out.body) });
  });
  await ctx.addInitScript(() => {
    localStorage.setItem('cmc-student-token', 'tok-unverified');
    localStorage.setItem('cmc-student-token-expires', String(Date.now() + 3600000));
    localStorage.setItem('cmc-student-uid', 'uid-unverified');
    localStorage.setItem('cmc-student-name', 'Unverified');
    localStorage.setItem('cmc-student-verified', '0');
  });
  const p = await ctx.newPage();
  await p.goto(ORIGIN(5) + '/mafia.html');
  await p.click('#onlineMode');
  await p.click('#createBtn');
  await p.waitForSelector('#modalBox:has-text("Verify your email first")', { timeout: 8000 }).catch(() => {});
  const t = (await p.locator('#modalBox').textContent().catch(() => '')) || '';
  ok('unverified account: create is refused with a "verify your email" message', t.includes('Verify your email first') && !t.includes('closed to you'), t.slice(0, 60));
  const mine = violations.filter(v => v.includes('uid-unverified'));
  ok('unverified account: the database refused it (403)', mine.length > 0 && mine.every(v => v.includes('403 PERMISSION_DENIED')), mine[0] || 'no refusal seen');
  // drop the expected refusals from the violation log
  for (let i = violations.length - 1; i >= 0; i--) if (violations[i].includes('uid-unverified')) violations.splice(i, 1);
}

// ── transport-level secrecy pins ─────────────────────────────────────────
ok('secrecy: engine blob never carries plaintext roles', engineWrites.length > 0
  && engineWrites.every(e => !/"role"\s*:\s*"(mafia|detective|doctor|villager)"/.test(e)
    && !/"mafiaTeam"\s*:/.test(e)),
  `${engineWrites.length} engine writes, all ciphertext`);
ok('Firestore emulation: zero refused requests', violations.length === 0, violations.slice(0, 3).join(' | ') || 'none');

// (single-process Chromium dies on the first context close; browser.close()
// takes every context down anyway)
await browser.close().catch(() => {});
for (const sv of servers) sv.close();
console.log(results.join('\n'));
const fails = results.filter(r => r.startsWith('FAIL'));
console.log(`\nverify_mafia_online: ${results.length - fails.length} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
