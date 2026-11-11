#!/usr/bin/env python3
"""Build public/rfc3/doctor-fish.html from the teacher's drfish.html.

Owner requests (Nov 2026):
  1. "the name date area text cant be seen"   -> hero name/date inputs fixed
     (the generic `input[type=text]` rule landed AFTER `.meta input` and won
     the cascade, leaving white text on the white background the same rule
     painted). The new hero uses .hw-meta with !important + autofill fix.
  2. "the html file goes with this units homework and should be attached to
     the first" -> the teacher's newest file (drfish.html, Home Assignments
     1 & 2) IS the worksheet of the first online homework (Doctor Fish).
     Its content is injected VERBATIM — verified by an attribute-sequence
     equality check at the end of this script.
  3. "can only be done if teacher shares the home" -> a share gate: the page
     reads biweekly_tests/hw-kid11-doctor-fish (public read, teacher-only
     write — no rules change). Not shared => students get a locked overlay;
     teachers (site role heuristic) always get in plus a preview banner.
     The matching "Share with students" switch lives on the Kid 11 card.

Everything between the teacher's <style> and his closing </script> stays
1:1; the site furniture (back-to-CMC, purple homework hero, bottom bar,
share menu, toast, gate) is namespaced hw-* / cmc-* so nothing collides.
"""
import re, sys

SRC = '/home/z/my-project/upload/drfish.html'
OUT = '/home/z/my-project/tmp/cmc-site/public/rfc3/doctor-fish.html'

html = open(SRC, encoding='utf-8').read()

# ── 1. title ─────────────────────────────────────────────────────────────
html = html.replace(
    '<title>Doctor Fish · Home Assignments 1 & 2</title>',
    '<title>Unit 14 · Doctor Fish — Kid 11 Online Homework (Home Assignments 1 &amp; 2)</title>', 1)
html = html.replace(
    '<title>Doctor Fish · Home Assignments 1 &amp; 2</title>',
    '<title>Unit 14 · Doctor Fish — Kid 11 Online Homework (Home Assignments 1 &amp; 2)</title>', 1)
assert 'Kid 11 Online Homework' in html, 'title swap failed'

HW_CSS = r'''
  /* ── CMC site furniture (Kid 11 online homework) — namespaced hw-/cmc- ── */
  #cmc-back-btn{position:fixed;top:14px;right:14px;z-index:60;display:flex;align-items:center;
    gap:8px;padding:9px 16px;border-radius:999px;background:rgba(6,30,38,.88);
    border:1px solid rgba(125,211,252,.4);color:#bae6fd;font-family:'Space Grotesk',system-ui,sans-serif;
    font-size:13px;font-weight:700;text-decoration:none;box-shadow:0 8px 24px rgba(0,0,0,.35);transition:.2s}
  #cmc-back-btn:hover{background:rgba(125,211,252,.14);transform:translateY(-1px)}
  /* the fixed worksheet header owns the top edge — leave room for the back pill */
  .site-head{padding-right:180px}
  @media(max-width:680px){
    .site-head{padding-right:64px}
    #cmc-back-btn{font-size:0;padding:9px;gap:0;top:10px;right:10px}
    #cmc-back-btn svg{width:15px;height:15px}
    .hw-hero{padding:22px 18px}.hw-meta input{min-width:0;flex:1 1 140px}
  }
  /* The teacher's living background uses fixed glows that intentionally bleed
     past the right edge (right:-12vw). `overflow-x:clip` stops the sideways
     scroll WITHOUT creating a scroll container, so the sticky toolbars of the
     two assignments keep working (overflow-x:hidden would break them). */
  html,body{overflow-x:clip}

  /* Purple online-homework hero — the name/date bug fix lives here:
     !important beats the later generic input[type=text] rule that used to
     paint these boxes white while .hw-meta kept the white text. */
  .hw-hero{position:relative;z-index:1;max-width:920px;margin:calc(var(--head) + 16px) auto 18px;
    background:linear-gradient(120deg,#7b1fa2,#c2185b);color:#fff;border-radius:20px;
    padding:26px 28px 24px;box-shadow:0 18px 50px rgba(0,0,0,.45);overflow:hidden}
  .hw-hero::before{content:"";position:absolute;inset:0 0 auto 0;height:6px;
    background:linear-gradient(90deg,#ffb300,#e91e63,#00c2d1)}
  .hw-badge{display:inline-block;background:rgba(255,255,255,.22);padding:5px 14px;
    border-radius:999px;font-size:11px;letter-spacing:2px;font-weight:700;margin:0 8px 8px 0}
  .hw-hero h1{font-family:'Fraunces',Georgia,serif;font-size:clamp(30px,5vw,46px);line-height:1.05;margin:2px 0 8px}
  .hw-hero .hw-sub{font-size:14px;line-height:1.55;color:rgba(255,255,255,.92);margin-bottom:4px}
  .hw-meta{display:flex;gap:12px;margin-top:16px;flex-wrap:wrap}
  .hw-meta input{background:rgba(255,255,255,.16)!important;border:2px solid rgba(255,255,255,.5)!important;
    color:#fff!important;caret-color:#fff;border-radius:10px;padding:10px 14px;font:inherit;
    font-weight:600;letter-spacing:.3px;min-width:200px}
  .hw-meta input::placeholder{color:rgba(255,255,255,.85);font-weight:500}
  .hw-meta input:focus{outline:none;border-color:#fff!important;background:rgba(255,255,255,.26)!important}
  .hw-meta input:-webkit-autofill{-webkit-text-fill-color:#fff;
    -webkit-box-shadow:0 0 0 1000px rgba(123,31,162,.55) inset;transition:background-color 99999s}
  @media(max-width:680px){.hw-hero{padding:22px 18px}.hw-meta input{min-width:0;flex:1 1 140px}}

  /* Teacher preview banner (teacher + homework not shared) */
  #hwBanner{display:none;position:relative;z-index:1;max-width:920px;margin:calc(var(--head) + 16px) auto -6px;
    background:rgba(255,179,0,.12);border:1px solid rgba(255,179,0,.45);color:#ffd54f;
    border-radius:12px;padding:10px 16px;font-size:13px;line-height:1.55}
  html.hw-teacher-locked #hwBanner{display:block}
  html.hw-teacher-locked .hw-hero{margin-top:14px}

  /* Bottom action bar: Submit to Teacher + Share */
  .hw-bar{position:fixed;left:0;right:0;bottom:0;z-index:50;background:rgba(6,30,38,.92);
    backdrop-filter:blur(8px);border-top:1px solid rgba(140,220,225,.18);
    padding:12px 16px;display:flex;gap:12px;justify-content:center;align-items:center;flex-wrap:wrap}
  .hw-btn{border:none;border-radius:999px;padding:11px 24px;font:inherit;font-weight:700;font-size:14px;
    cursor:pointer;transition:.18s}
  .hw-btn:hover{filter:brightness(1.15);transform:translateY(-1px)}
  .hw-btn-submit{background:linear-gradient(90deg,var(--ok),#00695c);color:#fff}
  .hw-btn-submit:disabled{opacity:.7;cursor:progress;filter:none}
  .hw-btn-submit.done{background:linear-gradient(90deg,#1b5e20,var(--ok))}
  .hw-btn-ghost{background:transparent;border:2px solid rgba(207,238,241,.5);color:#cfeef1}
  .hw-btn-ghost:hover{border-color:#fff}
  .assignment{padding-bottom:130px!important}

  .needs-name{animation:needPulse 1.8s ease}
  @keyframes needPulse{0%,100%{box-shadow:none}25%,75%{box-shadow:0 0 0 4px rgba(255,255,255,.3);border-color:#ffcdd2}}
  .cmc-toast{position:fixed;left:50%;bottom:88px;transform:translateX(-50%) translateY(14px);
    z-index:70;background:#fff;border:2px solid #7b1fa2;color:#7b1fa2;
    padding:10px 18px;border-radius:999px;font-weight:700;font-size:13.5px;font-family:'Space Grotesk',system-ui,sans-serif;
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
  .cmc-share button:hover{border-color:#7b1fa2;color:#7b1fa2}
  .cmc-share .close{border-color:transparent;color:#607d8b}

  /* ── Share gate: homework opens only when the teacher shares it ────── */
  html.hw-pending body>*:not(#hwGate){display:none!important}
  html.hw-pending body{overflow:hidden!important}
  #hwGate{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;
    padding:20px;background:linear-gradient(165deg,#051e26,#0a3540 55%,#0e4a52)}
  #hwGate .hw-gate-card{max-width:430px;width:100%;text-align:center;background:#fffdf6;color:#26313a;
    border-radius:18px;padding:34px 28px;border-top:6px solid #7b1fa2;box-shadow:0 30px 80px rgba(0,0,0,.55)}
  #hwGate .hw-gate-icon{width:58px;height:58px;margin:0 auto;border-radius:16px;display:grid;place-items:center;
    font-size:26px;background:linear-gradient(135deg,#7b1fa2,#c2185b);color:#fff}
  #hwGate h1{font-family:'Fraunces',Georgia,serif;font-size:23px;margin:16px 0 0}
  #hwGate p{font-size:13.5px;line-height:1.65;color:#45565f;margin:12px auto 0;max-width:340px}
  #hwGate a{display:inline-flex;margin-top:20px;padding:12px 22px;border-radius:999px;text-decoration:none;
    background:linear-gradient(90deg,#7b1fa2,#c2185b);color:#fff;font-weight:700;font-size:13px}

  @media print{
    .hw-bar,#cmc-back-btn,#hwBanner,.cmc-share,.cmc-toast,#hwGate{display:none!important}
    .assignment{padding-bottom:0!important}
  }
'''

# ── 2. inject furniture CSS before the teacher's closing </style> ────────
assert html.count('</style>') == 1, 'expected exactly one style block'
html = html.replace('</style>', HW_CSS + '</style>', 1)

# ── 3. gate script into <head> (runs before first paint) ────────────────
GATE_JS = r'''<script>
/* ── Kid 11 homework share gate ─────────────────────────────────────────
   Owner request: the homework "can only be done if teacher shares the home".
   The share state lives in Firestore at biweekly_tests/hw-kid11-doctor-fish
   (public read, teacher-only write — same collection the bi-weekly tests
   use, so NO rules change). Students see a locked overlay until the teacher
   flips the share switch on the Kid 11 card; teachers (same site role
   heuristic as teacher-gate.js / RoleGate) always get in, plus a preview
   banner while the homework is still locked for the class. */
(function () {
  'use strict';
  var HW_DOC = 'https://firestore.googleapis.com/v1/projects/creative-minds-cambodia/databases/(default)/documents/biweekly_tests/hw-kid11-doctor-fish';
  function ls(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function isTeacher() {
    if (!ls('cmc-student-token')) return false;
    var role = ls('cmc-student-role');
    var email = ls('cmc-student-email').toLowerCase();
    var uid = ls('cmc-student-uid');
    return role === 'teacher' || email.indexOf('edu') !== -1 || uid === '5iLvnjzmV8QY7WFZhyTq6PIgcI63';
  }
  window.CMC_HW_TEACHER = isTeacher();
  // Lock BEFORE first paint for everyone who is not a teacher — the
  // resolve() below lifts it (open) or builds the overlay (students).
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
      '<p>Your teacher hasn\u2019t opened <b>Doctor Fish · Home Assignments 1 &amp; 2</b> for the class yet. ' +
      'Ask your teacher to share it from the <b>Kid 11 card</b> on the CMC homepage — then this page unlocks automatically.</p>' +
      '<a href="https://cmckhmer.github.io/Creative-Minds-/">Back to CMC home</a>' +
      '</div>';
    document.body.appendChild(g);
  }

  function resolve(shared) {
    var root = document.documentElement;
    if (shared) {
      root.classList.remove('hw-pending');
      root.classList.add('hw-open');
    } else if (window.CMC_HW_TEACHER) {
      root.classList.remove('hw-pending');
      root.classList.add('hw-teacher-locked');
    } else {
      buildGate(); // keeps hw-pending: worksheet stays hidden behind the gate
    }
  }

  function shareState(d) {
    return !!(d && d.fields && d.fields.shared && d.fields.shared.booleanValue === true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      fetch(HW_DOC)
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { resolve(shareState(d)); })
        .catch(function () { resolve(false); });
    });
  } else {
    fetch(HW_DOC)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { resolve(shareState(d)); })
      .catch(function () { resolve(false); });
  }
})();
</script>
'''
html = html.replace('</head>', GATE_JS + '</head>', 1)

# ── 4. body prefix: back pill + teacher banner ───────────────────────────
BODY_PREFIX = r'''<!-- Back to CMC home (same fixture as the other Reading Future worksheets) -->
<a id="cmc-back-btn" href="https://cmckhmer.github.io/Creative-Minds-/" target="_self" rel="noopener noreferrer" aria-label="Back to CMC home">
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M19 12H5m0 0 6 6m-6-6 6-6" stroke="#bae6fd" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
  Back to CMC
</a>

<!-- Teacher preview banner (only shown to a teacher while the homework is locked) -->
<div id="hwBanner">👩‍🏫 <b>Teacher preview</b> — students can't open this homework yet. Flip the <b>Share with students</b> switch on the Kid&nbsp;11 card (CMC homepage, Kid Program section) to unlock it for the class.</div>

<!-- Purple online-homework hero — name/date inputs now fully readable -->
<header class="hw-hero">
  <span class="hw-badge">UNIT 14 · SCIENCE</span>
  <span class="hw-badge">KID 11 · ONLINE HOMEWORK</span>
  <h1>Doctor Fish 🐟</h1>
  <p class="hw-sub">Live Worksheet · Home Assignments 1 &amp; 2 · Reading, Writing &amp; Critical Thinking · auto-graded</p>
  <div class="hw-meta">
    <input type="text" id="stuName" placeholder="Name" autocomplete="name" maxlength="40" aria-label="Your name">
    <input type="text" id="stuDate" placeholder="Date" aria-label="Date">
  </div>
</header>
'''
html = html.replace('<body data-mode="a">', '<body data-mode="a">\n\n' + BODY_PREFIX, 1)
assert 'hw-hero' in html, 'hero injection failed'

# ── 5. bottom bar + toast + share menu before the main <script> ─────────
BAR = r'''<!-- Bottom bar: student completion submit + share (grading lives in each assignment toolbar) -->
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

'''
html = html.replace('<noscript>', BAR + '<noscript>', 1)
assert 'submitBtn' in html, 'bar injection failed'

# ── 6. furniture JS appended inside the teacher's <script> ──────────────
FURNITURE_JS = r'''
/* ── Kid 11 online homework: hero name/date sync + completion submit + share ──
   Name and date typed in the purple hero flow into both assignment sheets
   (Reporter name / Advisor name + Date). Submit-to-Teacher reuses the
   site-wide drill_attempts pipeline: signed-in students post under their own
   localStorage session token (with securetoken refresh), visitors through
   the validated guest branch (empty studentUid, 1-40 char name, classId
   null) — append-only, no rules change, lands in the teacher dashboard
   feed and the homepage ticker. */

(function () {
  var CMC_FS = 'https://firestore.googleapis.com/v1/projects/creative-minds-cambodia/databases/(default)/documents/drill_attempts';
  var CMC_API_KEY = 'AIzaSyDNUq0ru99XKh08D887Xk63h36MPOlXWwc';

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
    return { tok: tok, uid: uid, name: name, authed: !!(tok && uid) };
  }

  // Pre-fill the hero Name for signed-in students; mirror hero → sheets.
  function cmcSyncNameDate() {
    var n = document.getElementById('stuName').value;
    var d = document.getElementById('stuDate').value;
    document.querySelectorAll('.assignment .meta input').forEach(function (inp) {
      var label = (inp.getAttribute('aria-label') || '').toLowerCase();
      if (label.indexOf('date') !== -1) { if (d) inp.value = d; }
      else { if (n) inp.value = n; }
    });
  }
  document.getElementById('stuName').addEventListener('input', cmcSyncNameDate);
  document.getElementById('stuDate').addEventListener('input', cmcSyncNameDate);
  try {
    var pre = (localStorage.getItem('cmc-student-name') || '').trim();
    if (pre) document.getElementById('stuName').value = pre.slice(0, 40);
  } catch (e) {}
  cmcSyncNameDate();

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
    return document.getElementById('assignment-' + (document.body.dataset.mode || 'a'));
  }

  function cmcCurrentScore(root) {
    // Reuse the assignment's own grading — the score line reads "E / T points".
    var line = root.querySelector('.score-line');
    var panel = root.querySelector('.results');
    var m = line && /^(\d+) \/ (\d+) points$/.exec((line.textContent || '').trim());
    if (!(panel && !panel.hidden && m)) grade(root);
    var txt = (root.querySelector('.score-line').textContent || '').trim();
    var m2 = /^(\d+) \/ (\d+) points$/.exec(txt);
    return { correct: m2 ? Number(m2[1]) : 0, total: m2 ? Number(m2[2]) : 0 };
  }

  function cmcBuildBody(name, uid, score, mode) {
    // Field set matches the drill_attempts rules: guest branch requires
    // studentUid == '', name 1-40 chars, ints in range, classId null.
    var label = mode === 'b' ? 'Home Assignment 2 · Clinic' : 'Home Assignment 1 · Newsroom';
    var pct = score.total > 0 ? Math.round(score.correct / score.total * 100) : 0;
    return {
      drillSlug:   { stringValue: 'doctor-fish.html' },
      drillTitle:  { stringValue: 'Unit 14 · Doctor Fish — ' + label },
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
    var mode = document.body.dataset.mode || 'a';

    var sess = cmcSession();
    var name = ((document.getElementById('stuName').value || '').trim() || sess.name).slice(0, 40);
    var nameEl = document.getElementById('stuName');
    if (!name) {
      cmcToast('Add your name first — your teacher needs to know who finished the homework.', true);
      btn.textContent = '⚠ Add your name first';
      setTimeout(function () { btn.textContent = 'Submit to Teacher ✓'; }, 2600);
      nameEl.focus();
      nameEl.classList.add('needs-name');
      setTimeout(function () { nameEl.classList.remove('needs-name'); }, 1900);
      document.querySelector('.hw-hero').scrollIntoView({ behavior: 'smooth', block: 'center' });
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
    return 'Kid 11 Online Homework — Unit 14 · Doctor Fish · Home Assignments 1 & 2 (auto-graded live worksheet)';
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
    location.href = 'mailto:?subject=' + encodeURIComponent('Unit 14 · Doctor Fish — Kid 11 Online Homework') + '&body=' + encodeURIComponent(cmcShareText() + '\n' + cmcHomeworkUrl());
    cmcToggleShare(false);
  });
  document.querySelector('[data-cmc-close]').addEventListener('click', function () { cmcToggleShare(false); });
})();
'''
# append before the LAST </script>
i = html.rfind('</script>')
html = html[:i] + FURNITURE_JS + html[i:]

open(OUT, 'w', encoding='utf-8').write(html)

# ── 7. fidelity check: graded-content attribute sequence must be 1:1 ────
def seq(text):
    return re.findall(r'data-(?:answer|correct|solution)="([^"]+)"', text)

src_seq, out_seq = seq(open(SRC, encoding='utf-8').read()), seq(html)
assert src_seq == out_seq, f'content drift! {len(src_seq)} vs {len(out_seq)}'
sort_cards_src = open(SRC, encoding='utf-8').read().count('class="sort-card"')
sort_cards_out = html.count('class="sort-card"')
assert sort_cards_src == sort_cards_out == 16, 'sort cards drifted'
assert html.count('class="write-task') == open(SRC, encoding='utf-8').read().count('class="write-task'), 'write tasks drifted'
assert 'TODO' not in html and 'XXX' not in html and '【' not in html, 'placeholder left'
for pin in ['Submit to Teacher', 'submitCompletion', 'documents/drill_attempts', 'cmc-student-token',
            'cmc-student-refresh-token', 'classId:       { nullValue: null }', 'Add your name first',
            'Back to CMC', 'wa.me', 't.me/share', 'mailto:', 'data-cmc-copy', 'hw-kid11-doctor-fish',
            'hw-pending', 'Homework not shared yet', 'Share with students']:
    assert pin in html, f'missing pin: {pin}'
print(f'OK wrote {OUT}: {len(html)} bytes, {len(out_seq)} graded keys 1:1, '
      f'{sort_cards_out} sort cards, furniture + gate present')
