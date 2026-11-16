/* ============ WORD CREATOR — ONLINE PLAY (room codes) ============
   Two to four classmates, each on their own device, on one shared board.

   ── HOW THE TABLE STAYS IN STEP ───────────────────────────────────────
   The room document holds ONE thing that matters: the append-only move log
   (who placed which letters on which squares, or passed). Nothing else is
   trusted. Every device then does the same three things:

     1. DEAL from the room seed. buildBag(seed) below is the same pure
        function as the one unit-tested in src/games/wordcreator/online.ts,
        and the seed is write-once at room creation (word_creator_rooms in
        firestore.rules), so nobody can re-roll the bag after seeing it.
     2. REPLAY the log, in order, through the page's own engine
        (WC_ENGINE.applyMove): each move takes its tiles off that seat's
        rack, is scored from the board, and refills from the shared bag.
     3. STOP at the first move that does not hold up — tiles the seat never
        held, an occupied square, a player moving out of turn.

   Because every device replays the same moves through the same engine, the
   board, every score, every rack, the bag and the end of the match come out
   identical everywhere — and a reload simply replays the log again. (An
   earlier version copied only the board letters across: scores stayed at 0
   on the other devices, both players drew the same tiles, a reload dealt the
   opening rack again, and no online match could ever finish.)

   `scores`, `cells`, `bagSize` and `result` are written for display only and
   are never read back into a match.

   Racks are not secret from a determined player: any device can derive every
   rack from the seed. The page never shows another seat's tiles, which is the
   right level for a classroom game — it is not a tournament-grade guarantee.

   Everything below is inert when the page is opened without ?online — the
   offline game is untouched. */

var CMC_WORD_ONLINE = (function () {
  'use strict';

  var BASE = 'https://firestore.googleapis.com/v1/projects/creative-minds-cambodia/databases/(default)/documents';
  var KEY = 'AIzaSyDNUq0ru99XKh08D887Xk63h36MPOlXWwc';
  var POLL_MS = 1600;       // seated players
  var LOBBY_POLL_MS = 2600; // waiting for an opponent

  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function $id(id) { return document.getElementById(id); }
  function nowIso() { return new Date().toISOString(); }

  /* ── the signed-in session (same localStorage contract as the rest of the site) ── */
  var me = null;
  function whoami() {
    var uid = ls('cmc-student-uid');
    var name = (window.CMC_NG ? window.CMC_NG.get() : ls('cmc-student-name')) || '';
    if (!uid || !name) return null;
    return { uid: uid, name: name };
  }

  function idToken() {
    return new Promise(function (resolve) {
      var tok = ls('cmc-student-token');
      var exp = Number(ls('cmc-student-token-expires') || '0');
      if (tok && exp && exp > Date.now() + 30000) { resolve(tok); return; }
      var rt = ls('cmc-student-refresh-token');
      if (!rt) { resolve(tok || null); return; }
      fetch('https://securetoken.googleapis.com/v1/token?key=' + KEY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(rt)
      }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
        if (d && d.id_token) {
          lsSet('cmc-student-token', d.id_token);
          lsSet('cmc-student-token-expires', String(Date.now() + (Number(d.expires_in) || 3600) * 1000 - 60000));
          if (d.refresh_token) lsSet('cmc-student-refresh-token', d.refresh_token);
          resolve(d.id_token);
        } else resolve(null);
      }).catch(function () { resolve(null); });
    });
  }

  /* ── Firestore REST ─────────────────────────────────────────────────────
     Same discipline as mafia.html: a create POSTs to the COLLECTION path with
     ?documentId=CODE (posting to the doc path is a 400 INVALID_ARGUMENT), and
     a whole-document write is an unmasked PATCH. 404 is "not there" and is
     surfaced as null; 401/403 is a permissions problem and is surfaced as
     such — never swallowed into a generic failure. */
  function api(method, path, body) {
    return idToken().then(function (tok) {
      if (!tok) throw new Error('signed-out');
      return fetch(BASE + path, {
        method: method,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
    }).then(function (res) {
      if (res.status === 404) return null;
      if (res.status === 401 || res.status === 403) {
        var denied = new Error('denied'); denied.status = res.status; throw denied;
      }
      if (!res.ok) {
        return res.json().catch(function () { return {}; }).then(function (j) {
          var e = new Error((j && j.error && j.error.message) || ('HTTP ' + res.status));
          e.http = res.status; e.fsStatus = (j && j.error && j.error.status) || '';
          throw e;
        });
      }
      return res.status === 200 ? res.json() : {};
    });
  }

  function roomPath(code) { return '/word_creator_rooms/' + encodeURIComponent(code); }

  /* ── Firestore value helpers ──────────────────────────────────────────── */
  function SV(v) { return { stringValue: String(v == null ? '' : v) }; }
  function IV(v) { return { integerValue: String(Math.round(Number(v) || 0)) }; }
  function BV(v) { return { booleanValue: !!v }; }
  function TS(v) { return { timestampValue: v || nowIso() }; }
  function AR(v) { return { arrayValue: { values: v || [] } }; }
  function MAP(fields) { return { mapValue: { fields: fields } }; }
  function str(f, k, d) { return f && f[k] && f[k].stringValue != null ? f[k].stringValue : (d == null ? '' : d); }
  function bool(f, k, d) { return f && f[k] && f[k].booleanValue != null ? f[k].booleanValue : (d == null ? false : d); }
  function int(f, k, d) { return f && f[k] && f[k].integerValue != null ? Number(f[k].integerValue) : (d == null ? 0 : d); }
  function list(f, k) { return (f && f[k] && f[k].arrayValue && f[k].arrayValue.values) || []; }

  function parseRoom(f) {
    var seats = list(f, 'seats').map(function (v) {
      var m = v.mapValue.fields;
      return { uid: str(m, 'uid'), name: str(m, 'name'), host: bool(m, 'host') };
    });
    var moves = list(f, 'moves').map(function (v) {
      var m = v.mapValue.fields;
      return {
        n: int(m, 'n'),
        uid: str(m, 'uid'),
        kind: str(m, 'kind', 'play'),
        keys: list(m, 'keys').map(function (k) { return Number(k.integerValue || 0); }),
        letters: list(m, 'letters').map(function (k) { return String(k.stringValue || ''); }),
        blanks: list(m, 'blanks').map(function (k) { return !!k.booleanValue; }),
        h: str(m, 'h'),
        /* stored as a timestamp: read it back as one, or every later save would
           re-stamp the earlier moves with "now" */
        at: (m.at && (m.at.timestampValue || m.at.stringValue)) || ''
      };
    });
    return {
      code: str(f, 'code'),
      hostUid: str(f, 'hostUid'),
      hostName: str(f, 'hostName'),
      seed: str(f, 'seed'),
      seats: seats,
      seatsWanted: int(f, 'seatsWanted', 2),
      status: str(f, 'status', 'waiting'),
      moves: moves,
      cells: list(f, 'cells').map(function (k) { return String(k.stringValue || ''); }),
      scores: list(f, 'scores').map(function (k) { return Number(k.integerValue || 0); }),
      turn: int(f, 'turn', 0),
      bagSize: int(f, 'bagSize', 0),
      result: f && f.result && f.result.mapValue
        ? { text: str(f.result.mapValue.fields, 'text'), saved: bool(f.result.mapValue.fields, 'saved') }
        : null,
      closed: bool(f, 'closed', false)
    };
  }

  /* An unmasked PATCH REPLACES the document, so every write must carry the
     complete shape — including the fields this device never changes. */
  function roomFields(r) {
    return {
      code: SV(r.code),
      hostUid: SV(r.hostUid),
      hostName: SV(r.hostName),
      seed: SV(r.seed),
      seatsWanted: IV(r.seatsWanted || 2),
      status: SV(r.status),
      seats: AR(r.seats.map(function (s) {
        return MAP({ uid: SV(s.uid), name: SV(s.name), host: BV(s.host) });
      })),
      moves: AR(r.moves.map(function (m) {
        return MAP({
          n: IV(m.n), uid: SV(m.uid), kind: SV(m.kind || 'play'),
          keys: AR(m.keys.map(IV)),
          letters: AR((m.letters || []).map(SV)),
          blanks: AR((m.blanks || []).map(BV)),
          h: SV(m.h || ''),
          at: TS(m.at)
        });
      })),
      cells: AR(r.cells.map(SV)),
      scores: AR(r.scores.map(IV)),
      turn: IV(r.turn),
      bagSize: IV(r.bagSize || 0),
      result: r.result ? MAP({ text: SV(r.result.text), saved: BV(r.result.saved) }) : { nullValue: null },
      closed: BV(!!r.closed)
    };
  }

  /* Every read remembers the document's updateTime and every write is made
     against it (currentDocument.updateTime), so two devices writing at once
     cannot silently overwrite each other — the second write is refused and
     that device reads the room again. Without it, two classmates joining in
     the same second each saved "the room plus me" and one of them vanished. */
  function getRoom(code) {
    return api('GET', roomPath(code)).then(function (d) {
      if (!d || !d.fields) return null;
      var room = parseRoom(d.fields);
      room._ut = d.updateTime || '';
      return room;
    });
  }
  function isConflict(e) {
    return !!e && (e.http === 409 || e.http === 412 || e.fsStatus === 'FAILED_PRECONDITION' || e.fsStatus === 'ABORTED');
  }
  function createRoom(r) {
    return api('POST', '/word_creator_rooms?documentId=' + encodeURIComponent(r.code), { fields: roomFields(r) });
  }
  function saveRoom(r) {
    var q = r._ut ? '?currentDocument.updateTime=' + encodeURIComponent(r._ut) : '';
    return api('PATCH', roomPath(r.code) + q, { fields: roomFields(r) }).then(function (d) {
      if (d && d.updateTime) r._ut = d.updateTime;
      return d;
    });
  }

  /* ── THE DEAL — the single source of truth for who holds what ───────────
     Mirror of buildBag()/replayDeal() in src/games/wordcreator/online.ts.
     It is duplicated rather than imported because this page ships as a
     standalone file; the TypeScript copy is what the unit tests pin, and the
     board-hash check below is what keeps the two honest at runtime. */
  var DIST = {
    A: 9, B: 2, C: 2, D: 4, E: 12, F: 2, G: 3, H: 2, I: 9, J: 1, K: 1, L: 4, M: 2,
    N: 6, O: 8, P: 2, Q: 1, R: 6, S: 4, T: 6, U: 4, V: 2, W: 2, X: 1, Y: 2, Z: 1, '?': 2
  };
  function hashSeed(seed) {
    var h = 0x811c9dc5;
    for (var i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h >>> 0;
  }
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function buildBag(seed) {
    var bag = [];
    for (var L in DIST) for (var i = 0; i < DIST[L]; i++) bag.push({ letter: L, bl: L === '?' });
    var rand = rng(hashSeed(seed));
    for (var j = bag.length - 1; j > 0; j--) {
      var k = Math.floor(rand() * (j + 1));
      var t = bag[j]; bag[j] = bag[k]; bag[k] = t;
    }
    bag.forEach(function (t, ix) { t.id = 900000 + ix; }); // outside the engine's own TID range
    return bag;
  }

  /**
   * The opening racks plus the rest of the bag.
   *
   * The engine draws with `G.bag.pop()`, so the remainder is returned in POP
   * order (reversed): after seat 0..n take their opening hands, the next
   * pop() is exactly the next undealt tile of the shuffled bag. That keeps
   * the engine's own refill logic — and every later draw — identical on
   * every device, which is what makes an honest replay reproduce the host's
   * board tile for tile.
   */
  function openDeal(seed, seats) {
    var bag = buildBag(seed);
    var hands = [];
    for (var s = 0; s < seats; s++) hands.push(bag.slice(s * 7, s * 7 + 7));
    var rest = bag.slice(seats * 7).reverse();
    return { racks: hands, rest: rest };
  }

  /* ── the room UI strip ────────────────────────────────────────────────── */
  var ui = null;
  function buildUI() {
    if (ui) return ui;
    var style = document.createElement('style');
    style.textContent =
      '#wc-online{position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:99970;' +
      'font:600 11px/1.2 ui-sans-serif,system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase}' +
      '#wc-online .wco-bar{display:flex;align-items:center;gap:10px;padding:9px 13px;border-radius:13px;' +
      'background:rgba(8,16,32,.82);backdrop-filter:blur(18px);border:1px solid rgba(125,211,252,.28);' +
      'box-shadow:0 10px 34px rgba(0,0,0,.45);color:#e2f2ff;max-width:min(94vw,880px)}' +
      '#wc-online .wco-dot{width:7px;height:7px;border-radius:50%;background:#38bdf8;' +
      'box-shadow:0 0 10px #38bdf8;animation:wco-p 1.8s infinite;flex:none}' +
      '@keyframes wco-p{50%{opacity:.35}}' +
      '#wc-online .wco-room{font-weight:900;letter-spacing:.2em;color:#7dd3fc;white-space:nowrap}' +
      '#wc-online .wco-copy,#wc-online .wco-x{cursor:pointer;padding:4px 8px;border-radius:7px;flex:none;' +
      'border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:#cfe6ff;' +
      'font:600 10px/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:.08em}' +
      '#wc-online .wco-copy:hover,#wc-online .wco-x:hover{background:rgba(125,211,252,.16);color:#fff}' +
      '#wc-online .wco-copy[hidden]{display:none}' +
      '#wc-online .wco-status{color:#93a8c4;text-transform:none;letter-spacing:.02em;font-weight:600;' +
      'overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '#wc-online .wco-status.warn{color:#fcd34d}' +
      '#wc-online .wco-status.bad{color:#fda4af}' +
      '#wc-online .wco-status.ok{color:#7ee7c7}' +
      'body[data-screen="setup"] #wc-online,body[data-screen="online"] #wc-online{display:none}';
    document.head.appendChild(style);

    var wrap = document.createElement('div');
    wrap.id = 'wc-online';
    wrap.innerHTML =
      '<div class="wco-bar">' +
      '<span class="wco-dot"></span><span class="wco-room" id="wco-room">ONLINE</span>' +
      '<button class="wco-copy" id="wco-copy" hidden>Copy code</button>' +
      '<span class="wco-status" id="wco-status"></span>' +
      '<button class="wco-x" id="wco-leave">Leave</button>' +
      '</div>';
    document.body.appendChild(wrap);

    ui = { room: $id('wco-room'), copy: $id('wco-copy'), status: $id('wco-status'), leave: $id('wco-leave') };
    ui.copy.onclick = function () {
      try {
        navigator.clipboard.writeText(ui.code);
        ui.copy.textContent = 'Copied';
        setTimeout(function () { ui.copy.textContent = 'Copy code'; }, 1400);
      } catch (e) {}
    };
    ui.leave.onclick = function () {
      if (window.confirm('Leave this online match?')) {
        try { history.replaceState(null, '', location.pathname); } catch (e) {}
        location.reload();
      }
    };
    return ui;
  }

  var last = { text: '', tone: '' };
  function setStatus(text, tone) {
    var u = buildUI();
    u.status.textContent = text;
    u.status.className = 'wco-status' + (tone ? ' ' + tone : '');
    last.text = text; last.tone = tone || '';
    tellLobby();
  }
  /* The lobby card (index.html) paints whatever this reports. */
  function tellLobby() {
    try {
      if (window.WC_LOBBY) {
        window.WC_LOBBY({ mode: S.mode, code: S.code, room: S.room, seat: S.seat, status: last.text, tone: last.tone, me: me });
      }
    } catch (e) {}
  }
  function setCode(code) {
    var u = buildUI();
    u.room.textContent = 'ROOM ' + code;
    u.copy.hidden = false;
    u.code = code;
  }

  /* ── session state ────────────────────────────────────────────────────── */
  var S = {
    mode: null,       // 'host' | 'guest'
    code: '',
    room: null,
    seat: -1,
    timer: 0,
    busy: false,
    dead: false,
    started: false,
    applied: 0,       // moves of the log already run through the engine
    local: {}         // move number → true for moves THIS device played (already on its board)
  };

  function newSeed() {
    var a = new Uint8Array(16);
    try { crypto.getRandomValues(a); } catch (e) {
      for (var i = 0; i < a.length; i++) a[i] = (Math.random() * 256) | 0;
    }
    return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  function newCode() {
    var A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', out = '';
    for (var i = 0; i < 5; i++) out += A[Math.floor(Math.random() * A.length)];
    return out;
  }

  /* ── the board hash every device checks ──────────────────────────────── */
  function boardHash(cells) {
    var h = 0x811c9dc5;
    for (var i = 0; i < cells.length; i++) {
      h ^= String(cells[i] || '').charCodeAt(0) || 0;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return ('0000000' + h.toString(16)).slice(-8);
  }

  /* ── replay the public moves onto a board the engine can adopt ─────────
     This is the check that makes a hidden-client cheat visible: the board is
     rebuilt from the move log alone, and a move that would land on an
     occupied square or carry a non-letter is refused outright. When the log
     no longer matches what a player saw, the room stops instead of
     continuing on a board nobody can vouch for. */
  function replayBoard(moves) {
    var cells = new Array(225).fill('');
    for (var i = 0; i < moves.length; i++) {
      var mv = moves[i];
      if (mv.kind !== 'play') continue;
      for (var j = 0; j < mv.keys.length; j++) {
        var k = mv.keys[j];
        if (!(k >= 0 && k < 225)) return null;
        if (cells[k]) return null;
        var letter = String(mv.letters[j] || '');
        if (mv.blanks[j]) {
          if (!/^[a-zA-Z]$/.test(letter)) return null;
          cells[k] = letter.toLowerCase();
        } else {
          if (!/^[A-Z]$/.test(letter)) return null;
          cells[k] = letter;
        }
      }
      if (mv.h && boardHash(cells) !== mv.h) return null;
    }
    return cells;
  }

  /* ── joining an existing table ────────────────────────────────────────── */
  function join(code, tries) {
    return getRoom(code).then(function (room) {
      if (!room) throw new Error('No table with code ' + code);
      if (room.closed) throw new Error('That table is closed');
      if (room.seats.some(function (s) { return s.uid === me.uid; })) return room; // reconnect
      if (room.status === 'finished' || room.result) throw new Error('That match has already ended');
      if (room.status !== 'waiting') throw new Error('That match has already started');
      if (room.seats.length >= room.seatsWanted) throw new Error('That table is full');
      room.seats.push({ uid: me.uid, name: me.name, host: false });
      if (room.seats.length >= room.seatsWanted) room.status = 'playing';
      return saveRoom(room).then(function () { return room; }, function (e) {
        /* somebody else took a seat in the same moment: look again */
        if (isConflict(e) && (tries || 0) < 4) return join(code, (tries || 0) + 1);
        throw e;
      });
    });
  }

  function seatOf(room) { return room.seats.findIndex(function (s) { return s.uid === me.uid; }); }
  function turnName(room) { return (room.seats[room.moves.length % room.seats.length] || {}).name || 'the next player'; }
  function myTurn(room) { return S.seat === room.moves.length % room.seats.length; }

  /* ── polling ──────────────────────────────────────────────────────────── */
  function poll() {
    if (S.dead) return;
    clearTimeout(S.timer);
    var waiting = !S.started;
    S.timer = setTimeout(function () {
      getRoom(S.code).then(function (room) {
        if (S.dead) return;
        if (!room) { S.dead = true; setStatus('The table was closed', 'bad'); return; }
        if (handleRoom(room)) poll();
      }).catch(function () {
        setStatus('Reconnecting…', 'warn');
        S.timer = setTimeout(poll, 4200);
      });
    }, waiting ? LOBBY_POLL_MS : POLL_MS);
  }

  /* One fresh copy of the room. Returns true while the table should keep
     polling. */
  function handleRoom(room) {
    /* A read that left before this device's own move was saved can arrive
       after it. Acting on it would hand the turn back and let the same player
       move twice — so a copy that is behind what this device has already
       played is simply dropped. */
    if (room.moves.length < S.applied) return true;
    S.room = room;
    S.seat = seatOf(room);
    if (S.seat < 0) { S.dead = true; setStatus('You are not seated at this table', 'bad'); return false; }
    if (!S.started) {
      if (room.status === 'waiting' && !room.result) {
        setStatus('Waiting for players (' + room.seats.length + '/' + room.seatsWanted + ')', 'warn');
        return true;
      }
      if (room.seats.length < 2) { setStatus('Waiting for players', 'warn'); return true; }
      if (!startEngine(room)) return false;
    } else if (!applyRoomUpdate(room)) {
      return false;
    }
    var eng = window.WC_ENGINE;
    if (room.result || room.status === 'finished' || (eng && eng.isOver && eng.isOver())) { finish(room); return false; }
    if (eng && eng.syncTurn) eng.syncTurn(room.moves.length % room.seats.length, myTurn(room));
    if (!S.busy) setStatus(myTurn(room) ? 'Your turn' : 'Waiting for ' + turnName(room), myTurn(room) ? 'ok' : '');
    return true;
  }

  /* The cheap checks every device makes on the log before the engine sees
     it: the board letters replay without collisions (and match each move's
     hash), and every move was made by the seat whose turn it was. */
  function logHolds(room) {
    if (!replayBoard(room.moves)) return 'The published board could not be verified';
    for (var i = 0; i < room.moves.length; i++) {
      var seat = room.seats.findIndex(function (s) { return s.uid === room.moves[i].uid; });
      if (seat !== i % room.seats.length) return 'Move ' + (i + 1) + ' is out of turn';
    }
    return '';
  }

  /* ── the engine bridge ────────────────────────────────────────────────── */
  function startEngine(room) {
    var eng = window.WC_ENGINE;
    if (!eng) { setStatus('Game engine unavailable', 'bad'); S.dead = true; return false; }
    var bad = logHolds(room);
    if (bad) { setStatus(bad + ' — stopping', 'bad'); S.dead = true; return false; }
    var deal = openDeal(room.seed, room.seats.length);
    S.started = true;
    S.applied = room.moves.length;
    var ok = eng.startOnline({
      cfg: room.seats.map(function (s) { return { name: s.name, ai: false, diff: 'normal' }; }),
      racks: deal.racks,
      rest: deal.rest,
      seat: S.seat,
      /* the whole log: the engine rebuilds board, scores, racks and bag from it */
      moves: room.moves,
      /* These closures must read the LIVE S.room, never the `room` argument:
         every poll replaces S.room with a fresh parse, so a captured copy
         freezes at the opening turn and silently drops every later move. */
      onPlay: function (mv, end) {
        mv.kind = 'play';
        mv.h = boardHash(replayBoard(S.room.moves.concat([mv])) || []);
        publish(mv, end);
      },
      onPass: function (end) {
        publish({ kind: 'pass', keys: [], letters: [], blanks: [] }, end);
      }
    });
    if (ok === false) { setStatus('The move log does not replay — stopping', 'bad'); S.dead = true; return false; }
    return true;
  }

  /* Publish one move this device has ALREADY played on its own board. If the
     room refuses it, the board here is ahead of the table, and the only
     honest repair is to rebuild from the log: reload. */
  function publish(mv, end) {
    var room = S.room;
    if (!room) return;
    var eng = window.WC_ENGINE;
    S.busy = true;
    mv.n = room.moves.length;
    mv.uid = me.uid;
    mv.at = nowIso();
    S.local[mv.n] = true;
    S.applied = mv.n + 1;
    room.moves = room.moves.concat([mv]);
    room.turn = room.moves.length % room.seats.length;
    var snap = eng && eng.snapshot ? eng.snapshot(end || null) : null;
    if (snap) { room.scores = snap.scores; room.bagSize = snap.bagSize; }
    room.cells = replayBoard(room.moves) || [];
    if (end) { room.status = 'finished'; room.result = { text: (snap && snap.text) || 'Match complete', saved: true }; }
    setStatus(end ? 'Match complete' : 'Waiting for ' + turnName(room));
    saveRoom(room).then(function () {
      S.busy = false;
      if (end) finish(room);
    }).catch(function (e) {
      S.busy = false; S.dead = true;
      clearTimeout(S.timer);
      setStatus('Your move was not saved (' + (e.message || 'network') + ') — reloading the table…', 'bad');
      setTimeout(function () { location.reload(); }, 1800);
    });
  }

  /* Run everything published since the last poll through the engine.
     Returns false when the log stopped making sense (the caller stops). */
  function applyRoomUpdate(room) {
    var eng = window.WC_ENGINE;
    if (room.moves.length <= S.applied) return true;
    var bad = logHolds(room);
    if (bad) { setStatus(bad + ' — stopping', 'bad'); S.dead = true; return false; }
    while (S.applied < room.moves.length) {
      var n = S.applied;
      /* this device's own moves are on its board already */
      if (!S.local[n] && !eng.applyMove(room.moves[n], n % room.seats.length)) {
        setStatus('Move ' + (n + 1) + ' could not be verified — stopping', 'bad');
        S.dead = true;
        return false;
      }
      S.applied = n + 1;
    }
    return true;
  }

  /* ── finishing ────────────────────────────────────────────────────────── */
  function finish(room) {
    S.dead = true;
    clearTimeout(S.timer);
    setStatus(room.result && room.result.text ? room.result.text : 'Match over', 'ok');
    /* The engine ends the match itself: every device replays the same final
       move and reaches the same result (the player who went out is credited
       a moment later, after the last word has been shown). Ending it from
       here as well would get in first and score the finish as "nobody went
       out". This is only a fallback for a room closed some other way. */
    setTimeout(function () {
      if (window.WC_ENGINE && window.WC_ENGINE.showResult) window.WC_ENGINE.showResult(room);
    }, 4000);
  }

  /* ── boot: ?online=CODE joins, ?online= opens a new table ─────────────── */
  function boot() {
    var params = new URLSearchParams(location.search);
    if (!params.has('online')) return false;
    var code = String(params.get('online') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    me = whoami();
    buildUI();
    if (!me) {
      setStatus('Sign in to play online', 'bad');
      return true;
    }
    if (code) {
      S.mode = 'guest';
      S.code = code;
      setStatus('Joining ' + code + '…');
      join(code).then(function (room) {
        setCode(code);
        if (handleRoom(room)) poll();
      }).catch(function (e) {
        S.code = '';
        setStatus(e.status ? 'This account cannot join online tables yet' : (e.message === 'Failed to fetch' ? 'No connection — check the internet and try again' : (e.message || 'Could not join')), 'bad');
      });
      return true;
    }
    /* Host: the lobby's "Open a room" button opens the table. */
    S.mode = 'host';
    setStatus('Choose how many players, then open a room — you get a code to share', 'warn');
    window.WC_ONLINE_HOST = function (playerCount) {
      if (S.code) return Promise.resolve(S.code);
      var code2 = newCode();
      var room = {
        code: code2, hostUid: me.uid, hostName: me.name, seed: newSeed(),
        seatsWanted: Math.max(2, Math.min(4, playerCount || 2)),
        /* A one-seat table is not a match: stay in the lobby until the seats
           are filled. */
        status: 'waiting',
        seats: [{ uid: me.uid, name: me.name, host: true }],
        moves: [], cells: [], scores: [], turn: 0, bagSize: 0, result: null, closed: false
      };
      setStatus('Opening a room…');
      return createRoom(room).then(function () {
        S.code = code2;
        S.room = room;
        S.seat = 0;
        setCode(code2);
        setStatus('Waiting for players (1/' + room.seatsWanted + ')', 'warn');
        try { history.replaceState(null, '', location.pathname + '?online=' + code2); } catch (e) {}
        poll();
        return code2;
      }).catch(function (e) {
        setStatus(e.status ? 'This account cannot open online tables yet' : 'Could not open a room: ' + (e.message === 'Failed to fetch' ? 'no connection' : (e.message || 'network')), 'bad');
        return null;
      });
    };
    return true;
  }

  return {
    boot: boot,
    /* exposed for tests and for the page's own diagnostics */
    _internals: {
      buildBag: buildBag, openDeal: openDeal, boardHash: boardHash, replayBoard: replayBoard,
      parseRoom: parseRoom, roomFields: roomFields, newCode: newCode
    }
  };
})();
CMC_WORD_ONLINE.boot();
