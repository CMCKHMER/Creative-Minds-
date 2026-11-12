#!/usr/bin/env python3
"""Build public/rfc3/doctor-fish.html — Unit 14 · Doctor Fish · Homeworks 1-3.

Takes the teacher's uploaded 3-homework file (upload/unit14.html) 1:1 as the
content base and injects the SAME site furniture Unit 13/15 shipped:
  · per-homework share gate (biweekly_tests/hw-kid11-u14-hw1|2|3 — public
    read, teacher-only write, NO rules change),
  · back-to-CMC pill, teacher preview banner, locked overlay,
  · bottom action bar (Submit to Teacher + Share), toast, share panel,
  · name/date hero sync + email-as-name guards in the submit payload,
  · Kid-11-card-compatible tabs that hide for students until shared.
"""
import re
from pathlib import Path

ROOT = Path('/home/z/my-project/tmp/cmc-site')
SRC = Path('/home/z/my-project/upload/unit14.html')
OUT = ROOT / 'public/rfc3/doctor-fish.html'

html = SRC.read_text(encoding='utf-8')

# ── 1. Chassis CSS (namespaced hw-/cmc-, themed deep-sea) ────────────────
HEAD_CSS = """
<style>
/* ── CMC site furniture (Kid 11 online homework) — namespaced hw-/cmc- ── */
#cmc-back-btn{position:fixed;top:14px;right:14px;z-index:60;display:flex;align-items:center;
  gap:8px;padding:9px 16px;border-radius:999px;background:rgba(3,20,24,.9);
  border:1px solid rgba(45,212,191,.45);color:#e6f4f4;font-family:'Outfit',system-ui,sans-serif;
  font-size:13px;font-weight:700;text-decoration:none;box-shadow:0 8px 24px rgba(0,0,0,.35);transition:.2s}
#cmc-back-btn:hover{background:rgba(45,212,191,.16);transform:translateY(-1px)}
/* the fixed worksheet header owns the top edge — leave room for the back pill.
   The teacher's file stacks the header at z-index:60, same as the pill, and the
   header paints later — so the header drops to 50 (still above the sticky
   toolbar at 40) and the pill stays clickable, like the other homework pages. */
.site-head{padding-right:170px;z-index:50}
@media(max-width:680px){
  .site-head{padding-right:58px}
  #cmc-back-btn{font-size:0;padding:9px;gap:0;top:10px;right:10px}
  #cmc-back-btn svg{width:15px;height:15px}
}
/* The underwater background uses fixed layers that intentionally bleed past
   the edges. overflow-x:clip stops sideways scroll WITHOUT creating a scroll
   container, so the sticky toolbars of the three homeworks keep working. */
html,body{overflow-x:clip}
/* Name/date fields stay readable on the white hero boxes — pinned so a later
   generic input rule can never flip them again. */
.meta input{color:var(--ink)!important;caret-color:var(--ink)!important;font-weight:600}
.meta input::placeholder{color:#93a8ab;opacity:1;font-weight:600}
.meta input:-webkit-autofill{-webkit-text-fill-color:var(--ink);
  -webkit-box-shadow:0 0 0 1000px #fff inset;transition:background-color 99999s}
/* Teacher preview banner (teacher + at least one homework still unshared) */
#hwBanner{display:none;position:relative;z-index:1;max-width:950px;margin:calc(var(--head) + 16px) auto -6px;
  background:rgba(255,179,0,.12);border:1px solid rgba(255,179,0,.45);color:#ffd54f;
  border-radius:12px;padding:10px 16px;font-size:13px;line-height:1.55;font-family:'Outfit',system-ui,sans-serif}
html.hw-teacher-locked #hwBanner{display:block}
/* Bottom action bar: Submit to Teacher + Share */
.hw-bar{position:fixed;left:0;right:0;bottom:0;z-index:50;background:rgba(3,20,24,.94);
  backdrop-filter:blur(8px);border-top:1px solid rgba(45,212,191,.25);
  padding:12px 16px;display:flex;gap:12px;justify-content:center;align-items:center;flex-wrap:wrap}
.hw-btn{border:none;border-radius:999px;padding:11px 24px;font:inherit;font-weight:700;font-size:14px;
  cursor:pointer;transition:.18s}
.hw-btn:hover{filter:brightness(1.15);transform:translateY(-1px)}
.hw-btn-submit{background:linear-gradient(90deg,#4fb060,#2f7d43);color:#fff}
.hw-btn-submit:disabled{opacity:.7;cursor:progress;filter:none}
.hw-btn-submit.done{background:linear-gradient(90deg,#2c6b39,#4fb060)}
.hw-btn-ghost{background:transparent;border:2px solid rgba(184,212,216,.5);color:#cfe9e9}
.hw-btn-ghost:hover{border-color:#fff}
.assignment{padding-bottom:130px!important}
.needs-name{animation:needPulse 1.8s ease}
@keyframes needPulse{0%,100%{box-shadow:none}25%,75%{box-shadow:0 0 0 4px rgba(63,168,96,.35);border-color:#e05252}}
.cmc-toast{position:fixed;left:50%;bottom:88px;transform:translateX(-50%) translateY(14px);
  z-index:70;background:#fff;border:2px solid #2f7d43;color:#2c6b39;
  padding:10px 18px;border-radius:999px;font-weight:700;font-size:13.5px;font-family:'Outfit',system-ui,sans-serif;
  box-shadow:0 12px 30px rgba(0,0,0,.4);opacity:0;pointer-events:none;transition:all .3s;
  max-width:88vw;text-align:center}
.cmc-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
.cmc-toast.err{border-color:var(--bad);color:var(--bad)}
.cmc-share{position:fixed;left:50%;bottom:88px;transform:translateX(-50%);z-index:70;
  background:#fff;border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.5);
  padding:14px 16px;display:none;gap:8px;flex-wrap:wrap;justify-content:center;
  align-items:center;max-width:92vw}
.cmc-share.open{display:flex}
.cmc-share button{border:2px solid #cfd8dc;background:#fff;border-radius:999px;
  padding:8px 14px;font:inherit;font-weight:700;cursor:pointer;color:var(--ink)}
.cmc-share button:hover{border-color:#0e7c86;color:#0e7c86}
.cmc-share .close{border-color:transparent;color:#607d8b}
/* ── Share gate: each homework opens only when the teacher shares it ── */
.tabs .tab[hidden]{display:none!important}
html.hw-pending body>*:not(#hwGate){display:none!important}
html.hw-pending body{overflow:hidden!important}
#hwGate{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;
  padding:20px;background:linear-gradient(178deg,#03191d,#062a31 55%,#0a444b)}
#hwGate .hw-gate-card{max-width:430px;width:100%;text-align:center;background:#f6fdfc;color:#1c3231;
  border-radius:18px;padding:34px 28px;border-top:6px solid #2dd4bf;box-shadow:0 30px 80px rgba(0,0,0,.55)}
#hwGate .hw-gate-icon{width:58px;height:58px;margin:0 auto;border-radius:16px;display:grid;place-items:center;
  font-size:26px;background:linear-gradient(135deg,#0e7c86,#2dd4bf);color:#04241f}
#hwGate h1{font-family:'Fraunces',Georgia,serif;font-size:23px;margin:16px 0 0}
#hwGate p{font-size:13.5px;line-height:1.65;color:#4f6467;margin:12px auto 0;max-width:340px}
#hwGate .hw-gate-actions{display:flex;flex-wrap:wrap;gap:10px;justify-content:center}
#hwGate a{display:inline-flex;margin-top:20px;padding:12px 22px;border-radius:999px;text-decoration:none;
  background:linear-gradient(90deg,#0e7c86,#2dd4bf);color:#04241f;font-weight:700;font-size:13px}
#hwGate button#hwGateCheck{display:inline-flex;margin-top:20px;padding:12px 22px;border-radius:999px;cursor:pointer;
  border:2px solid #0e7c86;background:#fff;color:#0e7c86;font-weight:700;font-size:13px;font-family:inherit}
#hwGate button#hwGateCheck:hover{background:#eaf7f6}
#hwGate button#hwGateCheck:disabled{opacity:.6;cursor:wait}
@media print{
  .hw-bar,#cmc-back-btn,#hwBanner,.cmc-share,.cmc-toast,#hwGate{display:none!important}
}
</style>
"""

# ── 2. Share-gate script (runs BEFORE first paint, adapted to .tab) ──────
HEAD_GATE = """<script>
/* ── Kid 11 homework share gate — ONE switch per homework ────────────────
   Unit 14 · Doctor Fish ships as the teacher's 3-homework file. Each of the
   three homeworks is gated by its own Firestore doc (biweekly_tests/
   hw-kid11-u14-hw1|2|3 — public read, teacher-only write, same collection
   the bi-weekly tests use, so NO rules change):
     · students see ONLY the homeworks the teacher has shared — the other
       tabs do not exist for them (hidden, not merely locked);
     · no homework shared → a full-page locked overlay;
     · teachers (same heuristic as teacher-gate.js / RoleGate) always get in
       with a preview banner, and can preview any homework by deep link;
     · a deep link to an unshared homework (#hw-b) falls back to the first
       shared one instead of revealing content;
   The gate RE-CHECKS by itself — every 15s, on tab focus/visibility, and via
   a Check-again button — so sharing (or closing) a homework in another
   tab/device updates this page without a reload. */
(function () {
  'use strict';
  var FS = 'https://firestore.googleapis.com/v1/projects/creative-minds-cambodia/databases/(default)/documents/biweekly_tests/';
  var HW_DOCS = [
    { mode: 'a', doc: 'hw-kid11-u14-hw1' },
    { mode: 'b', doc: 'hw-kid11-u14-hw2' },
    { mode: 'c', doc: 'hw-kid11-u14-hw3' }
  ];
  var known = { a: null, b: null, c: null }; // null = share state not read yet
  function ls(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function isTeacher() {
    if (!ls('cmc-student-token')) return false;
    var role = ls('cmc-student-role');
    var email = ls('cmc-student-email').toLowerCase();
    var uid = ls('cmc-student-uid');
    return role === 'teacher' || email.indexOf('edu') !== -1 || uid === '5iLvnjzmV8QY7WFZhyTq6PIgcI63';
  }
  // Lock BEFORE first paint for everyone who is not a teacher — applyState()
  // below lifts it (at least one homework shared) or builds the overlay.
  window.CMC_HW_TEACHER = isTeacher();
  if (!window.CMC_HW_TEACHER) document.documentElement.classList.add('hw-pending');

  function buildGate() {
    if (document.getElementById('hwGate')) return;
    var g = document.createElement('div');
    g.id = 'hwGate';
    g.setAttribute('role', 'dialog');
    g.setAttribute('aria-modal', 'true');
    g.setAttribute('aria-label', 'Homework not shared yet');
    g.innerHTML =
      '<div class="hw-gate-card">' +
      '<div class="hw-gate-icon" aria-hidden="true">🔒</div>' +
      '<h1>Homework not shared yet</h1>' +
      '<p>Your teacher hasn\\u2019t opened the <b>Unit 14 homework</b> (Doctor Fish) for the class yet. ' +
      'Ask your teacher to share it from the <b>Kid 11 card</b> on the CMC homepage — this page unlocks by itself, no refresh needed.</p>' +
      '<div class="hw-gate-actions">' +
      '<button type="button" id="hwGateCheck">Check again</button>' +
      '<a href="https://cmckhmer.github.io/Creative-Minds-/">Back to CMC home</a>' +
      '</div>' +
      '</div>';
    document.body.appendChild(g);
    var btn = document.getElementById('hwGateCheck');
    if (btn) btn.addEventListener('click', function () {
      btn.disabled = true; btn.textContent = 'Checking…';
      check();
      window.setTimeout(function () { btn.disabled = false; btn.textContent = 'Check again'; }, 1200);
    });
  }

  function dropGate() {
    var g = document.getElementById('hwGate');
    if (g) g.remove();
  }

  // Students only get tab buttons for homeworks the teacher has shared —
  // the unshared ones are hidden entirely (owner request), never shown locked.
  function setTabs() {
    var teacher = window.CMC_HW_TEACHER;
    HW_DOCS.forEach(function (h) {
      var btn = document.querySelector('.tab[data-mode="' + h.mode + '"]');
      if (btn) btn.hidden = !teacher && known[h.mode] !== true;
    });
  }

  function firstSharedMode() {
    for (var i = 0; i < HW_DOCS.length; i++) {
      if (known[HW_DOCS[i].mode] === true) return HW_DOCS[i].mode;
    }
    return null;
  }
  function hwSetMode(m) {
    if (typeof window.CMC_HW_SETMODE === 'function') window.CMC_HW_SETMODE(m);
  }

  function applyState() {
    var root = document.documentElement;
    // Re-read the teacher heuristic EVERY check — the session may appear
    // after this page loaded (sign-in in another tab, token refresh).
    window.CMC_HW_TEACHER = isTeacher();
    var want = (location.hash.match(/^#hw-([abc])$/) || [])[1] || '';
    if (window.CMC_HW_TEACHER) {
      root.classList.remove('hw-pending');
      root.classList.toggle('hw-teacher-locked', !(known.a === true && known.b === true && known.c === true));
      dropGate();
      setTabs();
      if (want) hwSetMode(want); // teachers may preview any homework
      return;
    }
    var anyShared = known.a === true || known.b === true || known.c === true;
    if (anyShared) {
      root.classList.remove('hw-pending', 'hw-teacher-locked');
      root.classList.add('hw-open');
      dropGate();
      setTabs();
      var m = document.body.getAttribute('data-mode') || 'a';
      if (want && known[want] === true) {
        if (want !== m) hwSetMode(want);
      } else if (known[m] !== true) {
        var f = firstSharedMode();
        if (f && f !== m) hwSetMode(f);
      }
    } else {
      // Everything closed again (or still nothing shared) → full lock.
      root.classList.remove('hw-open', 'hw-teacher-locked');
      root.classList.add('hw-pending');
      buildGate();
    }
  }

  function shareState(d) {
    return !!(d && d.fields && d.fields.shared && d.fields.shared.booleanValue === true);
  }

  var checking = false;
  function check() {
    if (checking) return;
    checking = true;
    // Each doc settles INDEPENDENTLY — one slow/failed read must never hold
    // the other homeworks' state hostage. The checking flag releases as soon
    // as this round's docs have settled, with a fixed timer as hang safety
    // so a hanging request can never stop future re-checks.
    var pending = HW_DOCS.length;
    function done() { pending--; if (pending <= 0) checking = false; }
    window.setTimeout(function () { checking = false; }, 8000);
    HW_DOCS.forEach(function (h) {
      function settle(v) {
        // A network blip must not re-lock a homework the student already
        // saw open — keep the last known state; only the very first read
        // fails closed (locked) so a blip can never open the homework.
        if (v === null) { if (known[h.mode] === null) known[h.mode] = false; }
        else known[h.mode] = v;
        applyState();
        done();
      }
      fetch(FS + h.doc)
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { settle(shareState(d)); })
        .catch(function () { settle(null); });
    });
  }

  function startPolling() {
    window.setInterval(check, 15000);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') check();
    });
    window.addEventListener('focus', check);
    window.addEventListener('pageshow', check);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { check(); startPolling(); });
  } else {
    check();
    startPolling();
  }
})();
</script>
"""

# ── 3. Body top: back pill + teacher preview banner ─────────────────────
BODY_TOP = """
<!-- Back to CMC home (same fixture as the other Reading Future worksheets) -->
<a id="cmc-back-btn" href="https://cmckhmer.github.io/Creative-Minds-/" target="_self" rel="noopener noreferrer" aria-label="Back to CMC home">
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M19 12H5m0 0 6 6m-6-6 6-6" stroke="#2dd4bf" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
  Back to CMC
</a>

<!-- Teacher preview banner (only shown to a teacher while at least one homework is still locked) -->
<div id="hwBanner">👩‍🏫 <b>Teacher preview</b> — homeworks you haven't shared stay invisible to students. Flip the <b>Share with students</b> switches on the Kid&nbsp;11 card (CMC homepage, Kid Program section) to open Homework 1, 2 or 3 for the class.</div>
"""

# ── 4. Bottom action bar + toast + share panel ──────────────────────────
BODY_BAR = """
<!-- Bottom action bar: completion submit + share -->
<div class="hw-bar no-print">
  <button type="button" class="hw-btn hw-btn-submit" id="submitBtn">Submit to Teacher ✓</button>
  <button type="button" class="hw-btn hw-btn-ghost" data-cmc-share aria-haspopup="true">Share homework ▾</button>
</div>
<div class="cmc-toast" id="cmcToast" role="status" aria-live="polite"></div>
<div class="cmc-share" id="cmcShare">
  <button type="button" data-cmc-copy>🔗 Copy Link</button>
  <button type="button" data-cmc-wa>💬 WhatsApp</button>
  <button type="button" data-cmc-tg>✈️ Telegram</button>
  <button type="button" data-cmc-email>✉️ Email</button>
  <button type="button" class="close" data-cmc-close>✕ Close</button>
</div>
"""

# ── 5. Completion submit + share plumbing (Unit 14 payload names) ───────
SUBMIT_SCRIPT = """<script>
/* ── Kid 11 online homework: hero name/date sync + completion submit + share ──
   Name and date typed in any homework hero mirror into the other two, so a
   student who does Homework 1 today and Homework 2 tomorrow keeps their
   details. Submit-to-Teacher reuses the site-wide drill_attempts pipeline:
   signed-in students post under their own localStorage session token (with
   securetoken refresh), visitors through the validated guest branch (empty
   studentUid, 1-40 char name, classId null) — append-only, no rules change,
   lands in the teacher dashboard feed and the homepage ticker. The payload
   names the ACTIVE homework (1 Spa Intake File / 2 Treatment Analyst /
   3 Health Writer) so the teacher can tell the three apart. */

(function () {
  var CMC_FS = 'https://firestore.googleapis.com/v1/projects/creative-minds-cambodia/databases/(default)/documents/drill_attempts';
  var CMC_API_KEY = 'AIzaSyDNUq0ru99XKh08D887Xk63h36MPOlXWwc';

  /* ── An email is NEVER a display name ───────────────────────────────
     Owner report: "students that sign in with their gmail are not showing
     names on the completion ticker" — Google sign-ins can return an empty
     displayName and the old auth fallback stored the EMAIL as the name, so
     submissions carried e.g. "mam.ry@aii.edu.kh". Heals a stored
     email-as-name once at load and guards every outgoing name ("mam.ry@…"
     → "Mam Ry"). A real typed name is never touched. */
  function cmcLooksLikeEmail(v) {
    return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(String(v || '').trim());
  }
  function cmcFriendlyFromEmail(email) {
    var local = String(email || '').split('@')[0].trim();
    if (!local) return '';
    var words = local.split(/[._+\\-]+/).map(function (w) { return w.trim(); }).filter(Boolean);
    if (!words.length) return local.slice(0, 40);
    return words.map(function (w) { return (w.charAt(0).toUpperCase() + w.slice(1)).slice(0, 40); }).join(' ').trim().slice(0, 40);
  }
  function cmcNameOf(v) {
    var s = String(v || '').trim();
    if (!s || !cmcLooksLikeEmail(s)) return s;
    return cmcFriendlyFromEmail(s) || s;
  }
  (function () {
    try {
      var stored = localStorage.getItem('cmc-student-name') || '';
      if (!cmcLooksLikeEmail(stored)) return;
      var healed = cmcFriendlyFromEmail(stored);
      if (healed) localStorage.setItem('cmc-student-name', healed);
      else localStorage.removeItem('cmc-student-name');
    } catch (e) { /* private mode — nothing to heal */ }
  })();


  var HW_LABELS = {
    a: 'Homework 1 · Spa Intake File',
    b: 'Homework 2 · Treatment Analyst',
    c: 'Homework 3 · Health Writer'
  };

  function cmcToast(msg, err) {
    var t = document.getElementById('cmcToast');
    t.textContent = msg;
    t.classList.toggle('err', !!err);
    t.classList.add('show');
    clearTimeout(cmcToast._tm);
    cmcToast._tm = setTimeout(function () { t.classList.remove('show'); }, 3600);
  }

  function cmcSession() {
    var tok = '', uid = '', name = '';
    try {
      tok = localStorage.getItem('cmc-student-token') || '';
      uid = localStorage.getItem('cmc-student-uid') || '';
      name = localStorage.getItem('cmc-student-name') || '';
    } catch (e) {}
    return { tok: tok, uid: uid, name: cmcNameOf(name), authed: !!(tok && uid) };
  }

  // Mirror the Name/Date typed in any hero into every other hero (same role
  // by aria-label), and prefill the Name for signed-in students.
  function cmcSyncNameDate(from) {
    var name = '', date = '';
    document.querySelectorAll('.assignment .meta input').forEach(function (inp) {
      var label = (inp.getAttribute('aria-label') || '').toLowerCase();
      if (label.indexOf('date') !== -1) { if (inp.value) date = inp.value; }
      else { if (inp.value) name = inp.value; }
    });
    if (from) {
      var fl = (from.getAttribute('aria-label') || '').toLowerCase();
      if (fl.indexOf('date') !== -1) date = from.value; else name = from.value;
    }
    document.querySelectorAll('.assignment .meta input').forEach(function (inp) {
      if (inp === from) return;
      var label = (inp.getAttribute('aria-label') || '').toLowerCase();
      if (label.indexOf('date') !== -1) { if (date) inp.value = date; }
      else { if (name) inp.value = name; }
    });
  }
  document.querySelectorAll('.assignment .meta input').forEach(function (inp) {
    inp.addEventListener('input', function () { cmcSyncNameDate(inp); });
  });
  try {
    var pre = cmcNameOf(localStorage.getItem('cmc-student-name'));
    if (pre) {
      document.querySelectorAll('.assignment .meta input').forEach(function (inp) {
        if (((inp.getAttribute('aria-label') || '').toLowerCase().indexOf('date')) === -1) inp.value = pre.slice(0, 40);
      });
    }
  } catch (e) {}

  function cmcRefreshToken(cb) {
    // Same securetoken grant flow as the rfc2/rfc3 worksheets and cmc-shared.js.
    try {
      var rt = localStorage.getItem('cmc-student-refresh-token');
      if (!rt) return cb(null);
      fetch('https://securetoken.googleapis.com/v1/token?key=' + CMC_API_KEY, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(rt)
      }).then(function (r) { return r.json(); }).then(function (d) {
        if (d && d.id_token) {
          try {
            localStorage.setItem('cmc-student-token', d.id_token);
            localStorage.setItem('cmc-student-token-expires', String(Date.now() + ((Number(d.expires_in) || 3600) * 1000) - 60000));
            if (d.refresh_token) localStorage.setItem('cmc-student-refresh-token', d.refresh_token);
          } catch (e) {}
          cb(d.id_token);
        } else cb(null);
      }).catch(function () { cb(null); });
    } catch (e) { cb(null); }
  }

  function cmcPost(body, token) {
    var h = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = 'Bearer ' + token;
    return fetch(CMC_FS, { method: 'POST', headers: h, body: JSON.stringify({ fields: body }) });
  }

  function cmcActiveRoot() {
    return document.getElementById('hw-' + (document.body.getAttribute('data-mode') || 'a'));
  }

  function cmcActiveNameInput(root) {
    // The heroes keep the teacher's markup order: name first, date second.
    var inputs = root.querySelectorAll('.meta input');
    for (var i = 0; i < inputs.length; i++) {
      if (((inputs[i].getAttribute('aria-label') || '').toLowerCase().indexOf('date')) === -1) return inputs[i];
    }
    return inputs[0] || null;
  }

  function cmcCurrentScore(root) {
    // Reuse the homework's own grading — the score line reads "E / T points".
    var line = root.querySelector('.score-line');
    var panel = root.querySelector('.results');
    var m = line && /^(\\d+) \\/ (\\d+) points$/.exec((line.textContent || '').trim());
    if (!(panel && !panel.hidden && m)) { if (window.CMC_HW_GRADE) window.CMC_HW_GRADE(root); }
    var txt = (root.querySelector('.score-line').textContent || '').trim();
    var m2 = /^(\\d+) \\/ (\\d+) points$/.exec(txt);
    return { correct: m2 ? Number(m2[1]) : 0, total: m2 ? Number(m2[2]) : 0 };
  }

  function cmcBuildBody(name, uid, score, mode) {
    // Field set matches the drill_attempts rules: guest branch requires
    // studentUid == '', name 1-40 chars, ints in range, classId null.
    var pct = score.total > 0 ? Math.round(score.correct / score.total * 100) : 0;
    return {
      drillSlug:   { stringValue: 'doctor-fish.html' },
      drillTitle:  { stringValue: 'Unit 14 · Doctor Fish — ' + (HW_LABELS[mode] || HW_LABELS.a) },
      drillSource: { stringValue: 'rfc3' },
      studentName: { stringValue: name },
      studentUid:  { stringValue: uid },
      scorePct:      { integerValue: String(pct) },
      correctCount:  { integerValue: String(score.correct) },
      totalCount:    { integerValue: String(score.total) },
      classId:       { nullValue: null },
      submittedAt:   { timestampValue: new Date().toISOString() }
    };
  }

  function submitCompletion() {
    var btn = document.getElementById('submitBtn');
    var root = cmcActiveRoot();
    var mode = document.body.getAttribute('data-mode') || 'a';
    var nameEl = cmcActiveNameInput(root);

    var sess = cmcSession();
    var name = cmcNameOf((((nameEl && nameEl.value) || '').trim() || sess.name).slice(0, 40));
    if (!name) {
      cmcToast('Add your name first — your teacher needs to know who finished the homework.', true);
      btn.textContent = '⚠ Add your name first';
      setTimeout(function () { btn.textContent = 'Submit to Teacher ✓'; }, 2600);
      if (nameEl) {
        nameEl.focus();
        nameEl.classList.add('needs-name');
        setTimeout(function () { nameEl.classList.remove('needs-name'); }, 1900);
      }
      var hero = root.querySelector('.hero');
      if (hero) hero.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    btn.disabled = true;
    btn.classList.remove('done');
    btn.textContent = 'Submitting…';
    var score = cmcCurrentScore(root);
    var body = cmcBuildBody(name, sess.authed ? sess.uid : '', score, mode);
    var okMsg = '✓ Submitted! ' + name + ' — ' + score.correct + '/' + score.total + ' sent to your teacher.';

    var done = function (ok, msg) {
      btn.disabled = false;
      btn.classList.toggle('done', ok);
      btn.textContent = ok ? '✓ Submitted to teacher' : '⚠ Try again';
      cmcToast(msg, !ok);
      setTimeout(function () { btn.textContent = 'Submit to Teacher ✓'; }, 4200);
    };

    cmcPost(body, sess.authed ? sess.tok : '')
      .then(function (r) {
        if (r.ok) return done(true, okMsg);
        if (r.status === 401 && sess.authed) {
          cmcRefreshToken(function (t) {
            if (t) {
              cmcPost(body, t).then(function (r2) { done(r2.ok, okMsg); })
                .catch(function () { done(false, 'Could not submit — check your connection and try again.'); });
            } else {
              // Session unrecoverable → validated guest branch.
              cmcPost(cmcBuildBody(name, '', score, mode), '')
                .then(function (r3) { done(r3.ok, okMsg); })
                .catch(function () { done(false, 'Could not submit — check your connection and try again.'); });
            }
          });
          return;
        }
        // Permission or server error → guest branch fallback (uid must be '').
        cmcPost(cmcBuildBody(name, '', score, mode), '')
          .then(function (r3) { done(r3.ok, okMsg); })
          .catch(function () { done(false, 'Could not submit — check your connection and try again.'); });
      })
      .catch(function () { done(false, 'Could not reach the teacher console — check your connection and try again.'); });
  }
  document.getElementById('submitBtn').addEventListener('click', submitCompletion);

  /* ── Share (native sheet when available, fallback options otherwise) ── */
  function cmcHomeworkUrl() {
    return location.origin === 'null'
      ? 'https://cmckhmer.github.io/Creative-Minds-/rfc3/doctor-fish.html'
      : location.href.split('#')[0];
  }
  function cmcShareText() {
    return 'Kid 11 Online Homework — Unit 14 · Doctor Fish · Homeworks 1–3 (auto-graded)';
  }
  function cmcToggleShare(force) {
    var p = document.getElementById('cmcShare');
    var open = typeof force === 'boolean' ? force : !p.classList.contains('open');
    p.classList.toggle('open', open);
  }
  document.addEventListener('click', function (e) {
    var p = document.getElementById('cmcShare');
    if (p.classList.contains('open') && !p.contains(e.target) && !e.target.closest('[data-cmc-share]')) cmcToggleShare(false);
  });
  function cmcNativeShare() {
    if (navigator.share) {
      navigator.share({ title: 'Unit 14 · Doctor Fish', text: cmcShareText(), url: cmcHomeworkUrl() }).catch(function () {});
      return true;
    }
    return false;
  }
  document.querySelector('[data-cmc-share]').addEventListener('click', function () { if (!cmcNativeShare()) cmcToggleShare(); });
  function cmcCopyLink() {
    var url = cmcHomeworkUrl();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { cmcToast('Homework link copied — paste it into your class chat'); });
    } else {
      var t = document.createElement('textarea'); t.value = url; document.body.appendChild(t);
      t.select(); document.execCommand('copy'); t.remove();
      cmcToast('Homework link copied — paste it into your class chat');
    }
    cmcToggleShare(false);
  }
  document.querySelector('[data-cmc-copy]').addEventListener('click', cmcCopyLink);
  document.querySelector('[data-cmc-wa]').addEventListener('click', function () {
    window.open('https://wa.me/?text=' + encodeURIComponent(cmcShareText() + ' ' + cmcHomeworkUrl()), '_blank', 'noopener'); cmcToggleShare(false);
  });
  document.querySelector('[data-cmc-tg]').addEventListener('click', function () {
    window.open('https://t.me/share/url?url=' + encodeURIComponent(cmcHomeworkUrl()) + '&text=' + encodeURIComponent(cmcShareText()), '_blank', 'noopener'); cmcToggleShare(false);
  });
  document.querySelector('[data-cmc-email]').addEventListener('click', function () {
    location.href = 'mailto:?subject=' + encodeURIComponent('Unit 14 · Doctor Fish — Kid 11 Online Homework') + '&body=' + encodeURIComponent(cmcShareText() + '\\n' + cmcHomeworkUrl());
    cmcToggleShare(false);
  });
  document.querySelector('[data-cmc-close]').addEventListener('click', function () { cmcToggleShare(false); });
})();
</script>
"""

# ── assemble ─────────────────────────────────────────────────────────────
assert html.count('</head>') == 1
html = html.replace('</head>', HEAD_CSS + HEAD_GATE + '</head>', 1)

assert html.count('<body data-mode="a">') == 1
html = html.replace('<body data-mode="a">', '<body data-mode="a">' + BODY_TOP, 1)

assert html.count('<noscript>') == 1
html = html.replace('<noscript>', BODY_BAR + '\n<noscript>', 1)

# expose the engine's setMode/grade to the gate + submit plumbing
old_setmode = """function setMode(m){
 document.body.setAttribute('data-mode',m);
 $$('.assignment').forEach(function(a){a.hidden=a.id!=='hw-'+m;});
 window.scrollTo({top:0,behavior:'smooth'});
}"""
new_setmode = old_setmode + """
window.CMC_HW_SETMODE=setMode;window.CMC_HW_GRADE=grade;"""
assert old_setmode in html
html = html.replace(old_setmode, new_setmode, 1)

assert html.count("setMode('a');") == 1
html = html.replace("setMode('a');", "if(!/#hw-[abc]/.test(location.hash))setMode('a');", 1)

assert html.count('</body>') == 1
html = html.replace('</body>', SUBMIT_SCRIPT + '\n</body>', 1)

# page metadata: title matches the 3-homework file
html = html.replace(
    '<title>Unit 14 · Doctor Fish · Homeworks 1–3</title>',
    '<title>Unit 14 · Doctor Fish — Kid 11 Online Homework (Homeworks 1–3)</title>', 1)

OUT.write_text(html, encoding='utf-8')
print(f'wrote {OUT} ({len(html)} bytes, {html.count(chr(10))} lines)')
print('graded keys:', len(re.findall(r'data-(?:answer|correct|solution)="', html)))
print('gate docs:', re.findall(r"doc: '(hw-kid11-u14-hw[123])'", html))
print('labels:', re.findall(r"(Homework [123] · [A-Za-z ]+)'", html)[:3])
