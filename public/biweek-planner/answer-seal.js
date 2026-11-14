/*
 * CMC Answer Seal — opens the encrypted answer key of a bi-weekly test for a
 * verified teacher, and gives students' browsers nothing to read.
 *
 * Loaded by every test page under tests/ right AFTER the engine script, and
 * by the Studio page (library use only).
 *
 * WHY THIS EXISTS
 *   This is a static site built from a public repository, and the teacher
 *   gate (teacher-gate.js) only hides the page with CSS. While the answers
 *   sat in page source, any student could read them with "View source".
 *   Now each page carries the answers ENCRYPTED (window.CMC_SEAL, written by
 *   scripts/seal_tests.mjs with the school's public key). The private key is
 *   not in the site at all: it is one Firestore document,
 *   teacher_secrets/answer-seal, which the security rules open to verified
 *   teachers only. So the database — not page JavaScript — decides who can
 *   see an answer.
 *
 * WHAT IT DOES ON A TEST PAGE
 *   - Always: labels every question card with a stable id (data-sid =
 *     "<bankId>:<rowIndex>") so an answer sheet can be graded later, even on
 *     the recap pages that shuffle questions and options.
 *   - Student arriving through an invite link: nothing else. student-invite.js
 *     calls CMC_ANSWER_SEAL.sheet() and submits the raw answers; the teacher
 *     dashboard grades them.
 *   - Signed-in teacher (no ?invite=): fetches the private key with the
 *     teacher's own Firebase session, decrypts the answers in memory and
 *     hands them to the page engine, so preview and instant grading work as
 *     before. Until that succeeds, Submit is held with a clear message
 *     instead of grading against an empty key.
 *
 * The key is kept in memory only — never in localStorage/sessionStorage.
 */
(function () {
  'use strict';

  var API = (window.CMC_ANSWER_SEAL = window.CMC_ANSWER_SEAL || {});
  if (API.ready) return; // loaded twice
  API.ready = true;

  var PROJECT = 'creative-minds-cambodia';
  var FS_BASE = 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/(default)/documents';
  var FB_API_KEY = window.CMC_FB_API_KEY || 'AIzaSyDNUq0ru99XKh08D887Xk63h36MPOlXWwc';
  var INFO = 'cmc-answer-seal-v1';

  /* ── 0. Where this script lives (…/biweek-planner/) ───────────────── */
  var BASE = '';
  try {
    var me = document.currentScript;
    if (me && me.src) BASE = me.src.replace(/answer-seal\.js.*$/, '');
  } catch (e) { /* keep '' → relative fetch */ }

  /* ── 1. Small helpers ─────────────────────────────────────────────── */
  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function setLs(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function unb64u(s) {
    var b64 = String(s).replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    var bin = atob(b64);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function concat() {
    var n = 0, i;
    for (i = 0; i < arguments.length; i++) n += arguments[i].length;
    var out = new Uint8Array(n), at = 0;
    for (i = 0; i < arguments.length; i++) { out.set(arguments[i], at); at += arguments[i].length; }
    return out;
  }
  function utf8(s) { return new TextEncoder().encode(s); }
  function fail(code, message) { var e = new Error(message); e.code = code; return e; }

  /** The engine's own comparison form: a single index → "2", a multi-select
   *  → its values as strings, sorted, joined with "|". */
  function normalize(answer) {
    return Array.isArray(answer) ? answer.map(String).sort().join('|') : String(answer);
  }
  API.normalize = normalize;

  /** Flatten a decrypted payload to { sid: normalizedAnswer }. */
  function keyMap(payload) {
    var map = {};
    Object.keys(payload.banks || {}).forEach(function (tid) {
      payload.banks[tid].forEach(function (a, i) { map[tid + ':' + i] = normalize(a); });
    });
    (payload.ra || []).forEach(function (r, i) { map['RA:' + i] = r[0] + ':' + r[1]; });
    (payload.rb || []).forEach(function (r, i) { map['RB:' + i] = normalize(r); });
    return map;
  }
  API.keyMap = keyMap;

  /* ── 2. Crypto (ECIES over P-256, see scripts/seal_tests.mjs) ─────── */
  var pubPromise = null;
  function loadPublic() {
    if (!pubPromise) {
      pubPromise = fetch(BASE + 'answer-seal.pub.json', { cache: 'no-cache' }).then(function (r) {
        if (!r.ok) throw fail('network', 'Could not load the public key file.');
        return r.json();
      }).catch(function (e) { pubPromise = null; throw e.code ? e : fail('network', 'Could not load the public key file.'); });
    }
    return pubPromise;
  }
  function importPrivate(pub, code) {
    var d = String(code || '').trim().replace(/^cmcseal1\./, '');
    return crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: pub.x, y: pub.y, d: d, ext: true },
      { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits'])
      .catch(function () { throw fail('mismatch', 'The installed answer key is not valid for this site.'); });
  }
  function openSeal(pub, priv, slug, seal) {
    var recipientRaw = concat(new Uint8Array([4]), unb64u(pub.x), unb64u(pub.y));
    var epkRaw = unb64u(seal.epk);
    return crypto.subtle.importKey('raw', epkRaw, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
      .then(function (epk) { return crypto.subtle.deriveBits({ name: 'ECDH', public: epk }, priv, 256); })
      .then(function (bits) { return crypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey']); })
      .then(function (hk) {
        return crypto.subtle.deriveKey(
          { name: 'HKDF', hash: 'SHA-256', salt: concat(epkRaw, recipientRaw), info: utf8(INFO) },
          hk, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
      })
      .then(function (key) {
        return crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64u(seal.iv), additionalData: utf8(slug) }, key, unb64u(seal.ct));
      })
      .then(function (pt) { return JSON.parse(new TextDecoder().decode(pt)); })
      .catch(function (e) { throw e && e.code ? e : fail('mismatch', 'The installed answer key does not open this test.'); });
  }

  /* ── 3. The teacher's Firebase session (same keys as the main app) ── */
  function refreshToken() {
    var rt = ls('cmc-student-refresh-token');
    if (!rt) return Promise.resolve(null);
    return fetch('https://securetoken.googleapis.com/v1/token?key=' + FB_API_KEY, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(rt)
    }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d || !d.id_token) return null;
      setLs('cmc-student-token', d.id_token);
      setLs('cmc-student-token-expires', String(Date.now() + (Number(d.expires_in) || 3600) * 1000 - 60000));
      if (d.refresh_token) setLs('cmc-student-refresh-token', d.refresh_token);
      return d.id_token;
    }).catch(function () { return null; });
  }
  function currentToken() {
    var token = ls('cmc-student-token');
    var exp = Number(ls('cmc-student-token-expires') || '0');
    if (token && (!exp || exp > Date.now())) return Promise.resolve(token);
    return refreshToken().then(function (t) { return t || token; });
  }
  function uidOf(token) {
    try {
      var p = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return String(p.user_id || p.sub || '');
    } catch (e) { return ''; }
  }
  function fsGet(path, token) {
    return fetch(FS_BASE + path, { headers: { Authorization: 'Bearer ' + token } })
      .catch(function () { throw fail('network', 'Could not reach the server.'); });
  }

  /** Fetch the private key code from Firestore. The rules decide: only a
   *  verified teacher gets a 200. Resolves to the code string. */
  var codePromise = null;
  function fetchCode() {
    if (codePromise) return codePromise;
    codePromise = currentToken().then(function (token) {
      if (!token) throw fail('signin', 'Sign in with your teacher account to unlock the answer key.');
      function read(tok, allowRetry) {
        return fsGet('/teacher_secrets/answer-seal', tok).then(function (res) {
          if (res.ok) {
            return res.json().then(function (doc) {
              var f = (doc && doc.fields) || {};
              var code = f.key && f.key.stringValue;
              if (!code) throw fail('missing', 'The school answer key has not been installed yet.');
              return code;
            });
          }
          if (res.status === 404) throw fail('missing', 'The school answer key has not been installed yet.');
          if (res.status === 401 && allowRetry) {
            return refreshToken().then(function (t) {
              if (!t) throw fail('signin', 'Your session expired — sign in again to unlock the answer key.');
              return read(t, false);
            });
          }
          if (res.status === 403 && allowRetry) {
            // A teacher who has never opened the dashboard has no allowlist
            // entry yet. Register once (the rules accept it only from a
            // verified teacher account), then try again.
            var uid = uidOf(tok);
            return fetch(FS_BASE + '/teachers?documentId=' + encodeURIComponent(uid), {
              method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
              body: JSON.stringify({ fields: { registeredAt: { stringValue: new Date().toISOString() } } })
            }).then(function () { return read(tok, false); }, function () { return read(tok, false); });
          }
          if (res.status === 401) throw fail('signin', 'Your session expired — sign in again to unlock the answer key.');
          if (res.status === 403) throw fail('denied', 'This account is not allowed to open answer keys (verified teacher accounts only).');
          throw fail('network', 'The server answered ' + res.status + ' — try again in a moment.');
        });
      }
      return read(token, true);
    });
    codePromise.catch(function () { codePromise = null; }); // a failure may be retried
    return codePromise;
  }
  API.fetchCode = fetchCode;

  /** Open one seal: resolves to the decrypted payload. */
  API.open = function (slug, seal) {
    return Promise.all([loadPublic(), fetchCode()]).then(function (v) {
      var pub = v[0];
      if (seal.kid && pub.kid && seal.kid !== pub.kid) throw fail('mismatch', 'This test was sealed with a different key.');
      return importPrivate(pub, v[1]).then(function (priv) { return openSeal(pub, priv, slug, seal); });
    });
  };

  /** Library helper (Studio): find the seal inside a test page's HTML text. */
  API.sealFromHtml = function (html) {
    var at = html.indexOf('window.CMC_SEAL=');
    if (at < 0) return null;
    var end = html.indexOf('\n', at);
    var json = html.slice(at + 'window.CMC_SEAL='.length, end < 0 ? html.length : end).replace(/;\s*$/, '');
    try { return JSON.parse(json); } catch (e) { return null; }
  };

  /* ── 4. Page integration (only on a sealed test page) ─────────────── */
  var SEAL = window.CMC_SEAL;
  if (!SEAL || !window.TEST_BANKS) return; // library use (e.g. Studio)

  var slug = (window.location.pathname.split('/').pop() || '').replace(/\.html$/, '');
  var layoutProblem = '';
  var canon = []; // every question id in canonical (unshuffled) order

  function cardsIn(id) {
    var el = document.getElementById(id);
    return el ? Array.prototype.slice.call(el.querySelectorAll('.question-card')) : null;
  }
  /** Label each card with the bank row it came from. The classic engine
   *  renders a bank's rows in order into the element whose id is the bank
   *  id; the recap engine shuffles and stamps data-sid itself. */
  function stampSids() {
    var banks = window.TEST_BANKS || {};
    Object.keys(banks).forEach(function (tid) {
      var cards = cardsIn(tid);
      if (!cards) return; // bank not rendered on this page
      if (cards.length !== banks[tid].length) { layoutProblem = 'section ' + tid; return; }
      banks[tid].forEach(function (_, i) { canon.push(tid + ':' + i); });
      if (cards.every(function (c) { return !!c.dataset.sid; })) return; // recap engine did it
      cards.forEach(function (c, i) { c.dataset.sid = tid + ':' + i; });
    });
    [['RHETORICAL_A', 'rhetorical-a-list', 'RA'], ['RHETORICAL_B', 'rhetorical-b-list', 'RB']].forEach(function (spec) {
      var rows = window[spec[0]];
      if (!rows) return;
      var cards = cardsIn(spec[1]);
      if (!cards) return;
      if (cards.length !== rows.length) { layoutProblem = 'section ' + spec[1]; return; }
      cards.forEach(function (c, i) { c.dataset.sid = spec[2] + ':' + i; canon.push(spec[2] + ':' + i); });
    });
    var all = document.querySelectorAll('.question-card');
    if (!layoutProblem && all.length !== canon.length) layoutProblem = 'question count';
  }
  stampSids();

  function cardBySid() {
    var map = {};
    Array.prototype.forEach.call(document.querySelectorAll('.question-card'), function (c) {
      if (c.dataset.sid) map[c.dataset.sid] = c;
    });
    return map;
  }
  /** What the student ticked on one card, in ORIGINAL (unshuffled) option
   *  terms and in the engine's comparison form. '' when nothing is ticked. */
  function cardValue(card) {
    var checked = Array.prototype.slice.call(card.querySelectorAll('input:checked'));
    if (!checked.length) return '';
    var order = card.dataset.order ? card.dataset.order.split(',') : null;
    return checked.map(function (i) { return order ? String(order[Number(i.value)]) : String(i.value); }).sort().join('|');
  }
  /** The same answer as option LETTERS for the teacher's readable log, in
   *  the test's ORIGINAL option order (A = the first option as written),
   *  whatever order this student saw them in. */
  function cardLetters(card) {
    var inputs = Array.prototype.slice.call(card.querySelectorAll('input'));
    var order = card.dataset.order ? card.dataset.order.split(',') : null;
    return inputs.filter(function (i) { return i.checked; }).map(function (i) {
      var shown = inputs.indexOf(i);
      return String.fromCharCode(65 + (order ? Number(order[shown]) : shown));
    }).sort().join('');
  }

  /** The answer sheet of the page as it stands now.
   *    answers — { sid: value } for every answered question (what is graded)
   *    letters — { sid: "AC" } the same answers as letters (readable log)
   *    total   — number of questions on the page
   *    order   — every sid in canonical order (question 1, 2, 3 …) */
  API.sheet = function () {
    var cards = cardBySid();
    var answers = {}, letters = {};
    canon.forEach(function (sid) {
      var card = cards[sid];
      if (!card) return;
      var v = cardValue(card);
      if (v !== '') { answers[sid] = v; letters[sid] = cardLetters(card); }
    });
    return { answers: answers, letters: letters, total: canon.length, order: canon.slice(), ok: !layoutProblem };
  };
  API.sealed = true;
  API.state = 'idle';

  // Invite links end here: nothing is fetched, nothing is decrypted, and
  // student-invite.js owns Submit.
  if (window.CMC_INVITE_OK === true) return;

  /* ── 5. Teacher view: unlock, then hand the answers to the engine ─── */
  var CHIP_ID = 'cmc-seal-chip';
  function chip(kind, text, action) {
    var el = document.getElementById(CHIP_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = CHIP_ID;
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      el.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:99990;max-width:min(420px,calc(100vw - 32px));' +
        'display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:12px;font:600 12px/1.45 Inter,"Segoe UI",sans-serif;' +
        'backdrop-filter:blur(10px);box-shadow:0 14px 40px -18px rgba(0,0,0,.7);transition:opacity .4s';
      document.body.appendChild(el);
    }
    var tone = kind === 'open' ? ['rgba(16,185,129,.14)', '#6ee7b7', 'rgba(16,185,129,.4)']
      : kind === 'locked' ? ['rgba(248,113,113,.14)', '#fca5a5', 'rgba(248,113,113,.45)']
        : ['rgba(56,189,248,.12)', '#7dd3fc', 'rgba(56,189,248,.35)'];
    el.style.background = tone[0]; el.style.color = tone[1]; el.style.border = '1px solid ' + tone[2];
    el.style.opacity = '1';
    el.textContent = '';
    var span = document.createElement('span');
    span.textContent = text;
    el.appendChild(span);
    if (action) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = action.label;
      btn.style.cssText = 'flex:none;padding:5px 10px;border-radius:8px;border:1px solid currentColor;background:transparent;color:inherit;font:inherit;cursor:pointer';
      btn.addEventListener('click', action.run);
      el.appendChild(btn);
    }
    if (kind === 'open') setTimeout(function () { el.style.opacity = '0'; setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 500); }, 4500);
  }

  // Hold Submit while the key is not open: grading against placeholders
  // would show (and record) a meaningless 0.
  var engineSubmit = typeof window.doSubmit === 'function' ? window.doSubmit : null;
  var lockedReason = 'The answer key is still loading — try again in a moment.';
  function heldSubmit() {
    chip('locked', lockedReason + ' Nothing was graded.',
      window.CMC_TEACHER_GATE_OK === true ? { label: 'Retry', run: unlock } : null);
  }
  function holdSubmit() { window.doSubmit = heldSubmit; }
  function releaseSubmit() { if (engineSubmit) window.doSubmit = engineSubmit; }

  function apply(payload) {
    if (layoutProblem) throw fail('layout', 'This page does not match its answer key (' + layoutProblem + ').');
    var map = keyMap(payload);
    var cards = cardBySid();
    var sids = Object.keys(map);
    if (sids.length !== canon.length) throw fail('layout', 'This page does not match its answer key (question count).');
    sids.forEach(function (sid) {
      var card = cards[sid];
      if (!card) throw fail('layout', 'This page does not match its answer key (' + sid + ').');
      if (card.dataset.order) {
        // Recap engine: options were shuffled — translate the original
        // option index to where that option is displayed now.
        card.dataset.answer = String(card.dataset.order.split(',').indexOf(map[sid]));
      } else {
        card.dataset.answer = map[sid];
      }
    });
    Object.keys(payload.expl || {}).forEach(function (tid) {
      payload.expl[tid].forEach(function (text, i) {
        var card = cards[tid + ':' + i];
        if (card && text) card.dataset.expl = text;
      });
    });
  }

  var MESSAGES = {
    missing: 'The school answer key is not installed yet. The site owner installs it once from the dashboard (Bi-Weekly Tests → Answer protection).',
    denied: 'This account cannot open answer keys — only verified teacher accounts can.',
    signin: 'Your teacher session has expired. Sign in again on the main site, then reload this page.',
    mismatch: 'The installed answer key does not match this test.',
    layout: 'This page does not match its answer key. Tell the site owner.',
    network: 'Could not reach the server to unlock the answer key. Check the connection.'
  };

  function unlock() {
    API.state = 'loading';
    holdSubmit();
    chip('loading', 'Unlocking the answer key…');
    return API.open(slug, SEAL).then(function (payload) {
      apply(payload);
      API.state = 'open';
      releaseSubmit();
      chip('open', 'Answer key unlocked — teacher view.');
      try { document.dispatchEvent(new CustomEvent('cmc-seal-open')); } catch (e) {}
    }).catch(function (err) {
      codePromise = null; // Retry must fetch again (the key may have been replaced)
      API.state = 'locked';
      API.error = (err && err.code) || 'network';
      lockedReason = MESSAGES[API.error] || MESSAGES.network;
      holdSubmit();
      chip('locked', lockedReason, { label: 'Retry', run: unlock });
      try { document.dispatchEvent(new CustomEvent('cmc-seal-locked', { detail: API.error })); } catch (e) {}
    });
  }
  API.unlock = unlock;

  // No teacher session (the teacher gate is covering the page): there is no
  // key to ask for. Submit stays held so nothing is graded against an empty
  // key, and no request is made.
  if (window.CMC_TEACHER_GATE_OK !== true) {
    API.state = 'locked';
    API.error = 'signin';
    lockedReason = 'Sign in with a teacher account to use this test.';
    holdSubmit();
    return;
  }
  if (!window.crypto || !window.crypto.subtle) {
    API.state = 'locked';
    lockedReason = 'This browser cannot unlock the answer key (it needs a secure https page).';
    holdSubmit();
    chip('locked', lockedReason);
    return;
  }
  unlock();
})();
