// MN_FS — Firestore-backed online play for Mafia Noir.
// Replaces the WebSocket transport the upload assumed: GitHub Pages is
// static, so the room "server" is the HOST DEVICE — the same pattern as
// chess3d's REST rooms (firestore.rules → chess_rooms), extended with
// hidden-information handling:
//   • authoritative engine state lives in the HOST's memory and is mirrored
//     AES-GCM-encrypted into mafia_rooms/{code}.engine (the room key is
//     kept ONLY in the host's localStorage), so a Firestore read of the
//     room doc never exposes roles;
//   • each player gets mafia_rooms/{code}/views/{uid} — their PERSONAL
//     view (own role, mafia team, detective files) — rules scope reads to
//     the owner; town players' views carry no other player's role;
//   • mafia whispers and ghost chat are channel-filtered per viewer;
//   • players write only mafia_rooms/{code}/actions/{uid} (their night
//     action / ballot / chat / heartbeat); the host validates every action
//     against phase + eligibility before applying it.
// Client protocol is byte-identical to the upload's engine: MN_FS feeds
// handleO() the same {joined|log|state|chat|error|left} messages, so the
// table, lobby, chat, banners and end modal all render unchanged.
'use strict';
const MN_FS = (function () {
  const FS_BASE = 'https://firestore.googleapis.com/v1/projects/creative-minds-cambodia/databases/(default)/documents';
  const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I — same discipline as the join input
  const MIN = 4, MAX = 12;
  const DEFAULT_CFG = { night: 90, day: 150, vote: 45 };
  const REVEAL_MS = 9000;

  // ── tiny helpers ──
  const ls = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const lsDel = (k) => { try { localStorage.removeItem(k); } catch (e) {} };
  const SV = (v) => ({ stringValue: String(v) });
  const IV = (v) => ({ integerValue: String(Math.round(Number(v) || 0)) });
  const BV = (v) => ({ booleanValue: !!v });
  const NV = (v) => ({ nullValue: null });
  const B64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const UB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const json = (v) => JSON.stringify(v);

  // ── identity: the site's cmc-student-* session (REST sign-in pipeline) ──
  function identity() {
    const uid = ls('cmc-student-uid') || '';
    if (!uid) return null;
    return { uid, name: seatName() };
  }
  function seatName() {
    let n = '';
    try { const pn = JSON.parse(ls('cmc-player-name') || 'null'); n = (pn && pn.name) || ''; } catch (e) {}
    n = n || (ls('cmc-student-name') || '');
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(n)) { // an email is never a name
      n = n.split('@')[0].split(/[._+\-]+/).filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
    const alias = (($('#nameInput') || {}).value || '').trim();
    return (alias || n || 'Stranger').slice(0, 16);
  }
  async function idToken() {
    let tok = ls('cmc-student-token');
    let exp = Number(ls('cmc-student-token-expires') || '0');
    if (tok && exp && exp > Date.now() + 30000) return tok;
    const rt = ls('cmc-student-refresh-token');
    if (!rt) return null;
    try {
      const r = await fetch('https://securetoken.googleapis.com/v1/token?key=AIzaSyDNUq0ru99XKh08D887Xk63h36MPOlXWwc', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(rt),
      });
      if (!r.ok) return null;
      const d = await r.json();
      if (d.id_token) {
        lsSet('cmc-student-token', d.id_token);
        lsSet('cmc-student-token-expires', String(Date.now() + (Number(d.expires_in) || 3600) * 1000 - 60000));
        if (d.user_id && !ls('cmc-student-uid')) lsSet('cmc-student-uid', d.user_id);
        return d.id_token;
      }
    } catch (e) {}
    return null;
  }
  function authed() { return !!(ls('cmc-student-uid') && (ls('cmc-student-token') || ls('cmc-student-refresh-token'))); }

  // ── REST plumbing ──
  async function api(method, path, body) {
    const tok = await idToken();
    if (!tok) throw new Error('signed-out');
    const res = await fetch(FS_BASE + path, {
      method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 404) return null;
    if (res.status === 401 || res.status === 403) throw new Error('denied');
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || ('HTTP ' + res.status));
    }
    return res.status === 200 ? res.json() : {};
  }
  const roomPath = (code) => `/mafia_rooms/${encodeURIComponent(code)}`;
  async function getRoom(code) { const d = await api('GET', roomPath(code)); return d ? parseRoom(d.fields) : null; }
  async function createRoomDoc(code, fields) { await api('POST', `${roomPath(code)}?documentId=${encodeURIComponent(code)}`, { fields }); }
  async function patchRoom(code, fields, mask) {
    const qp = `?currentDocument.exists=true&${mask.map((f) => 'updateMask.fieldPaths=' + encodeURIComponent(f)).join('&')}`;
    await api('PATCH', roomPath(code) + qp, { fields });
  }
  async function upsert(path, id, fields) {
    try { await api('POST', `${path}?documentId=${encodeURIComponent(id)}`, { fields }); }
    catch (e) {
      if (!/ALREADY_EXISTS/.test(String(e.message))) throw e;
      await api('PATCH', `${path}/${encodeURIComponent(id)}`, { fields }); // full overwrite, no mask
    }
  }
  async function getView(code, uid) { const d = await api('GET', `${roomPath(code)}/views/${encodeURIComponent(uid)}`); return d ? d.fields : null; }
  // heartbeat: masked patch of ONLY the seen field — the action fields (and
  // their `at` timestamp) must survive until a real action replaces them,
  // otherwise a heartbeat race would swallow a join/action before the host
  // polls it
  async function heartbeat(code, uid) {
    await api('PATCH', `${roomPath(code)}/actions/${encodeURIComponent(uid)}?updateMask.fieldPaths=seen`,
      { fields: { seen: { timestampValue: new Date().toISOString() } } });
  }
  async function listActions(code) {
    const d = await api('GET', `${roomPath(code)}/actions?pageSize=50&orderBy=%60at%60`);
    return (d && d.documents) ? d.documents : [];
  }
  function seatsFromFields(f) {
    return (f.seats?.arrayValue?.values || []).map((v) => {
      const m = v.mapValue.fields;
      return { id: m.id.stringValue, uid: m.uid.stringValue, name: m.name.stringValue, color: m.color.stringValue, seed: Number(m.seed.integerValue || '0') };
    });
  }
  function seatsToFields(seats) {
    return { arrayValue: { values: seats.map((s) => ({ mapValue: { fields: { id: SV(s.id), uid: SV(s.uid), name: SV(s.name), color: SV(s.color), seed: IV(s.seed) } } })) } };
  }
  function parseRoom(f) {
    if (!f || !f.code) return null;
    return {
      code: f.code.stringValue, hostUid: f.hostUid.stringValue, hostName: (f.hostName.stringValue || 'Host'),
      status: f.status.stringValue, phase: (f.phase && f.phase.stringValue) || 'lobby',
      seats: seatsFromFields(f), min: Number(f.min.integerValue || '4'), max: Number(f.max.integerValue || '12'),
      config: Object.fromEntries(Object.entries(f.config?.mapValue?.fields || {}).map(([k, v]) => [k, Number(v.integerValue || '0')])),
      gameId: Number(f.gameId.integerValue || '1'), seq: Number(f.seq.integerValue || '0'),
      engine: (f.engine && f.engine.stringValue) || null, updatedAt: (f.updatedAt && f.updatedAt.timestampValue) || null,
    };
  }

  // ── AES-GCM engine blob (roles must not sit readable in the room doc) ──
  async function roomKey(code, fresh) {
    const k = 'mnRoomKey_' + code;
    if (!fresh) {
      const raw = ls(k);
      if (raw) { try { return await crypto.subtle.importKey('raw', UB64(raw), 'AES-GCM', false, ['encrypt', 'decrypt']); } catch (e) {} }
    }
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const raw = await crypto.subtle.exportKey('raw', key);
    lsSet(k, B64(raw));
    return key;
  }
  async function sealEngine(key, obj) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(json(obj)));
    return B64(iv) + '.' + B64(ct);
  }
  async function openEngine(key, blob) {
    if (!blob || !key) return null;
    const [ivs, cts] = blob.split('.');
    try {
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: UB64(ivs) }, key, UB64(cts));
      return JSON.parse(new TextDecoder().decode(pt));
    } catch (e) { return null; }
  }

  // ═══════════════ HOST — the authoritative table ═══════════════
  const H = { code: null, uid: null, E: null, key: null, tickT: null, actT: null, seenActions: {}, busy: false };

  function newSeat(id, uid, name) {
    return { id: String(id), uid, name: name.slice(0, 16) || 'Stranger', color: COLORS[id % COLORS.length], seed: 1 + Math.floor(Math.random() * 9999),
      alive: true, role: null, fate: null, action: null, submitted: false, investigations: [], selfProtectUsed: false, mafiaTeam: [], lastSeen: Date.now(), left: false };
  }
  function deal(E) {
    const n = E.seats.length, m = mafiaCount(n);
    const roles = shuffle([...Array(m).fill('mafia'), 'detective', 'doctor', ...Array(n - m - 2).fill('villager')]);
    E.seats.forEach((s, i) => { s.role = roles[i]; s.alive = !s.left; s.fate = s.left ? 'left' : null; s.action = null; s.submitted = false;
      s.investigations = []; s.selfProtectUsed = false; s.mafiaTeam = s.role === 'mafia' ? [] : null; s.connected = true; });
    E.seats.filter((s) => s.role === 'mafia').forEach((mf) => { mf.mafiaTeam = E.seats.filter((s) => s.role === 'mafia').map((s) => s.id); });
    E.phase = 'reveal'; E.night = 0; E.winner = null; E.lastResult = null; E.votes = {}; E.mafiaVotes = {}; E.stats = { kills: 0, saves: 0, lynch: 0 };
    E.phaseEndsAt = Date.now() + REVEAL_MS; E.phaseDuration = REVEAL_MS / 1000;
    logSys(E, `The cards are dealt. ${n} at the table, ${m} of them wolves. Memorize your role.`);
  }
  function logSys(E, text) { E.log.push({ channel: 'system', text: text.slice(0, 220) }); if (E.log.length > 220) E.log = E.log.slice(-220); }
  function logChat(E, channel, seat, text) {
    E.log.push({ channel, text: '', from: { id: seat.id, name: seat.name, color: seat.color }, msg: String(text).slice(0, 200) });
    if (E.log.length > 220) E.log = E.log.slice(-220);
  }
  function aliveSeats(E) { return E.seats.filter((s) => s.alive && !s.left); }
  function mafiaAlive(E) { return aliveSeats(E).filter((s) => s.role === 'mafia'); }
  function townAlive(E) { return aliveSeats(E).filter((s) => s.role !== 'mafia'); }
  function winCheck(E) {
    const m = mafiaAlive(E).length, t = townAlive(E).length;
    if (m === 0) { E.phase = 'end'; E.winner = 'town'; }
    else if (m >= t) { E.phase = 'end'; E.winner = 'mafia'; }
    if (E.phase === 'end') { E.phaseEndsAt = null; logSys(E, E.winner === 'town' ? 'CASE CLOSED — the city endures.' : 'CASE CLOSED — the Syndicate owns the night.'); }
    return E.phase === 'end';
  }
  function requiredSeats(E) {
    if (E.phase === 'night') return aliveSeats(E).filter((s) => ['mafia', 'doctor', 'detective'].includes(s.role));
    if (E.phase === 'vote') return aliveSeats(E);
    return [];
  }
  function majority(pairs) { // pairs: [{targetId, at, seatId}] — strict top, tie → earliest submitted
    const counts = {};
    pairs.forEach((p) => { if (p.targetId != null) counts[p.targetId] = (counts[p.targetId] || 0) + 1; });
    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (!ranked.length) return null;
    if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) return null; // ties eliminate nobody
    return ranked[0][0];
  }
  function resolveNight(E) {
    const kills = E.seats.filter((s) => s.role === 'mafia' && s.alive && s.action).map((s) => s.action);
    const killId = majority(kills);
    const doc = aliveSeats(E).find((s) => s.role === 'doctor' && s.action);
    const protId = doc ? doc.action.targetId : null;
    const det = aliveSeats(E).find((s) => s.role === 'detective' && s.action);
    if (det && det.action.targetId != null) {
      const t = E.seats.find((s) => s.id === det.action.targetId);
      det.investigations.push({ targetId: det.action.targetId, isMafia: !!(t && t.role === 'mafia') });
    }
    const saved = killId != null && killId === protId;
    let killedId = null;
    if (killId != null && !saved) {
      const v = E.seats.find((s) => s.id === killId);
      if (v && v.alive) { v.alive = false; v.fate = 'silenced'; killedId = killId; E.stats.kills++; }
    } else if (saved) E.stats.saves++;
    E.seats.forEach((s) => { s.action = null; s.submitted = false; });
    E.lastResult = { type: 'night', saved, killedId };
    E.phase = 'day';
    E.phaseDuration = E.config.day; E.phaseEndsAt = Date.now() + E.config.day * 1000;
    logSys(E, killedId ? 'The city wakes to an empty chair.' : saved ? 'Dawn breaks — everyone is still here.' : 'Dawn breaks quietly.');
    winCheck(E);
  }
  function resolveVote(E) {
    const ballots = aliveSeats(E).filter((s) => s.action).map((s) => s.action);
    const elimId = majority(ballots);
    let eliminatedId = null;
    if (elimId != null) {
      const v = E.seats.find((s) => s.id === elimId);
      if (v && v.alive) { v.alive = false; v.fate = 'voted'; eliminatedId = elimId; E.stats.lynch++; }
    }
    E.seats.forEach((s) => { s.action = null; s.submitted = false; });
    E.mafiaVotes = {};
    E.lastResult = { type: 'vote', eliminatedId };
    E.phase = 'day';
    E.phaseDuration = E.config.day; E.phaseEndsAt = Date.now() + E.config.day * 1000;
    logSys(E, eliminatedId ? 'The verdict is in. One name leaves the table.' : 'Hung jury — nobody is eliminated.');
    winCheck(E);
  }

  function canSeeRole(viewer, seat, E) {
    if (!seat.alive || seat.fate) return true;             // the dead are revealed
    return E.phase === 'end';                              // or the case is closed
  }
  function feedFor(E, seat) {
    const isMafia = seat.role === 'mafia', dead = !seat.alive || seat.left;
    return E.log.filter((m) => m.channel === 'system' || m.channel === 'public'
      || (m.channel === 'mafia' && isMafia) || (m.channel === 'ghost' && dead) || (m.channel === 'private'))
      .slice(-60);
  }
  function buildView(E, seat) {
    const st = {
      room: { phase: E.phase, night: E.night, code: E.code, config: E.config, min: MIN, max: MAX,
        hostId: E.hostSeatId, gameId: E.gameId, phaseEndsAt: E.phaseEndsAt || null, phaseDuration: E.phaseDuration || 1 },
      players: E.seats.map((p) => ({
        id: p.id, name: p.name, color: p.color, seed: p.seed, alive: p.alive && !p.left, fate: p.fate,
        isHost: p.id === E.hostSeatId, connected: (Date.now() - (p.lastSeen || 0)) < 16000,
        ...(canSeeRole(seat, p, E) && p.role ? { role: p.role } : {}),
      })),
      you: { id: seat.id, role: seat.role, alive: seat.alive && !seat.left, submitted: !!seat.submitted,
        yourAction: seat.action && seat.action.targetId !== undefined ? seat.action.targetId : null,
        investigations: seat.role === 'detective' ? seat.investigations : [],
        selfProtectUsed: seat.role === 'doctor' ? seat.selfProtectUsed : false,
        ...(seat.role === 'mafia' ? { mafiaTeam: seat.mafiaTeam } : {}) },
      progress: { required: requiredSeats(E).map((s) => s.id), submitted: requiredSeats(E).filter((s) => s.submitted).map((s) => s.id) },
    };
    if (seat.role === 'mafia' && E.phase === 'night') st.mafiaVotes = Object.fromEntries(E.seats.filter((s) => s.role === 'mafia' && s.action).map((s) => [s.id, s.action.targetId]));
    if (E.phase === 'end') { st.winner = E.winner; st.lastResult = E.lastResult; st.stats = E.stats; }
    if (E.lastResult && ['day', 'vote'].includes(E.phase)) st.lastResult = E.lastResult;
    return { st, feed: feedFor(E, seat) };
  }
  function applyState(st) {
    handleO({ type: 'state', state: st });
    // an ONLINE case also posts to the class leaderboard — each player
    // reports their own outcome (the furniture builds the block + sends)
    if (st.room.phase === 'end' && st.winner && C.endSent !== st.room.gameId) {
      C.endSent = st.room.gameId;
      document.dispatchEvent(new CustomEvent('cmcmafia:game', { detail: {
        winner: st.winner, mode: 'Online', youRole: st.you.role, survived: !!st.you.alive,
        nights: st.room.night, kills: (st.stats || {}).kills || 0, saves: (st.stats || {}).saves || 0,
        lynch: (st.stats || {}).lynch || 0, gameId: 'on-' + st.room.gameId } }));
    }
  }
  function applyLocal(E) {
    if (app.mode !== 'online') return;
    const seat = E.seats.find((s) => s.uid === H.uid);
    if (!seat) return;
    const { st, feed } = buildView(E, seat);
    pushFeed(feed);
    applyState(st);
  }
  async function broadcast(E) {
    E.seq = (E.seq || 0) + 1;
    const blob = await sealEngine(H.key, E);
    const mask = ['engine', 'seq', 'phase', 'gameId', 'updatedAt', 'config', 'status', 'seats'];
    try {
      await patchRoom(E.code, {
        engine: SV(blob), seq: IV(E.seq), phase: SV(E.phase), gameId: IV(E.gameId),
        updatedAt: { timestampValue: new Date().toISOString() },
        config: { mapValue: { fields: Object.fromEntries(Object.entries(E.config).map(([k, v]) => [k, IV(v)])) } },
        status: SV(E.statusClosed ? 'closed' : E.phase === 'lobby' ? 'open' : 'live'),
        seats: seatsToFields(E.seats),
      }, mask);
    } catch (e) { toast('Could not sync the table — check your connection.'); }
    await Promise.all(E.seats.map((s) => {
      const { st, feed } = buildView(E, s);
      return upsert(roomPath(E.code) + '/views', s.uid, { seq: IV(E.seq), state: SV(json(st)), feed: { arrayValue: { values: feed.map((m) => ({ mapValue: { fields: { channel: SV(m.channel), text: SV(m.channel === 'system' ? m.text : m.msg), fromId: SV(m.from ? m.from.id : ''), fromName: SV(m.from ? m.from.name : ''), fromColor: SV(m.from ? m.from.color : '') } } })) } } }).catch(() => {});
    }));
    applyLocal(E);
  }

  // host loop: phase timers + reconcile the room doc (new lobby seats) + actions
  function startHostLoops() {
    stopHostLoops();
    H.tickT = setInterval(() => {
      const E = H.E; if (!E) return;
      E.seats.forEach((s) => { s.connected = (Date.now() - (s.lastSeen || 0)) < 16000; });
      const now = Date.now();
      if (E.phase === 'reveal' && now >= E.phaseEndsAt) {
        E.night++; E.phase = 'night'; E.phaseDuration = E.config.night; E.phaseEndsAt = now + E.config.night * 1000;
        logSys(E, 'Night falls. The city sleeps — lightly.');
        broadcast(E); return;
      }
      if (E.phase === 'night' || E.phase === 'vote') {
        const req = requiredSeats(E);
        const all = req.length && req.every((s) => s.submitted);
        if (all || now >= E.phaseEndsAt) {
          if (E.phase === 'night') resolveNight(E); else resolveVote(E);
          broadcast(E);
        }
        return;
      }
      if (E.phase === 'day' && now >= E.phaseEndsAt) { E.phase = 'vote'; E.phaseDuration = E.config.vote; E.phaseEndsAt = now + E.config.vote * 1000; logSys(E, 'The ballot is open. One name. Or none.'); broadcast(E); }
    }, 1000);
    H.actT = setInterval(pollHost, 1100);
  }
  function stopHostLoops() { clearInterval(H.tickT); clearInterval(H.actT); H.tickT = H.actT = null; }

  async function pollHost() {
    const E = H.E; if (!E || H.busy) return;
    H.busy = true;
    try {
      // reconcile the room doc (host-only writes) + claim seats from actions
      const room = await getRoom(E.code);
      if (!room) { E.statusClosed = true; E.phase = 'end'; await broadcast(E); resetClient(); return; }
      let seatsChanged = false;
      for (const rs of room.seats) {
        if (!E.seats.some((s) => s.uid === rs.uid)) {
          const ns = newSeat(E.seats.length, rs.uid, rs.name);
          ns.seed = rs.seed; ns.lastSeen = Date.now();
          E.seats.push(ns); seatsChanged = true;
          logSys(E, `${ns.name} pulls up a chair.`);
        }
      }
      const docs = await listActions(E.code);
      for (const d of docs) {
        const uid = (d.name || '').split('/').pop();
        const f = d.fields || {};
        const at = Date.parse((f.at && f.at.timestampValue) || '') || 0;
        const kind = (f.action && f.action.stringValue) || 'hb';
        if (at <= (H.seenActions[uid] || 0)) continue;
        H.seenActions[uid] = at;
        let seat = E.seats.find((s) => s.uid === uid);
        if (kind === 'join') {          if (!seat && E.phase === 'lobby' && E.seats.length < E.max) {
            const name = ((f.text && f.text.stringValue) || 'Stranger').slice(0, 16);
            seat = newSeat(E.seats.length, uid, name);
            seat.lastSeen = at;
            E.seats.push(seat);
            seatsChanged = true;
            logSys(E, `${seat.name} pulls up a chair.`);
          }
          continue;
        }
        if (!seat) continue;
        seat.lastSeen = Date.parse((f.seen && f.seen.timestampValue) || '') || at || seat.lastSeen;
        const targetId = f.targetId && f.targetId.stringValue !== '' ? f.targetId.stringValue : null;
        if (kind === 'hb') continue;
        if (kind === 'chat') {
          const chan = E.phase === 'lobby' || E.phase === 'day' ? 'public'
            : E.phase === 'night' && seat.role === 'mafia' && seat.alive ? 'mafia'
            : E.phase === 'vote' && !seat.alive ? 'ghost' : !seat.alive ? 'ghost' : null;
          if (chan) { logChat(E, chan, seat, f.text ? f.text.stringValue : ''); }
          continue;
        }
        if (kind === 'leave') { seatLeave(E, seat); continue; }
        if (kind === 'start' && uid === E.hostUid && E.phase === 'lobby' && E.seats.length >= MIN) { deal(E); continue; }
        if (kind === 'again' && uid === E.hostUid && E.phase === 'end') { E.gameId++; E.seats.forEach((s) => { s.action = null; s.submitted = false; }); deal(E); continue; }
        if (kind === 'config' && uid === E.hostUid && E.phase === 'lobby') {
          const key = f.key && f.key.stringValue, val = Math.max(10, Math.min(300, Number(f.value && f.value.integerValue) || 0));
          if (['night', 'day', 'vote'].includes(key) && val) { E.config[key] = val; }
          continue;
        }
        if (kind === 'callVote' && uid === E.hostUid && E.phase === 'day') {
          E.phase = 'vote'; E.phaseDuration = E.config.vote; E.phaseEndsAt = Date.now() + E.config.vote * 1000;
          logSys(E, 'The host calls the vote. Ballots are open.'); continue;
        }
        if (['kill', 'protect', 'investigate'].includes(kind) && E.phase === 'night' && seat.alive) {
          const role = kind === 'kill' ? 'mafia' : kind === 'protect' ? 'doctor' : 'detective';
          if (seat.role !== role) continue;
          if (targetId !== null && !nightEligible(E, seat, kind).includes(targetId)) continue;
          seat.action = { action: kind, targetId, at }; seat.submitted = true; continue;
        }
        if (kind === 'vote' && E.phase === 'vote' && seat.alive) {
          if (targetId !== null && !aliveSeats(E).some((s) => s.id === targetId && s.id !== seat.id)) continue;
          seat.action = { action: 'vote', targetId, at }; seat.submitted = true; continue;
        }
      }
      if (seatsChanged || E._needBroadcast) { E._needBroadcast = false; await broadcast(E); }
    } catch (e) { if (!/denied|signed-out/.test(String(e.message))) {} }
    H.busy = false;
  }
  function nightEligible(E, seat, kind) {
    const live = aliveSeats(E);
    if (kind === 'kill') return live.filter((s) => !seat.mafiaTeam.includes(s.id)).map((s) => s.id);
    if (kind === 'protect') return live.filter((s) => s.id !== seat.id || !seat.selfProtectUsed).map((s) => s.id);
    return live.filter((s) => s.id !== seat.id).map((s) => s.id);
  }
  function seatLeave(E, seat) {
    seat.left = true; seat.alive = false; seat.fate = seat.fate || 'left'; seat.action = null; seat.submitted = false;
    logSys(E, `${seat.name} left the table.`);
    if (seat.uid === E.hostUid) { // the host closed the table
      E.phase = 'end'; E.winner = E.winner || null; E.statusClosed = true; E.phaseEndsAt = null;
      logSys(E, 'The host closed the table.');
    }
    winCheck(E);
  }

  // ═══════════════ CLIENT (host + guests share this) ═══════════════
  const C = { code: null, uid: null, seatId: null, pollT: null, lastSeq: -1, fedLog: false, feedSeen: {}, busy: false, gone: false };

  function pushFeed(feed) {
    if (!C.fedLog) { C.fedLog = true; handleO({ type: 'log', messages: feed.map(feedMsg) }); return; }
    feed.forEach((m) => {
      const key = m.channel + '|' + (m.from ? m.from.id : '') + '|' + (m.channel === 'system' ? m.text : m.msg);
      if (C.feedSeen[key]) return;
      C.feedSeen[key] = 1;
      handleO({ type: 'chat', message: feedMsg(m) });
    });
  }
  function feedMsg(m) {
    // chat entries in the engine log carry their payload in .msg (the
    // broadcast's Firestore write maps the same way) — reading .text alone
    // made the HOST's own feed render every chat as an empty bubble (v67 fix;
    // guests were fine because their poll reads the Firestore doc, where the
    // text was already written from m.msg)
    if (m.channel === 'system' || m.channel === 'private') return { channel: m.channel, text: m.text };
    return { channel: m.channel, text: m.msg !== undefined ? m.msg : m.text, from: { id: m.fromId, name: m.fromName, color: m.fromColor } };
  }
  async function poll() {
    if (!C.code || C.busy || C.gone) return;
    C.busy = true;
    try {
      const room = await getRoom(C.code);
      if (!room || room.status === 'closed') { // the table is truly gone
        stopPoll(); if (app.mode === 'online') { handleO({ type: 'left' }); } return;
      }
      const seat = room.seats.find((s) => s.uid === C.uid);
      if (!seat) {
        // the host has not seated us yet — give the reconcile loop ~15s
        if (!C.joinWait) C.joinWait = Date.now();
        if (Date.now() - C.joinWait > 15000) { toast('That table is already in play.'); clearO(); resetClient(); if (app.mode === 'online') { app.mode = null; app.V = null; app.screen = 'onlineHome'; render(); } }
        return;
      }
      C.joinWait = null;
      if (C.seatId !== seat.id) { C.seatId = seat.id; if (O.session) { O.session.playerId = seat.id; saveO(O.session); } }
      // heartbeat at most every 8s (Firestore free tier: 20K writes/day)
      if (!C.lastHb || Date.now() - C.lastHb > 8000) {
        C.lastHb = Date.now();
        await heartbeat(C.code, C.uid).catch(() => {});
      }
      if (H.E && H.code === C.code) return; // host applies its own view directly
      const vf = await getView(C.code, C.uid);
      if (!vf) return;
      const seq = Number(vf.seq.integerValue || '0');
      if (seq <= C.lastSeq) return;
      C.lastSeq = seq;
      const feed = (vf.feed?.arrayValue?.values || []).map((v) => {
        const m = v.mapValue.fields;
        return { channel: m.channel.stringValue, text: m.text.stringValue, fromId: m.fromId.stringValue, fromName: m.fromName.stringValue, fromColor: m.fromColor.stringValue };
      });
      pushFeed(feed);
      const st = JSON.parse(vf.state.stringValue || '{}');
      if (st && st.room) applyState(st);
    } catch (e) { if (/denied/.test(String(e.message))) { stopPoll(); onlineUnavailable('denied'); } } finally { C.busy = false; }
  }
  function stopPoll() { clearInterval(C.pollT); C.pollT = null; }

  // ── message routing (sendO → here) ──
  async function send(o) {
    try {
      const me = identity();
      if (o.type === 'create') return await doCreate(me);
      if (o.type === 'join') return await doJoin(me, o.code, o.name);
      if (!me) { clearO(); onlineUnavailable(); return; }
      if (!C.code) return;
      if (o.type === 'leave') { // both hosts and guests leave through the actions doc
        try { await upsert(roomPath(C.code) + '/actions', me.uid, { action: SV('leave'), at: { timestampValue: new Date().toISOString() } }); } catch (e) {}
        if (H.E && H.code === C.code) hostApply(H.E.seats.find((s) => s.uid === me.uid) || H.E.seats[0], o, me.uid);
        clearO(); resetClient(); return;
      }
      if (H.E && H.code === C.code) { applyHostAction(me.uid, o); return; } // the host device resolves locally
      const fields = { action: SV(o.action || o.type), at: { timestampValue: new Date().toISOString() } };
      if (o.targetId !== undefined) fields.targetId = o.targetId == null ? NV() : SV(o.targetId);
      if (o.text !== undefined) fields.text = SV(String(o.text).slice(0, 200));
      if (o.key !== undefined) fields.key = SV(o.key);
      if (o.value !== undefined) fields.value = IV(o.value);
      await upsert(roomPath(C.code) + '/actions', me.uid, fields);
    } catch (e) {
      if (/signed-out|denied/.test(String(e.message))) onlineUnavailable(/denied/.test(String(e.message)) ? 'denied' : undefined);
      else toast('The table is unreachable — check your connection.');
    }
  }
  function applyHostAction(uid, o) {
    // the host's own chat/actions go straight into the engine — mapped into
    // the same {action, targetId, ...} shape the actions docs carry
    const seat = H.E && H.E.seats.find((s) => s.uid === uid);
    if (!seat) return;
    seat.lastSeen = Date.now();
    hostApply(seat, { action: o.action || o.type, targetId: o.targetId, text: o.text, key: o.key, value: o.value }, uid);
  }
  function hostApply(seat, wrap, uid) {
    const E = H.E;
    const kind = wrap.action;
    const targetId = wrap.targetId === undefined ? null : wrap.targetId;
    let changed = true;
    if (kind === 'chat') {
      const chan = E.phase === 'lobby' || E.phase === 'day' ? 'public'
        : E.phase === 'night' && seat.role === 'mafia' && seat.alive ? 'mafia'
        : !seat.alive ? 'ghost' : null;
      if (chan) logChat(E, chan, seat, wrap.text || '');
    } else if (kind === 'leave') { seatLeave(E, seat); }
    else if (kind === 'start' && uid === E.hostUid && E.phase === 'lobby' && E.seats.length >= MIN) { deal(E); }
    else if (kind === 'again' && uid === E.hostUid && E.phase === 'end') { E.gameId++; E.seats.forEach((s) => { s.action = null; s.submitted = false; }); deal(E); }
    else if (kind === 'config' && uid === E.hostUid && E.phase === 'lobby') { const val = Math.max(10, Math.min(300, Number(wrap.value) || 0)); if (['night', 'day', 'vote'].includes(wrap.key) && val) E.config[wrap.key] = val; }
    else if (kind === 'callVote' && uid === E.hostUid && E.phase === 'day') { E.phase = 'vote'; E.phaseDuration = E.config.vote; E.phaseEndsAt = Date.now() + E.config.vote * 1000; logSys(E, 'The host calls the vote. Ballots are open.'); }
    else if (['kill', 'protect', 'investigate'].includes(kind) && E.phase === 'night' && seat.alive) {
      const role = kind === 'kill' ? 'mafia' : kind === 'protect' ? 'doctor' : 'detective';
      if (seat.role === role && (targetId === null || nightEligible(E, seat, kind).includes(targetId))) { seat.action = { action: kind, targetId, at: Date.now() }; seat.submitted = true; }
    } else if (kind === 'vote' && E.phase === 'vote' && seat.alive) {
      if (targetId === null || aliveSeats(E).some((s) => s.id === targetId && s.id !== seat.id)) { seat.action = { action: 'vote', targetId, at: Date.now() }; seat.submitted = true; }
    } else changed = false;
    if (changed) broadcast(E);
  }
  async function hostUidOf(code) { const r = await getRoom(code); return r ? r.hostUid : null; }

  async function doCreate(me) {
    if (!me) { onlineUnavailable(); return; }
    let code = '';
    for (let tries = 0; tries < 8; tries++) {
      code = Array.from({ length: 4 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');
      try {
        const E = freshEngine(code, me);
        const key = await roomKey(code, true);
        const blob = await sealEngine(key, E);
        await createRoomDoc(code, roomFields(E, blob));
        H.code = code; H.uid = me.uid; H.E = E; H.key = key;
        saveO({ token: code + ':' + me.uid, playerId: '0', roomCode: code });
        enterRoom(code, me.uid, '0');
        startHostLoops(); startPoll();
        broadcast(E);
        return;
      } catch (e) {
        if (/ALREADY_EXISTS/.test(String(e.message))) continue;
        if (/denied/.test(String(e.message))) { onlineUnavailable('denied'); return; }
        toast('Could not open the table — check your connection.'); return;
      }
    }
    toast('Could not find a free code — try again.');
  }
  async function doJoin(me, code, name) {
    if (!me) { onlineUnavailable(); return; }
    code = (code || '').toUpperCase();
    if (!/^[A-Z2-9]{4}$/.test(code)) { toast('Enter the four-letter room code.'); return; }
    try {
      const room = await getRoom(code);
      if (!room) { toast('No table with that code.'); return; }
      if (room.status !== 'open' || room.phase !== 'lobby') { toast('That table is already in play — join before the deal.'); return; }
      const mine = room.seats.find((s) => s.uid === me.uid);
      if (!mine && room.seats.length >= room.max) { toast('That table is full.'); return; }
      H.code = null; H.E = null; stopHostLoops();
      // the seat itself is claimed through THIS player's own actions doc (the
      // host reconciles the room doc — the rules only let the host write it)
      await upsert(roomPath(code) + '/actions', me.uid, { action: SV('join'), text: SV(name || seatName()), at: { timestampValue: new Date().toISOString() } });
      saveO({ token: code + ':' + me.uid, playerId: mine ? mine.id : '?', roomCode: code });
      enterRoom(code, me.uid, mine ? mine.id : '?'); startPoll();
    } catch (e) {
      if (/denied/.test(String(e.message))) onlineUnavailable('denied');
      else if (/signed-out/.test(String(e.message))) onlineUnavailable();
      else { console.log('MN_FS.doJoin error', String(e && e.message || e).slice(0, 160)); toast('Could not join — check the code and your connection.'); }
    }
  }
  function freshEngine(code, me) {
    return { code, hostUid: me.uid, hostSeatId: '0', seats: [Object.assign(newSeat(0, me.uid, seatName()), { lastSeen: Date.now() })],
      phase: 'lobby', night: 0, config: Object.assign({}, DEFAULT_CFG), gameId: 1, seq: 0, log: [], min: MIN, max: MAX,
      statusClosed: false, stats: { kills: 0, saves: 0, lynch: 0 } };
  }
  function roomFields(E, blob) {
    return { code: SV(E.code), hostUid: SV(E.hostUid), hostName: SV(E.seats[0].name), status: SV('open'), phase: SV('lobby'),
      seats: seatsToFields(E.seats), min: IV(E.min), max: IV(E.max),
      config: { mapValue: { fields: Object.fromEntries(Object.entries(E.config).map(([k, v]) => [k, IV(v)])) } },
      gameId: IV(E.gameId), seq: IV(E.seq), engine: SV(blob), updatedAt: { timestampValue: new Date().toISOString() } };
  }
  function enterRoom(code, uid, playerId) {
    C.code = code; C.uid = uid; C.lastSeq = -1; C.fedLog = false; C.feedSeen = {}; C.gone = false; C.lastHb = 0; C.endSent = null;
    O.sel = null; O.prevPhase = null; O.hadState = false; O.lastResultKey = ''; O.revealedGame = null; O.endKey = '';
    app.mode = 'online'; clearFeed();
    handleO({ type: 'joined', token: code + ':' + uid, playerId: playerId || '0', roomCode: code });
    setConn('live');
  }
  function resetClient() { stopPoll(); stopHostLoops(); H.E = null; H.code = null; C.code = null; C.uid = null; C.lastSeq = -1; C.fedLog = false; C.feedSeen = {}; }
  function startPoll() { stopPoll(); C.pollT = setInterval(poll, 1500); poll(); }

  async function connect() {
    setConn('connecting');
    const me = identity();
    if (!me || !authed()) { setConn('off'); onlineUnavailable(); return; }
    setConn('live');
    const sess = O.session;
    if (sess && sess.roomCode) {
      try {
        const room = await getRoom(sess.roomCode);
        const seat = room && room.seats.find((s) => s.uid === me.uid);
        if (room && seat && room.status !== 'closed') {
          if (room.hostUid === me.uid) {
            // resume hosting: decrypt the engine we left behind
            const key = await roomKey(sess.roomCode, false);
            const E = await openEngine(key, room.engine);
            if (E) {
              E.seats.forEach((s) => { s.lastSeen = Date.now(); });
              H.code = sess.roomCode; H.uid = me.uid; H.E = E; H.key = key;
              saveO({ token: sess.token, playerId: seat.id, roomCode: sess.roomCode });
              enterRoom(sess.roomCode, me.uid, seat.id); startHostLoops(); startPoll(); broadcast(E); return;
            }
          }
          H.code = null; H.E = null; stopHostLoops();
          saveO({ token: sess.token, playerId: seat.id, roomCode: sess.roomCode });
          enterRoom(sess.roomCode, me.uid, seat.id); startPoll(); return;
        }
      } catch (e) { if (/denied/.test(String(e.message))) { setConn('off'); onlineUnavailable('denied'); return; } }
    }
    // fresh visit — nothing to resume; the create/join buttons take it from here
  }

  return { send, connect, resetClient };
})();
