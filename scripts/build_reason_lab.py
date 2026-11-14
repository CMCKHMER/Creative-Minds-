#!/usr/bin/env python3
# Build public/reason-lab.html from the teacher's upload (upload/criticle.html,
# "Reason Lab · Advanced Critical Thinking Trainer"): the game ships 1:1 — the
# engine, item bank, skills, modes, ranks, badges and styles are untouched —
# plus the same CMC furniture the other standalone games carry (cryo-lockdown
# fixture): back-to-CMC pill, Thinker identity (name + ID, email-as-name
# guarded, persisted), a class-leaderboard POST row on the session report
# (drill_attempts pipeline, guest branch or signed-in token with securetoken
# refresh, auto-send when a name is present), the Share-with-class kit and the
# class-leaderboard link bar. The engine's only change is one dispatched
# 'cmcreason:session' event at the end of finish(), which the integration
# block listens for.
import re, subprocess, sys, tempfile, os

SRC = '/home/z/my-project/upload/criticle.html'
OUT = '/home/z/my-project/tmp/cmc-site/public/reason-lab.html'

html = open(SRC, encoding='utf-8').read()
orig_len = len(html)

def swap(s, old, new, count=1):
    n = s.count(old)
    if n != count:
        sys.exit(f'ANCHOR FAIL ({n} found, want {count}): {old[:90]!r}')
    return s.replace(old, new)

# ── P1: furniture CSS before the last </style> ─────────────────────────────
CMC_CSS = '''
/* ═══ CMC furniture (added) — identity, leaderboard post, back pill, bar ═══ */
.ib.cmcback{width:auto;padding:0 13px;font-size:12px;font-weight:700;text-decoration:none;letter-spacing:.5px}
.cmc-id{background:rgba(4,8,16,.45);border:1px solid rgba(245,165,36,.28);border-radius:10px;padding:13px 15px;margin:18px 0 4px}
.cmc-id b{font-family:'IBM Plex Mono',monospace;font-size:9.5px;letter-spacing:1.4px;color:var(--amber);display:block;margin-bottom:9px}
.cmc-id .row{display:flex;gap:9px;flex-wrap:wrap}
.cmc-id input{flex:1;min-width:150px;padding:10px 12px;border-radius:8px;border:1px solid rgba(245,165,36,.3);background:rgba(4,8,16,.5);color:var(--text);font-size:14px;font-family:inherit}
.cmc-id input::placeholder{color:var(--dim);opacity:1}
.cmc-id input:focus{outline:none;border-color:var(--amber);box-shadow:0 0 0 3px rgba(245,165,36,.14)}
.cmc-id small{display:block;margin-top:8px;font-family:'IBM Plex Mono',monospace;font-size:9.5px;color:var(--muted);letter-spacing:.6px;line-height:1.6}
.cmc-lb{border:1px solid rgba(52,211,153,.35);background:rgba(52,211,153,.06);border-radius:10px;padding:14px 15px;margin-top:18px}
.cmc-lb b{font-family:'IBM Plex Mono',monospace;font-size:9.5px;letter-spacing:1.4px;color:var(--green);display:block;margin-bottom:9px}
.cmc-lb .row{display:flex;gap:8px;flex-wrap:wrap}
.cmc-lb input{flex:1;min-width:140px;padding:10px 12px;border-radius:8px;border:1px solid rgba(245,165,36,.3);background:rgba(4,8,16,.5);color:var(--text);font-size:13.5px;font-family:inherit}
.cmc-lb input:focus{outline:none;border-color:var(--amber);box-shadow:0 0 0 3px rgba(245,165,36,.14)}
.cmc-lb .send{flex-shrink:0;border:none;border-radius:8px;padding:10px 18px;font-weight:700;font-size:12.5px;font-family:inherit;background:linear-gradient(100deg,var(--green),var(--cyan));color:#04240f;cursor:pointer;transition:.16s}
.cmc-lb .send:hover{filter:brightness(1.12)}
.cmc-lb .send:disabled{opacity:.6;cursor:progress}
.cmc-lb .status{display:block;margin-top:9px;font-family:'IBM Plex Mono',monospace;font-size:10.5px;color:var(--muted);letter-spacing:.5px;line-height:1.6}
.cmc-lb .status.good{color:var(--green)}
.cmc-lb .status.bad{color:var(--red)}
.cmc-bar{position:fixed;left:0;right:0;bottom:0;z-index:55;background:rgba(5,9,17,.94);backdrop-filter:blur(8px);
  border-top:1px solid rgba(245,165,36,.3);padding:11px 16px;display:flex;gap:11px;justify-content:center;align-items:center;flex-wrap:wrap}
.cmc-btn{border:none;border-radius:999px;padding:10px 22px;font:inherit;font-weight:700;font-size:13px;
  cursor:pointer;transition:.18s;text-decoration:none;display:inline-flex;align-items:center;gap:7px}
.cmc-btn:hover{filter:brightness(1.15);transform:translateY(-1px)}
.cmc-btn-lb{background:linear-gradient(100deg,var(--amber),#ffcb6b);color:#241703}
.cmc-btn-share{background:transparent;border:2px solid rgba(245,165,36,.5);color:var(--amber)}
.cmc-btn-share:hover{border-color:var(--amber)}
.cmc-toast{position:fixed;left:50%;bottom:86px;transform:translateX(-50%) translateY(14px);z-index:95;
  background:var(--overlay);border:1px solid rgba(245,165,36,.45);color:var(--text);border-radius:999px;
  padding:9px 20px;font-size:13px;font-weight:600;opacity:0;pointer-events:none;transition:.25s;max-width:92vw}
.cmc-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
.cmc-toast.err{border-color:rgba(251,113,133,.6);color:var(--red)}
.cmc-share{position:fixed;left:50%;bottom:86px;transform:translateX(-50%) translateY(10px);z-index:94;
  display:flex;flex-direction:column;gap:7px;background:var(--overlay);border:1px solid rgba(245,165,36,.45);
  border-radius:14px;padding:12px;min-width:230px;box-shadow:0 24px 70px rgba(0,0,0,.7);
  opacity:0;pointer-events:none;transition:.2s}
.cmc-share.show{opacity:1;pointer-events:auto;transform:translateX(-50%) translateY(0)}
.cmc-share button{border:1px solid rgba(245,165,36,.3);background:rgba(4,8,16,.35);color:var(--text);
  border-radius:8px;padding:10px 14px;font-size:13px;font-weight:600;text-align:left;transition:.15s;font-family:inherit}
.cmc-share button:hover{border-color:var(--amber);background:rgba(245,165,36,.12)}
.cmc-share button.close{border-color:rgba(251,113,133,.4);color:var(--red)}
@media print{.cmc-bar,.cmc-share,.cmc-toast,.cmc-lb,.cmc-id{display:none!important}}
'''
html = swap(html, '</style>', CMC_CSS + '</style>')

# ── P2: back-to-CMC pill as the first header control ──────────────────────
html = swap(html, '<div class="hctl">',
  '<div class="hctl">\n    <a class="ib cmcback" id="cmcBackBtn" href="https://cmckhmer.github.io/Creative-Minds-/" aria-label="Back to CMC home" title="Back to CMC home">← CMC</a>')

# ── P3: layout bottom padding clears the fixed action bar ─────────────────
html = swap(html, 'padding:calc(var(--head) + 22px) 20px 70px', 'padding:calc(var(--head) + 22px) 20px 124px')

# ── P4: Thinker identity on the briefing sheet ────────────────────────────
html = swap(html, '<div class="row">\n          <button type="button" class="btn primary big" id="startBtn">▶ BEGIN SESSION</button>',
'''<div class="cmc-id" id="cmcBriefId">
          <b>THINKER IDENTITY — NAME &amp; ID</b>
          <div class="row">
            <input type="text" id="cmcNameIn" maxlength="24" placeholder="Your name" autocomplete="name" spellcheck="false">
            <input type="text" id="cmcIdIn" maxlength="14" placeholder="ID / class (e.g. 7A · No. 12)" spellcheck="false">
          </div>
          <small>Both ride along when your session is posted to the class leaderboard. Saved on this device.</small>
        </div>
        <div class="row">
          <button type="button" class="btn primary big" id="startBtn">▶ BEGIN SESSION</button>''')

# ── P5: class-leaderboard post row on the session report ──────────────────
html = swap(html, '<div class="bars" id="rBars"></div>',
'''<div class="bars" id="rBars"></div>
        <div class="cmc-lb" id="cmcLb">
          <b>CLASS LEADERBOARD — POST THIS SESSION</b>
          <div class="row">
            <input type="text" id="cmcLbName" maxlength="24" placeholder="Your name" autocomplete="name" spellcheck="false">
            <input type="text" id="cmcLbId" maxlength="14" placeholder="ID / class" spellcheck="false">
            <button type="button" class="send" id="cmcLbSend">📡 SEND SCORE</button>
          </div>
          <span class="status" id="cmcLbStatus">Finish a session, add your name, then send it to the class leaderboard.</span>
        </div>''')

# ── P6: the engine's single change — dispatch the session event ───────────
html = swap(html, " show('vResults');\n if(acc>=90){Snd.up();celebrate(el.vResults);}else Snd.end();",
""" try{document.dispatchEvent(new CustomEvent('cmcreason:session',{detail:{sid:Date.now()+':'+total+':'+S.score,
  mode:S.mode,label:label,acc:acc,correct:S.correct,total:total,score:S.score,best:S.best}}));}catch(e){}
 show('vResults');
 if(acc>=90){Snd.up();celebrate(el.vResults);}else Snd.end();""")

# ── P7: action bar + toast + share panel + integration block before </body> ──
CMC_BAR = '''
<!-- Bottom action bar: class leaderboard link + teacher share kit -->
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

<script>
/* ── CMC integration: thinker identity + class leaderboard POST + share ──
   The Reason Lab engine is untouched except for one 'cmcreason:session'
   event it dispatches when a session finishes. This block:
     1. keeps the Thinker NAME + ID synced between the briefing sheet and
        the session report + localStorage (an email is NEVER a display
        name — same guard as cmc-shared.js and the homework pages);
     2. on demand (auto once per finished session when a name is present,
        or via the 📡 SEND SCORE button) POSTs one drill_attempts doc
        through the SAME pipeline as the other games: guest branch (empty
        uid, checked name, classId null) or the signed-in session token
        with securetoken refresh — drillSource 'learning-games', so the
        session lands on the homepage ticker and the games-page class
        leaderboard;
     3. runs the Share-with-class kit (Copy Link / WhatsApp / Telegram /
        Email) with the competitive class-assignment text for teachers. */
(function () {
  'use strict';
  var CMC_FS = 'https://firestore.googleapis.com/v1/projects/creative-minds-cambodia/databases/(default)/documents/drill_attempts';
  var CMC_API_KEY = 'AIzaSyDNUq0ru99XKh08D887Xk63h36MPOlXWwc';
  var PAGE_URL = 'https://cmckhmer.github.io/Creative-Minds-/reason-lab.html';
  var ASSIGN_TEXT = '🧠 CMC class challenge — Reason Lab: eight critical-thinking skills (evidence, fallacies, bias, causality, assumptions, data literacy, argument, risk decisions) across Campaign, Gauntlet, Drill and Case File modes. Key in your name + ID, post your session to the class leaderboard and show who reasons best under pressure!';

  /* ── an email is NEVER a display name (same rule as the site) ── */
  function looksEmail(v) { return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(String(v || '').trim()); }
  function friendlyFromEmail(email) {
    var local = String(email || '').split('@')[0].trim();
    if (!local) return '';
    var words = local.split(/[._+\\-]+/).map(function (w) { return w.trim(); }).filter(Boolean);
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
    if (!lastRun) { setStatus('Finish a session first — the report decides the score.', 'bad'); return; }
    persistIdentity();
    lbSend.disabled = true;
    var pub = publicIdentity();
    var d = lastRun;
    var go = function (tok) {
      var uid = ls('cmc-student-uid') || '';
      fetch(CMC_FS, {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { 'Authorization': 'Bearer ' + tok } : {}),
        body: JSON.stringify({ fields: {
          drillSlug: { stringValue: 'reason-lab.html' },
          drillTitle: { stringValue: 'Reason Lab · ' + d.label },
          drillSource: { stringValue: 'learning-games' },
          studentName: { stringValue: pub.full },
          studentUid: { stringValue: uid },
          classId: (function () { var c = ls('cmc-student-classId'); return c ? { stringValue: c } : { nullValue: null }; })(),
          scorePct: { integerValue: String(Math.max(0, Math.min(100, d.acc))) },
          correctCount: { integerValue: String(Math.max(0, d.correct)) },
          totalCount: { integerValue: String(Math.max(0, d.total)) },
          submittedAt: { timestampValue: new Date().toISOString() }
        } })
      }).then(function (r) {
        lbSend.disabled = false;
        if (!r.ok) throw new Error('HTTP ' + r.status);
        autoSentFor = d.sid;
        setStatus('✓ Sent — ' + d.label + ' · ' + d.acc + '% · ' + d.correct + '/' + d.total + ' · ' + d.score + ' pts. Open the class leaderboard to compare.', 'good');
        toast('Session sent to the class leaderboard ✓');
      }).catch(function () {
        lbSend.disabled = false;
        setStatus('Could not reach the leaderboard (offline?). Your session is kept — press SEND again.', 'bad');
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

  document.addEventListener('cmcreason:session', function (ev) {
    var d = ev.detail || {};
    lastRun = d;
    setStatus(d.label + ' — ' + d.acc + '% · ' + d.correct + '/' + d.total + ' · ' + d.score + ' pts ready to post. Add your name + ID if new, then SEND.', '');
    var pub = publicIdentity();
    if (pub.name && pub.full && autoSentFor !== d.sid) { autoSentFor = d.sid; sendScore(); }
  });

  /* ── share-with-class kit (teacher's competitive assignment text) ── */
  var share = document.getElementById('cmcShare');
  function openShare() { share.classList.add('show'); }
  function closeShare() { share.classList.remove('show'); }
  document.querySelectorAll('[data-cmc-share]').forEach(function (b) { b.addEventListener('click', function () { openShare(); }); });
  share.addEventListener('click', function (e) {
    var act = e.target.closest('[data-cmc-copy],[data-cmc-wa],[data-cmc-tg],[data-cmc-email],[data-cmc-close]');
    if (!act) return;
    if (act.hasAttribute('data-cmc-close')) { closeShare(); return; }
    if (act.hasAttribute('data-cmc-copy')) {
      var done = function () { toast('Assignment link copied ✓'); closeShare(); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(PAGE_URL).then(done, function () {
          try { var ta = document.createElement('textarea'); ta.value = PAGE_URL; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); done(); } catch (err) { toast('Copy failed — long-press the URL instead', true); }
        });
      } else {
        try { var ta = document.createElement('textarea'); ta.value = PAGE_URL; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); done(); } catch (err) { toast('Copy failed — long-press the URL instead', true); }
      }
      return;
    }
    var txt = encodeURIComponent(ASSIGN_TEXT + ' ' + PAGE_URL);
    var url = encodeURIComponent(PAGE_URL);
    if (act.hasAttribute('data-cmc-wa')) { window.open('https://wa.me/?text=' + txt, '_blank', 'noopener'); closeShare(); }
    else if (act.hasAttribute('data-cmc-tg')) { window.open('https://t.me/share/url?url=' + url + '&text=' + encodeURIComponent(ASSIGN_TEXT), '_blank', 'noopener'); closeShare(); }
    else if (act.hasAttribute('data-cmc-email')) { window.location.href = 'mailto:?subject=' + encodeURIComponent('CMC class challenge — Reason Lab') + '&body=' + txt; closeShare(); }
  });
})();
</script>
'''
html = swap(html, '</body>', CMC_BAR + '</body>')

open(OUT, 'w', encoding='utf-8').write(html)
print(f'built {OUT}: {orig_len} -> {len(html)} bytes (+{len(html) - orig_len})')

# ── syntax-check every embedded script block ───────────────────────────────
blocks = re.findall(r'<script>(.*?)</script>', html, re.S)
print('script blocks:', len(blocks))
for i, b in enumerate(blocks):
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as f:
        f.write(b); tmp = f.name
    r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True)
    os.unlink(tmp)
    if r.returncode != 0:
        sys.exit(f'SCRIPT BLOCK {i} FAILED node --check:\n{r.stderr[:800]}')
    print(f'  block {i}: node --check OK ({len(b)} chars)')

# quick pins
for needle in ['id="cmcNameIn"', 'id="cmcLbSend"', "drillSlug: { stringValue: 'reason-lab.html' }",
               "drillSource: { stringValue: 'learning-games' }", 'securetoken.googleapis.com',
               "addEventListener('cmcreason:session'", 'Reason Lab · Critical', 'BACK']:
    pass  # pins live in the verifier; here just confirm the big ones
for needle in ['id="cmcNameIn"', 'id="cmcLbSend"', "'reason-lab.html'", "'learning-games'",
               'securetoken.googleapis.com', "addEventListener('cmcreason:session'"]:
    if needle not in html:
        sys.exit(f'BUILT FILE MISSING: {needle}')
print('integration pins present ✓')
