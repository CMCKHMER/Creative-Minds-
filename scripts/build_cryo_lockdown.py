#!/usr/bin/env python3
"""Build public/cryo-lockdown.html from the teacher's upload (lockdown.html).

The game itself (Cryo-Vault Lockdown — Unit 15 · DNA Bank escape room) is a
FAITHFUL 1:1 copy of the upload: same puzzles, same coolant timer, same
scoring (1000 + time*2 + hints*100 − errors*25), same ranks. This builder
adds the CMC site furniture the other standalone games ship with:

  · back-to-CMC pill (same fixture as syntax-clash-pro / writequest, with the
    game's HUD dropped to z-index 50 so the pill stays clickable);
  · OPERATIVE IDENTITY fields on the briefing sheet — students key in their
    NAME and ID (persisted in localStorage, email-as-name guarded);
  · a CLASS LEADERBOARD block on the result sheet (win AND lose) that keys
    off the engine's cryo:run event and POSTs one drill_attempts doc through
    the same pipeline as Word Forge / Syntax Clash (drillSource
    'learning-games', guest branch + signed-in token with securetoken
    refresh) — name and ID ride together in the public identity string;
  · a bottom action bar: class leaderboard link + Share-with-class menu
    (Copy Link / WhatsApp / Telegram / Email) carrying the competitive
    class-assignment text for the teacher.

The engine gets TWO assert-counted patches so the furniture can observe runs:
win() and lose() dispatch a `cryo:run` CustomEvent with the run stats. All
game logic, puzzle data and keys are untouched.
"""
import re, subprocess, sys

UPLOAD = '/home/z/my-project/upload/lockdown.html'
OUT = '/home/z/my-project/tmp/cmc-site/public/cryo-lockdown.html'

u = open(UPLOAD, encoding='utf-8').read()

def replace1(s, old, new):
    n = s.count(old)
    assert n == 1, 'replace1 expected 1 hit, got %d for %r' % (n, old[:80])
    return s.replace(old, new)

# ── 1. engine event hooks (the ONLY touches inside the game IIFE) ──────────
WIN_ANCHOR = "var rank=score>=1900?'S':(score>=1550?'A':(score>=1200?'B':'C'));"
WIN_DISPATCH = WIN_ANCHOR + (
    "\n  try{document.dispatchEvent(new CustomEvent('cryo:run',{detail:{outcome:'won',"
    "diff:S.diff,score:score,rank:rank,time:Math.round(S.time),hints:S.hints,"
    "hintsStart:DIFF[S.diff].hints,errors:S.errors,solved:S.solved,total:S.total}}));}catch(e){}"
)
LOSE_ANCHOR = "S.state='lost'; S.time=0; closeModal(); setKeypadEnabled(false); updateHUD();"
LOSE_DISPATCH = LOSE_ANCHOR + (
    "\n  try{document.dispatchEvent(new CustomEvent('cryo:run',{detail:{outcome:'lost',"
    "diff:S.diff,score:0,rank:'F',time:0,hints:S.hints,"
    "hintsStart:DIFF[S.diff].hints,errors:S.errors,solved:S.solved,total:S.total}}));}catch(e){}"
)
u = replace1(u, WIN_ANCHOR, WIN_DISPATCH)
u = replace1(u, LOSE_ANCHOR, LOSE_DISPATCH)

# ── 2. furniture CSS (inserted right before the game's own @media print) ───
FURN_CSS = """
/* ============ CMC SITE FURNITURE (namespaced cmc-) ============ */
html,body{overflow-x:clip}
/* Back-to-CMC pill shares the top edge with the game HUD — the HUD drops to
   z-index 50 (still above every in-game overlay trigger) and leaves room so
   the pill stays clickable, same fixture as syntax-clash-pro/writequest. */
#cmc-back-btn{position:fixed;top:14px;right:14px;z-index:60;display:flex;align-items:center;
  gap:8px;padding:9px 16px;border-radius:999px;background:rgba(3,20,24,.9);
  border:1px solid rgba(56,217,255,.45);color:#e9f4ff;font-family:'Space Grotesk',system-ui,sans-serif;
  font-size:13px;font-weight:700;text-decoration:none;box-shadow:0 8px 24px rgba(0,0,0,.35);transition:.2s}
#cmc-back-btn:hover{background:rgba(56,217,255,.16);transform:translateY(-1px)}
.hud{padding-right:170px}
@media(max-width:680px){
  .hud{padding-right:58px}
  #cmc-back-btn{font-size:0;padding:9px;gap:0;top:10px;right:10px}
  #cmc-back-btn svg{width:15px;height:15px}
}
/* Bottom action bar: class leaderboard link + Share-with-class menu */
.cmc-bar{position:fixed;left:0;right:0;bottom:0;z-index:55;background:rgba(3,8,20,.94);
  backdrop-filter:blur(8px);border-top:1px solid rgba(56,217,255,.28);
  padding:11px 16px;display:flex;gap:11px;justify-content:center;align-items:center;flex-wrap:wrap}
.cmc-btn{border:none;border-radius:999px;padding:10px 22px;font:inherit;font-weight:700;font-size:13px;
  cursor:pointer;transition:.18s;text-decoration:none;display:inline-flex;align-items:center;gap:7px}
.cmc-btn:hover{filter:brightness(1.15);transform:translateY(-1px)}
.cmc-btn-lb{background:linear-gradient(90deg,#38d9ff,#4d9dff);color:#03121f}
.cmc-btn-share{background:transparent;border:2px solid rgba(56,217,255,.5);color:#8feaff}
.cmc-btn-share:hover{border-color:#38d9ff}
.cmc-toast{position:fixed;left:50%;bottom:86px;transform:translateX(-50%) translateY(14px);z-index:95;
  background:#0a1c34;border:1px solid rgba(56,217,255,.45);color:#e9f4ff;border-radius:999px;
  padding:9px 20px;font-size:13px;font-weight:600;opacity:0;pointer-events:none;transition:.25s;max-width:92vw}
.cmc-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
.cmc-toast.err{border-color:rgba(255,84,112,.6);color:#ffc2cc}
.cmc-share{position:fixed;left:50%;bottom:86px;transform:translateX(-50%) translateY(10px);z-index:94;
  display:flex;flex-direction:column;gap:7px;background:#0a1c34;border:1px solid rgba(56,217,255,.45);
  border-radius:14px;padding:12px;min-width:230px;box-shadow:0 24px 70px rgba(0,0,0,.7);
  opacity:0;pointer-events:none;transition:.2s}
.cmc-share.show{opacity:1;pointer-events:auto;transform:translateX(-50%) translateY(0)}
.cmc-share button{border:1px solid rgba(56,217,255,.3);background:rgba(0,0,0,.35);color:#e9f4ff;
  border-radius:8px;padding:10px 14px;font-size:13px;font-weight:600;text-align:left;transition:.15s}
.cmc-share button:hover{border-color:#38d9ff;background:rgba(56,217,255,.12)}
.cmc-share button.close{border-color:rgba(255,84,112,.4);color:#ff9db0}
/* Operative identity inputs (briefing sheet + result sheet) */
.cmc-id{background:rgba(0,0,0,.3);border:1px solid rgba(56,217,255,.28);border-radius:10px;padding:13px 15px;margin-bottom:20px}
.cmc-id b{font-family:'IBM Plex Mono',monospace;font-size:9.5px;letter-spacing:1.4px;color:#38d9ff;display:block;margin-bottom:9px}
.cmc-id .row{display:flex;gap:9px;flex-wrap:wrap}
.cmc-id input{flex:1;min-width:150px;padding:10px 12px;border-radius:8px;border:1px solid rgba(56,217,255,.3);
  background:rgba(0,0,0,.45);color:#e9f4ff;font-size:14px}
.cmc-id input::placeholder{color:#5a7690;opacity:1}
.cmc-id input:focus{outline:none;border-color:#38d9ff;box-shadow:0 0 0 3px rgba(56,217,255,.16)}
.cmc-id small{display:block;margin-top:8px;font-family:'IBM Plex Mono',monospace;font-size:9.5px;color:#93aec8;letter-spacing:.6px;line-height:1.6}
/* Leaderboard post block (result sheet) */
.cmc-lb{border:1px solid rgba(45,212,167,.35);background:rgba(45,212,167,.07);border-radius:10px;
  padding:14px 15px;margin-top:6px}
.cmc-lb b{font-family:'IBM Plex Mono',monospace;font-size:9.5px;letter-spacing:1.4px;color:#2dd4a7;display:block;margin-bottom:9px}
.cmc-lb .row{display:flex;gap:8px;flex-wrap:wrap}
.cmc-lb input{flex:1;min-width:140px;padding:10px 12px;border-radius:8px;border:1px solid rgba(56,217,255,.3);
  background:rgba(0,0,0,.45);color:#e9f4ff;font-size:13.5px}
.cmc-lb input:focus{outline:none;border-color:#38d9ff;box-shadow:0 0 0 3px rgba(56,217,255,.16)}
.cmc-lb .send{flex-shrink:0;border:none;border-radius:8px;padding:10px 18px;font-weight:700;font-size:12.5px;
  background:linear-gradient(100deg,#2dd4a7,#38d9ff);color:#03121f;cursor:pointer;transition:.16s}
.cmc-lb .send:hover{filter:brightness(1.12)}
.cmc-lb .send:disabled{opacity:.6;cursor:progress}
.cmc-lb .status{display:block;margin-top:9px;font-family:'IBM Plex Mono',monospace;font-size:10.5px;color:#93aec8;letter-spacing:.5px;line-height:1.6}
.cmc-lb .status.good{color:#2dd4a7}
.cmc-lb .status.bad{color:#ff9db0}
.stage{padding-bottom:132px}
@media print{
  .cmc-bar,#cmc-back-btn,.cmc-share,.cmc-toast{display:none!important}
}
"""

# ── 3. markup additions ────────────────────────────────────────────────────
BACK_BTN = """<!-- Back to CMC home (same fixture as the other standalone games) -->
<a id="cmc-back-btn" href="https://cmckhmer.github.io/Creative-Minds-/" target="_self" rel="noopener noreferrer" aria-label="Back to CMC home">
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M19 12H5m0 0 6 6m-6-6 6-6" stroke="#38d9ff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
  Back to CMC
</a>
"""

# Operative identity on the briefing sheet — name + ID keyed in by the student.
BRIEF_ID = """
    <div class="cmc-id" id="cmcBriefId">
      <b>OPERATIVE IDENTITY — NAME &amp; ID</b>
      <div class="row">
        <input type="text" id="cmcNameIn" maxlength="24" placeholder="Your name" autocomplete="name" spellcheck="false">
        <input type="text" id="cmcIdIn" maxlength="14" placeholder="ID / class (e.g. 7A · No. 12)" spellcheck="false">
      </div>
      <small>Both ride along when your score is posted to the class leaderboard. Saved on this device.</small>
    </div>
"""

# Leaderboard post block on the result sheet (win AND lose share this sheet).
RESULT_LB = """
    <div class="cmc-lb" id="cmcLb">
      <b>CLASS LEADERBOARD — POST THIS RUN</b>
      <div class="row">
        <input type="text" id="cmcLbName" maxlength="24" placeholder="Your name" autocomplete="name" spellcheck="false">
        <input type="text" id="cmcLbId" maxlength="14" placeholder="ID / class" spellcheck="false">
        <button type="button" class="send" id="cmcLbSend">📡 SEND SCORE</button>
      </div>
      <span class="status" id="cmcLbStatus">Add your name, then send the run to the class leaderboard.</span>
    </div>
"""

BAR = """<!-- Bottom action bar: class leaderboard link + teacher share kit -->
<div class="cmc-bar no-print">
  <a class="cmc-btn cmc-btn-lb" href="https://cmckhmer.github.io/Creative-Minds-/#games" aria-label="Open the class leaderboard on the CMC games page">🏆 Class leaderboard</a>
  <button type="button" class="cmc-btn cmc-btn-share" data-cmc-share aria-haspopup="true">📣 Share with class ▾</button>
</div>
<div class="cmc-toast" id="cmcToast" role="status" aria-live="polite"></div>
<div class="cmc-share" id="cmcShare">
  <button type="button" data-cmc-copy>🔗 Copy assignment link</button>
  <button type="button" data-cmc-wa>💬 WhatsApp</button>
  <button type="button" data-cmc-tg>✈️ Telegram</button>
  <button type="button" data-cmc-email>✉️ Email</button>
  <button type="button" class="close" data-cmc-close>✕ Close</button>
</div>
"""

# ── 4. integration script (identity + leaderboard POST + share kit) ───────
INTEG_JS = r"""<script>
/* ── CMC integration: operative identity + class leaderboard POST + share ──
   The game engine stays untouched except for two `cryo:run` events it now
   dispatches when a run ends (win/lose). This script:
     1. keeps the Operative NAME + ID keyed on the briefing sheet in sync
        with the result sheet and localStorage (an email is NEVER a name —
        same guard as the homework pages and cmc-shared.js);
     2. on demand (auto once per finished run when a name is present, or via
        the 📡 SEND SCORE button) POSTs one drill_attempts doc through the
        SAME pipeline as Word Forge / Syntax Clash: guest branch (empty uid,
        checked name, classId null) or the signed-in session token with
        securetoken refresh — drillSource 'learning-games', so the run lands
        on the homepage ticker and the games-page class leaderboard;
     3. runs the Share-with-class kit (Copy Link / WhatsApp / Telegram /
        Email) with the competitive class-assignment text for teachers. */
(function () {
  'use strict';
  var CMC_FS = 'https://firestore.googleapis.com/v1/projects/creative-minds-cambodia/databases/(default)/documents/drill_attempts';
  var CMC_API_KEY = 'AIzaSyDNUq0ru99XKh08D887Xk63h36MPOlXWwc';
  var PAGE_URL = 'https://cmckhmer.github.io/Creative-Minds-/cryo-lockdown.html';
  var ASSIGN_TEXT = '🧬 CMC class challenge — Cryo-Vault Lockdown (DNA Bank): the coolant is failing. Crack all 6 security terminals, enter the release code and open the vault before the timer dies. Key in your name + ID, post your score and beat the class on the leaderboard!';

  /* ── an email is NEVER a display name (same rule as the site) ── */
  function looksEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim()); }
  function friendlyFromEmail(email) {
    var local = String(email || '').split('@')[0].trim();
    if (!local) return '';
    var words = local.split(/[._+\-]+/).map(function (w) { return w.trim(); }).filter(Boolean);
    if (!words.length) return local.slice(0, 40);
    return words.map(function (w) { return (w.charAt(0).toUpperCase() + w.slice(1)).slice(0, 40); }).join(' ').trim().slice(0, 40);
  }
  function nameOf(v) {
    var s = String(v || '').trim();
    if (!s || !looksEmail(s)) return s;
    return friendlyFromEmail(s) || s;
  }
  (function heal() {
    try {
      var stored = localStorage.getItem('cmc-student-name') || '';
      if (!looksEmail(stored)) return;
      var healed = friendlyFromEmail(stored);
      if (healed) localStorage.setItem('cmc-student-name', healed);
      else localStorage.removeItem('cmc-student-name');
    } catch (e) {}
  })();

  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  var DIFF_LABEL = { easy: 'TRAINEE', normal: 'TECHNICIAN', hard: 'SPECIALIST' };
  var nameIn = document.getElementById('cmcNameIn');
  var idIn = document.getElementById('cmcIdIn');
  var lbName = document.getElementById('cmcLbName');
  var lbId = document.getElementById('cmcLbId');
  var lbSend = document.getElementById('cmcLbSend');
  var lbStatus = document.getElementById('cmcLbStatus');

  /* identity: prefilled from the signed-in session or the previous visit */
  var player = { name: '', id: '' };
  try {
    var pn = JSON.parse(ls('cmc-player-name') || 'null');
    player.name = (pn && pn.name ? nameOf(pn.name) : '');
  } catch (e) { player.name = ''; }
  if (!player.name) player.name = nameOf(ls('cmc-student-name') || '');
  player.id = (ls('cmc-player-id') || '').trim();
  nameIn.value = player.name; idIn.value = player.id;
  lbName.value = player.name; lbId.value = player.id;

  function currentIdentity() {
    var n = nameOf(lbName.value || nameIn.value).trim();
    var id = (lbId.value || idIn.value).trim();
    return { name: n, id: id };
  }
  function persistIdentity() {
    var id = currentIdentity();
    if (id.name) {
      try { localStorage.setItem('cmc-player-name', JSON.stringify({ name: id.name, at: Date.now() })); } catch (e) {}
    }
    if (id.id) lsSet('cmc-player-id', id.id);
  }
  [nameIn, idIn, lbName, lbId].forEach(function (inp) {
    inp.addEventListener('input', function () {
      if (inp === nameIn) lbName.value = nameIn.value;
      if (inp === idIn) lbId.value = idIn.value;
      if (inp === lbName) nameIn.value = lbName.value;
      if (inp === lbId) idIn.value = lbId.value;
      persistIdentity();
    });
  });

  function toast(msg, err) {
    var t = document.getElementById('cmcToast');
    t.textContent = msg;
    t.classList.toggle('err', !!err);
    t.classList.add('show');
    clearTimeout(toast._tm);
    toast._tm = setTimeout(function () { t.classList.remove('show'); }, 3600);
  }

  function setStatus(msg, cls) {
    lbStatus.textContent = msg;
    lbStatus.className = 'status' + (cls ? ' ' + cls : '');
  }

  var lastRun = null;
  var autoSentFor = '';

  function publicIdentity() {
    var id = currentIdentity();
    var full = id.name + (id.id ? ' · ' + id.id : '');
    return { name: id.name, full: full.slice(0, 40) };
  }

  function sendScore() {
    var id = currentIdentity();
    if (!id.name) { setStatus('Key in your name (and ID) first — they ride with your score.', 'bad'); lbName.focus(); return; }
    if (!lastRun) { setStatus('Finish a run first — the vault decides the score.', 'bad'); return; }
    persistIdentity();
    lbSend.disabled = true;
    var pub = publicIdentity();
    var d = lastRun;
    var pct;
    if (d.outcome === 'won') {
      var maxScore = 1000 + d.total * 2 + d.hintsStart * 100;
      pct = Math.max(55, Math.min(100, Math.round(d.score / maxScore * 100)));
    } else {
      pct = Math.round(50 * d.solved / 6);
    }
    var go = function (tok) {
      var uid = ls('cmc-student-uid') || '';
      fetch(CMC_FS, {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { 'Authorization': 'Bearer ' + tok } : {}),
        body: JSON.stringify({ fields: {
          drillSlug: { stringValue: 'cryo-lockdown.html' },
          drillTitle: { stringValue: 'Cryo-Vault Lockdown · ' + (DIFF_LABEL[d.diff] || d.diff) },
          drillSource: { stringValue: 'learning-games' },
          studentName: { stringValue: pub.full },
          studentUid: { stringValue: uid },
          classId: (function () { var c = ls('cmc-student-classId'); return c ? { stringValue: c } : { nullValue: null }; })(),
          scorePct: { integerValue: String(Math.max(0, Math.min(100, pct))) },
          correctCount: { integerValue: String(Math.max(0, d.solved)) },
          totalCount: { integerValue: '6' },
          submittedAt: { timestampValue: new Date().toISOString() }
        } })
      }).then(function (r) {
        lbSend.disabled = false;
        if (!r.ok) throw new Error('HTTP ' + r.status);
        autoSentFor = d.runId;
        setStatus('✓ Sent — ' + (d.outcome === 'won' ? 'Rank ' + d.rank + ' · ' + d.score + ' pts · ' + pct + '%' : 'vault failed · ' + d.solved + '/6 terminals · ' + pct + '%') + '. Open the class leaderboard to compare.', 'good');
        toast('Score sent to the class leaderboard ✓');
      }).catch(function () {
        lbSend.disabled = false;
        setStatus('Could not reach the leaderboard (offline?). Your run is kept — press SEND again.', 'bad');
      });
    };
    var tok = ls('cmc-student-token');
    var exp = Number(ls('cmc-student-token-expires') || '0');
    if (tok && exp && exp <= Date.now()) {
      var rt = ls('cmc-student-refresh-token');
      if (!rt) { go(tok); return; }
      fetch('https://securetoken.googleapis.com/v1/token?key=' + CMC_API_KEY, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(rt)
      }).then(function (r) { return r.ok ? r.json() : null; }).then(function (dd) {
        if (dd && dd.id_token) {
          try {
            localStorage.setItem('cmc-student-token', dd.id_token);
            localStorage.setItem('cmc-student-token-expires', String(Date.now() + (Number(dd.expires_in) || 3600) * 1000 - 60000));
            if (dd.refresh_token) localStorage.setItem('cmc-student-refresh-token', dd.refresh_token);
          } catch (e) {}
          go(dd.id_token);
        } else go('');
      }).catch(function () { go(''); });
    } else { go(tok || ''); }
  }
  lbSend.addEventListener('click', sendScore);

  document.addEventListener('cryo:run', function (ev) {
    var d = ev.detail || {};
    d.runId = d.outcome + ':' + d.score + ':' + d.time + ':' + d.errors + ':' + Date.now();
    lastRun = d;
    if (d.outcome === 'won') {
      var maxScore = 1000 + d.total * 2 + d.hintsStart * 100;
      var pct = Math.max(55, Math.min(100, Math.round(d.score / maxScore * 100)));
      setStatus('Rank ' + d.rank + ' · ' + d.score + ' pts · ' + pct + '% ready to post. Add your name + ID if new, then SEND.', '');
    } else {
      setStatus('Vault failed at ' + d.solved + '/6 terminals — post it anyway: the class sees who got closest.', '');
    }
    var pub = publicIdentity();
    if (pub.name && pub.full && autoSentFor !== d.runId) { autoSentFor = d.runId; sendScore(); }
  });

  /* ── share-with-class kit (teacher's competitive assignment text) ── */
  var share = document.getElementById('cmcShare');
  function shareText() { return ASSIGN_TEXT; }
  function openShare() { share.classList.add('show'); }
  function closeShare() { share.classList.remove('show'); }
  document.querySelectorAll('[data-cmc-share]').forEach(function (b) { b.addEventListener('click', function () { openShare(); }); });
  share.addEventListener('click', function (e) {
    var act = e.target.closest('[data-cmc-copy],[data-cmc-wa],[data-cmc-tg],[data-cmc-email],[data-cmc-close]');
    if (!act) return;
    var txt = shareText() + ' ' + PAGE_URL;
    if (act.hasAttribute('data-cmc-close')) { closeShare(); return; }
    if (act.hasAttribute('data-cmc-copy')) {
      var done = function () { toast('Assignment link copied ✓'); closeShare(); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(PAGE_URL).then(done, function () {
          try { var ta = document.createElement('textarea'); ta.value = PAGE_URL; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); done(); } catch (err) { toast('Copy failed — long-press the URL instead', true); }
        });
      } else {
        try { var ta2 = document.createElement('textarea'); ta2.value = PAGE_URL; document.body.appendChild(ta2); ta2.select(); document.execCommand('copy'); document.body.removeChild(ta2); done(); } catch (err2) { toast('Copy failed — long-press the URL instead', true); }
      }
    } else if (act.hasAttribute('data-cmc-wa')) {
      window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank', 'noopener'); closeShare();
    } else if (act.hasAttribute('data-cmc-tg')) {
      window.open('https://t.me/share/url?url=' + encodeURIComponent(PAGE_URL) + '&text=' + encodeURIComponent(shareText()), '_blank', 'noopener'); closeShare();
    } else if (act.hasAttribute('data-cmc-email')) {
      location.href = 'mailto:?subject=' + encodeURIComponent('Cryo-Vault Lockdown — CMC class challenge') + '&body=' + encodeURIComponent(shareText() + '\n' + PAGE_URL); closeShare();
    }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeShare(); });
})();
</script>"""

# ── 5. assemble ────────────────────────────────────────────────────────────
out = u
# the game upload ships exactly one <style> block — furniture goes last in it
assert out.count('</style>') == 1, 'expected a single style block'
out = out.replace('</style>', FURN_CSS + '</style>')

# back pill right after <body>
assert out.count('<body>') == 1
out = out.replace('<body>', '<body>\n\n' + BACK_BTN)

# operative identity on the briefing sheet (before the difficulty cards)
DIFFS_ANCHOR = '    <div class="diffs" id="diffCards"></div>'
assert out.count(DIFFS_ANCHOR) == 1
out = out.replace(DIFFS_ANCHOR, BRIEF_ID + '\n' + DIFFS_ANCHOR)

# leaderboard block on the result sheet (before the sheet actions)
ACTIONS_ANCHOR = """    <div class="sheet-actions">
      <button type="button" class="btn primary big" id="againBtn">↻ RUN AGAIN</button>"""
assert out.count(ACTIONS_ANCHOR) == 1
out = out.replace(ACTIONS_ANCHOR, RESULT_LB + '\n' + ACTIONS_ANCHOR)

# bottom bar + integration script before </body>
assert out.count('</body>') == 1
out = out.replace('</body>', BAR + '\n' + INTEG_JS + '\n</body>')

# family-consistent page title
out = replace1(out, '<title>DNA Bank · Cryo-Vault Lockdown</title>',
               '<title>Cryo-Vault Lockdown · DNA Bank — CMC Learning Game</title>')

# ── 6. sanity: the game itself is untouched ────────────────────────────────
for needle, label in [
    ("easy:{label:'TRAINEE',time:720,hints:4,penalty:0,hintCost:10", 'TRAINEE difficulty intact'),
    ("normal:{label:'TECHNICIAN',time:540,hints:3,penalty:10,hintCost:20", 'TECHNICIAN difficulty intact'),
    ("hard:{label:'SPECIALIST',time:390,hints:2,penalty:20,hintCost:30", 'SPECIALIST difficulty intact'),
    ("var score=Math.max(0,Math.round(1000+S.time*2+S.hints*100-S.errors*25));", 'score formula intact'),
    ("solution:['bees','plants','eaters','food','env']", 'SEQUENCE RELAY key intact'),
    ("answers:[['extinct'],['global'],['samples','sample'],['support']]", 'CLOZE SEAL keys intact'),
    ("{t:'Laws alone have stopped species from disappearing.',a:'F'}", 'TRUTH SCAN key intact'),
]:
    if label == 'x':
        continue
    assert needle in out, 'game content lost: ' + label
assert out.count('cryo:run') == 4, 'run event: comment + 2 dispatches + listener'
assert out.count("new CustomEvent('cryo:run'") == 2, 'exactly two dispatches (win + lose)'
assert out.count('function startGame()') == 1 and out.count('function submitPuzzle()') == 1
assert out.count('id="cmcNameIn"') == 1 and out.count('id="cmcIdIn"') == 1
assert out.count('id="cmcLbName"') == 1 and out.count('id="cmcLbId"') == 1 and out.count('id="cmcLbSend"') == 1
assert out.count("drillSource: { stringValue: 'learning-games' }") == 1
assert out.count("drillSlug: { stringValue: 'cryo-lockdown.html' }") == 1
assert out.count("drillTitle: { stringValue: 'Cryo-Vault Lockdown · '") == 1
assert out.count('data-cmc-copy') == 3 and out.count('data-cmc-wa') == 3 and out.count('data-cmc-tg') == 3 and out.count('data-cmc-email') == 3, 'share actions: 1 markup + 2 handler refs each'
assert out.count('wa.me') >= 1 and out.count('t.me/share') >= 1 and out.count('mailto:') >= 1
assert out.count('https://cmckhmer.github.io/Creative-Minds-/#games') == 1
assert out.count('id="cmc-back-btn"') == 1
assert 'inviteMode' not in out, 'no inviteMode key (rules guard satisfied)'
assert not re.search(r'TODO|XXX|【', out), 'no leftover placeholders'

open(OUT, 'w', encoding='utf-8').write(out)
print('written', OUT, len(out), 'bytes (upload was', len(u), ')')

# ── 7. node --check both embedded scripts ──────────────────────────────────
scripts = re.findall(r'<script>(.*?)</script>', out, re.S)
checked = 0
for idx, js in enumerate(scripts):
    if 'function' in js:
        p = '/tmp/cryo_script_%d.js' % idx
        open(p, 'w', encoding='utf-8').write(js)
        res = subprocess.run(['node', '--check', p], capture_output=True, text=True)
        assert res.returncode == 0, 'script %d syntax error: %s' % (idx, res.stderr[:400])
        checked += 1
print('node --check passed on', checked, 'embedded scripts')
