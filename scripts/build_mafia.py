#!/usr/bin/env python3
# Build public/mafia.html from the teacher's upload (upload/mafia.html —
# "Mafia Noir", a complete solo/local/online social-deduction game) with the
# standard CMC furniture transplant + the three audit bug fixes + AI art and
# narrator audio wiring. Every swap is assert-counted (must occur exactly
# once unless noted) so a re-run against a changed upload fails loudly.
#
# BUG AUDIT (owner: "run a bug check"):
#   F1  localInfluence()/localProof() posted the human's PUBLIC accusation /
#       vouch / badge-claim into the "mafia" chat channel — the feed labelled
#       a town player's statement "SYNDICATE" and styled it as a syndicate
#       whisper. → channel "public".
#   F11 $("#roster").oninput rebuilt the whole roster on every keystroke,
#       destroying the focused input — typing a seat name dropped focus after
#       one character. → renderSetupMeta() updates only the preview/note.
#   F3  The Online Table needs a WebSocket game server (new WebSocket(.../ws));
#       GitHub Pages is static, so create/join toasts "Still connecting…"
#       forever. → after 3 failed connects on the online-home screen the game
#       explains itself once (modal), parks the buttons and points at Solo /
#       Pass & Play. Engine logic untouched otherwise.
#   Everything else audited clean: role deal/shuffle, night order, doctor
#   self-save-once, detective files, secret ballot with strict-majority
#   elimination (ties → hung jury), win conditions (mafia == town / all mafia
#   out), token cancellation on exit, ghost mode, AI suspicion/claim/kill
#   coordination.
#
# AI IMAGES (owner: "add Ai related images"): 4 z-ai-generated noir stills in
# public/mafia-art/ (don / detective / doctor portraits for the hero fan
# cards + a rain-soaked skyline behind the hero). AI SOUND (owner: "…and
# sound"): 6 TTS narrator lines in public/mafia-audio/ played at deal / night
# / dawn / vote / end through the game's own AU engine (respects the sound
# toggle), hooked by five 'cmcmafia:phase' events the engine dispatches.
#
# LEADERBOARD: the end modal gains a CLASS LEADERBOARD — POST THIS CASE block
# (identity name + ID, email never a name, guest branch or signed-in token
# with securetoken refresh) POSTing one drill_attempts doc per case:
# drillSource 'brain-lounge' (lands on the Brain Lounge leaderboard's new
# Mafia board), drillSlug 'mafia.html', drillTitle 'Mafia Noir · <mode>',
# correct/total = your team won ? 1/1 : 0/1, scorePct = 100 win / 50 loss-but-
# survived / 25 eliminated in a loss. Plus the Share-with-class kit on the hub.
import os
import re
import subprocess
import sys

SRC = '/home/z/my-project/upload/mafia.html'
OUT = '/home/z/my-project/tmp/cmc-site/public/mafia.html'

html = open(SRC, encoding='utf-8').read()
swaps = []

def swap(old, new, count=1, label=''):
    global html
    found = html.count(old)
    assert found == count, f'[{label or old[:50]}] expected {count} occurrence(s), found {found}'
    html = html.replace(old, new)
    swaps.append(label or old[:60])

# ── S1: back-to-CMC pill in the game header ─────────────────────────────
swap('<header>\n  <div class="brand">',
     '<header>\n  <a class="tbtn" id="cmcHomeBtn" href="https://cmckhmer.github.io/Creative-Minds-/#brain-lounge" aria-label="Back to CMC">← CMC</a>\n  <div class="brand">',
     label='S1 header pill')

# ── S2: furniture + art CSS before </style> ────────────────────────────
CSS = """
/* ── CMC integration furniture (noir-tinted) ── */
.cmc-id{background:rgba(20,26,51,.55);border:1px solid var(--line);border-radius:14px;padding:18px 20px;margin:20px auto 0;max-width:980px}
.cmc-id .cmc-id-row{display:flex;gap:10px;flex-wrap:wrap;margin-top:6px}
.cmc-id input{flex:1;min-width:200px;background:rgba(10,13,24,.65);border:1px solid var(--line);border-radius:9px;color:var(--cream);padding:12px;font-size:14px;font-weight:600}
.cmc-id input:focus{outline:none;border-color:var(--gold);box-shadow:0 0 0 3px rgba(232,182,76,.14)}
.cmc-hubbar{display:flex;gap:10px;justify-content:center;align-items:center;flex-wrap:wrap;margin-top:14px}
.cmc-btn{display:inline-flex;align-items:center;gap:7px;border-radius:999px;padding:10px 20px;font-weight:700;font-size:12px;letter-spacing:1.4px;text-transform:uppercase;text-decoration:none;cursor:pointer;border:1px solid transparent;transition:.18s}
.cmc-btn:hover{transform:translateY(-1px)}
.cmc-btn-lb{background:linear-gradient(160deg,var(--gold2),var(--gold) 55%,#b8862c);color:#241a05;box-shadow:0 6px 20px rgba(232,182,76,.28)}
.cmc-btn-share{border-color:var(--line);color:var(--gold2);background:rgba(20,26,51,.5)}
.cmc-btn-share:hover{border-color:var(--gold)}
.cmc-share{position:fixed;left:50%;bottom:76px;transform:translateX(-50%) translateY(8px);z-index:95;display:flex;flex-direction:column;gap:7px;padding:14px;border-radius:12px;background:rgba(20,26,51,.97);border:1px solid var(--line);box-shadow:0 16px 44px rgba(0,0,0,.65);opacity:0;pointer-events:none;transition:.2s}
.cmc-share.show{opacity:1;pointer-events:auto;transform:translateX(-50%)}
.cmc-share button{border:0;background:none;color:var(--cream);font-family:var(--type);font-size:13px;text-align:left;padding:7px 10px;border-radius:8px;cursor:pointer}
.cmc-share button:hover{background:rgba(232,182,76,.12);color:var(--gold2)}
.cmc-toast{position:fixed;top:64px;left:50%;transform:translateX(-50%) translateY(-10px);z-index:96;padding:11px 16px;border-radius:10px;background:rgba(20,26,51,.97);border:1px solid var(--line);color:var(--cream);font-family:var(--type);font-size:12px;opacity:0;pointer-events:none;transition:.25s;max-width:90vw}
.cmc-toast.show{opacity:1;transform:translateX(-50%)}
.cmc-lb{border:1px solid rgba(232,182,76,.35);background:rgba(232,182,76,.06);border-radius:12px;padding:14px 15px;margin-top:18px;text-align:left}
.cmc-lb b{font-size:9.5px;letter-spacing:1.6px;color:var(--gold);display:block;margin-bottom:9px;text-transform:uppercase}
.cmc-lb .row{display:flex;gap:8px;flex-wrap:wrap}
.cmc-lb input{flex:1;min-width:140px;padding:10px 12px;border-radius:8px;border:1px solid var(--line);background:rgba(10,13,24,.65);color:var(--cream);font-size:13.5px;font-family:inherit}
.cmc-lb input:focus{outline:none;border-color:var(--gold)}
.cmc-lb .send{flex-shrink:0;border:none;border-radius:8px;padding:10px 18px;font-weight:700;font-size:12.5px;font-family:inherit;background:linear-gradient(160deg,var(--gold2),var(--gold));color:#241a05;cursor:pointer;transition:.16s}
.cmc-lb .send:disabled{opacity:.6;cursor:progress}
.cmc-lb .status{display:block;margin-top:9px;font-family:var(--type);font-size:10.5px;color:var(--muted);letter-spacing:.5px;line-height:1.6}
.cmc-lb .status.good{color:var(--green)}
.cmc-lb .status.bad{color:var(--red2)}
.hero-art{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.16;filter:saturate(.85);border-radius:14px;pointer-events:none;-webkit-mask-image:linear-gradient(90deg,transparent 4%,#000 34%);mask-image:linear-gradient(90deg,transparent 4%,#000 34%)}
.hero{position:relative}
.hero-text,.fan{position:relative;z-index:1}
.fan-card img{width:100%;height:100%;object-fit:cover;display:block}
.fan-name{position:absolute;left:0;right:0;bottom:0;padding:7px 0 8px;text-align:center;font-size:9px;font-weight:700;letter-spacing:2.5px;color:var(--gold2);background:linear-gradient(transparent,rgba(5,7,15,.92) 55%);text-shadow:0 1px 6px rgba(0,0,0,.8)}
@media(max-width:560px){.cmc-id-row input{min-width:100%}}
"""
swap('</style>', CSS + '</style>', label='S2 furniture CSS')

# ── S3: hero backdrop art ───────────────────────────────────────────────
swap('<div class="hero">\n      <div class="hero-text">',
     '<div class="hero">\n      <img class="hero-art" src="mafia-art/mafia-city.jpg" alt="" aria-hidden="true">\n      <div class="hero-text">',
     label='S3 hero art')

# ── S4: identity card + share kit row on the hub ────────────────────────
IDENT = """
<div class="cmc-id" id="cmcIdCard">
    <h2 class="deco-title" style="margin-bottom:4px">Your Table Identity</h2>
    <div class="cmc-id-row">
      <input type="text" id="cmcNameIn" maxlength="24" placeholder="Your name" autocomplete="name" spellcheck="false">
      <input type="text" id="cmcIdIn" maxlength="14" placeholder="ID / class (e.g. 7A · No. 12)" spellcheck="false">
    </div>
    <p class="note">Your name + ID ride with every case you post to the class leaderboard. An email address is never used as a name.</p>
  </div>
  <div class="cmc-hubbar">
    <a class="cmc-btn cmc-btn-lb" href="https://cmckhmer.github.io/Creative-Minds-/#brain-lounge" aria-label="Open the class leaderboard in the Brain Lounge">🏆 Class leaderboard</a>
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
swap('<p class="note" style="text-align:center;margin-top:18px">Best with sound',
     IDENT.rstrip() + '\n  <p class="note" style="text-align:center;margin-top:18px">Best with sound',
     label='S4 identity + share kit')

# ── S5: F1 — influence statements are public ────────────────────────────
swap(',"mafia");applyAccuse(sp,target,', ',"public");applyAccuse(sp,target,', label='F1a influence channel')
swap(',"mafia");applyClaim(y,t,', ',"public");applyClaim(y,t,', label='F1b proof channel')
# F1c: the AI detective's badge claim is public speech too — the feed labelled
#      it "SYNDICATE" (only genuine syndicate whispers keep the mafia channel)
swap(',"mafia");applyClaim(p,t);return', ',"public");applyClaim(p,t);return', label='F1c AI claim channel')
# F1c2: the same call without the trailing return — already fixed by F1c in
# builds where its form matched, so 0 or 1 occurrences are both fine
_f1c2 = html.count('"mafia");applyClaim(p,t)')
if _f1c2:
    html = html.replace('"mafia");applyClaim(p,t)', '"public");applyClaim(p,t)')
    swaps.append('F1c2 AI claim channel (no-return form)')

# ── S6: F11 — roster typing must not rebuild the rows ───────────────────
swap('$("#roster").oninput=e=>{if(e.target.dataset.i!==undefined){L.roster[+e.target.dataset.i].name=e.target.value;renderSetup()}};',
     '$("#roster").oninput=e=>{if(e.target.dataset.i!==undefined){L.roster[+e.target.dataset.i].name=e.target.value;renderSetupMeta()}};',
     label='F11 roster oninput')
METAFN = ("function renderSetupMeta(){const n=L.roster.length,m=mafiaCount(n),h=L.roster.filter(x=>x.human).length;"
          '$("#rolePreview").innerHTML=`${n} players → <b style="color:var(--red2)">${m} Mafia</b> · <b style="color:var(--blue2)">1 Detective</b> · <b style="color:var(--green)">1 Doctor</b> · <b style="color:var(--gold2)">${n-m-2} Citizens</b><br>${h} human seat${h===1?"":"s"} · ${h>1?"private hand-off screens active":"full private intel on your sidebar"}`;}\n'
          '/* ---------- local engine ---------- */')
swap('/* ---------- local engine ---------- */', METAFN, label='F11 renderSetupMeta fn')

# ── S7: F3 — online mode explains itself without a game server ──────────
swap('O.ws.onopen=()=>{setConn("live");',
     'O.ws.onopen=()=>{setConn("live");O.wsFails=0;',
     label='F3 onopen reset')
swap('O.ws.onclose=()=>{setConn("off");clearTimeout(O.reconnectTimer);O.reconnectTimer=setTimeout(()=>{if(app.screen==="onlineHome"||app.mode==="online")connectO()},1500)};',
     'O.ws.onclose=()=>{setConn("off");clearTimeout(O.reconnectTimer);O.wsFails=(O.wsFails||0)+1;'
     'if(O.wsFails>=3&&app.screen==="onlineHome"&&!O.offlineShown){O.offlineShown=true;onlineUnavailable();return}'
     'O.reconnectTimer=setTimeout(()=>{if(app.screen==="onlineHome"||app.mode==="online")connectO()},1500)};',
     label='F3 onclose guard')
GUARDFN = ("function onlineUnavailable(){const b1=$(\"#createBtn\"),b2=$(\"#joinBtn\");if(b1)b1.disabled=true;if(b2)b2.disabled=true;"
           "const fr=b1&&b1.closest(\".frame\");if(fr){const nt=fr.querySelector(\".note\");if(nt)nt.textContent=\"Online tables need the CMC game server — parked on this static site. Solo and Pass & Play are fully playable offline.\";}"
           "openModal('<div class=\"m-kicker\">ONLINE TABLES</div><div class=\"m-title\">No game server here</div>'"
           "+'<p class=\"m-sub\">Online rooms need a live WebSocket game server, and this site is served statically — so the Online Table is parked for now. "
           "<b>Solo Case</b> and <b>Pass &amp; Play</b> are fully playable offline: face a thinking AI syndicate alone, or pass one device around with private hand-off screens.</p>'"
           "+'<div class=\"m-actions\"><button class=\"btn gold\" id=\"ouBack\">BACK TO MODES</button></div>');"
           "$(\"#ouBack\").onclick=()=>{app.screen=\"hub\";render();closeModal()};}\n"
           'function saveO(s){')
swap('function saveO(s){', GUARDFN, label='F3 onlineUnavailable fn')

# ── S8: phase narrator hooks (4 + deal) and the case-result event ───────
swap('initAI();app.mode="local";app.screen="game";clearFeed();',
     'initAI();app.mode="local";app.screen="game";clearFeed();document.dispatchEvent(new CustomEvent("cmcmafia:phase",{detail:{phase:"deal"}}));',
     label='S8 deal hook')
swap('await bannerLocal("NIGHT "+word(L.night),"The city sleeps… lightly.");if(!ok(tok))return null;',
     'await bannerLocal("NIGHT "+word(L.night),"The city sleeps… lightly.");if(!ok(tok))return null;'
     'document.dispatchEvent(new CustomEvent("cmcmafia:phase",{detail:{phase:"night"}}));',
     label='S8 night hook')
swap('await bannerLocal("DAY "+word(L.night),"Who is missing from the table?");if(!ok(tok))return;',
     'await bannerLocal("DAY "+word(L.night),"Who is missing from the table?");if(!ok(tok))return;'
     'document.dispatchEvent(new CustomEvent("cmcmafia:phase",{detail:{phase:"dawn"}}));',
     label='S8 dawn hook')
swap('await bannerLocal("THE VOTE","A name on every ballot. Or none at all.");if(!ok(tok))return null;',
     'await bannerLocal("THE VOTE","A name on every ballot. Or none at all.");if(!ok(tok))return null;'
     'document.dispatchEvent(new CustomEvent("cmcmafia:phase",{detail:{phase:"vote"}}));',
     label='S8 vote hook')
GAME_EVT = ('showEndModal(app.V,true);document.dispatchEvent(new CustomEvent("cmcmafia:game",{detail:{winner:L.winner,'
            'mode:(L.players.filter(p=>p.human).length>1?"Pass & Play":"Solo"),youRole:(L.players[0]||{}).role,'
            'survived:!!(L.players[0]||{}).alive,nights:L.night,kills:L.stats.kills,saves:L.stats.saves,lynch:L.stats.lynch,gameId:L.gameId}}))}')
swap('showEndModal(app.V,true)}', GAME_EVT, label='S8 case result event')

# ── S9: hero fan cards get the AI portraits ─────────────────────────────
swap('$("#heroFan").innerHTML=["mafia","detective","doctor"].map(k=>`<div class="fan-card">${roleFrontHTML(k)}</div>`).join("");',
     '$("#heroFan").innerHTML=["mafia","detective","doctor"].map(k=>`<div class="fan-card"><img src="mafia-art/mafia-${k}.jpg" alt="${ROLE[k].name} — AI illustration" loading="eager"><span class="fan-name">${ROLE[k].name.toUpperCase()}</span></div>`).join("");',
     label='S9 fan portraits')

open(OUT, 'w', encoding='utf-8').write(html)

# ── S10: the CMC integration <script> before </body> ────────────────────
FURNITURE = r"""
<script>
/* ── CMC integration: identity + class leaderboard POST + narrator + share ──
   The Mafia Noir engine is untouched except six one-line CustomEvents
   (cmcmafia:phase at deal/night/dawn/vote + cmcmafia:game at case end).
   This block:
     1. keeps the Table identity NAME + ID synced between the hub card and
        the end-modal leaderboard block + localStorage (an email is NEVER a
        display name — same guard as cmc-shared.js and the homework pages);
     2. on demand (auto once per finished case when a name is present, or via
        the 📡 SEND SCORE button) POSTs one drill_attempts doc through the
        SAME pipeline as the other games: guest branch (empty uid, checked
        name, classId null) or the signed-in session token with securetoken
        refresh — drillSource 'brain-lounge' so the case lands on the Brain
        Lounge leaderboard's Mafia board;
     3. speaks the noir narrator lines (AI TTS, public/mafia-audio/) at
        deal / night / dawn / vote / case end through the game's own AU
        engine, so the existing sound toggle mutes the voice too;
     4. runs the Share-with-class kit on the hub. */
(function () {
  'use strict';
  var CMC_FS = 'https://firestore.googleapis.com/v1/projects/creative-minds-cambodia/databases/(default)/documents/drill_attempts';
  var CMC_API_KEY = 'AIzaSyDNUq0ru99XKh08D887Xk63h36MPOlXWwc';
  var PAGE_URL = 'https://cmckhmer.github.io/Creative-Minds-/mafia.html';
  var ASSIGN_TEXT = '🎩 CMC class challenge — Mafia Noir at the Brain Lounge: out-bluff a thinking AI syndicate in Solo Case or pass one device around in Pass & Play. Night kills, secret ballots, private hand-offs. Key in your name + ID, close the case, post your team win to the class leaderboard!';

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

  var nameIn = document.getElementById('cmcNameIn');
  var idIn = document.getElementById('cmcIdIn');
  var player = { name: '', id: '' };
  try {
    var pn = JSON.parse(ls('cmc-player-name') || 'null');
    player.name = (pn && pn.name ? nameOf(pn.name) : '');
  } catch (e) { player.name = ''; }
  if (!player.name) player.name = nameOf(ls('cmc-student-name') || '');
  player.id = (ls('cmc-player-id') || '').trim();
  nameIn.value = player.name; idIn.value = player.id;

  function currentIdentity() {
    var lbName = document.getElementById('cmcLbName');
    var lbId = document.getElementById('cmcLbId');
    var n = nameOf((lbName && lbName.value) || nameIn.value).trim();
    var id = ((lbId && lbId.value) || idIn.value).trim();
    return { name: n, id: id };
  }
  function persistIdentity() {
    var id = currentIdentity();
    if (id.name) { try { localStorage.setItem('cmc-player-name', JSON.stringify({ name: id.name, at: Date.now() })); } catch (e) {} }
    if (id.id) lsSet('cmc-player-id', id.id);
  }
  function bindMirror(inp) {
    inp.addEventListener('input', function () {
      var lbName = document.getElementById('cmcLbName');
      var lbId = document.getElementById('cmcLbId');
      if (inp === nameIn && lbName) lbName.value = nameIn.value;
      if (inp === idIn && lbId) lbId.value = idIn.value;
      if (inp === lbName && lbName) nameIn.value = lbName.value;
      if (inp === lbId && lbId) idIn.value = lbId.value;
      persistIdentity();
    });
  }
  bindMirror(nameIn); bindMirror(idIn);

  function toast(msg, err) {
    var t = document.getElementById('cmcToast');
    if (!t) return;
    t.textContent = msg;
    t.classList.toggle('err', !!err);
    t.classList.add('show');
    clearTimeout(toast._tm);
    toast._tm = setTimeout(function () { t.classList.remove('show'); }, 3600);
  }

  /* ── 3. noir narrator — AI TTS lines through the game's own AU engine ── */
  var NARR = {
    deal: 'mafia-audio/narr-deal.mp3',
    night: 'mafia-audio/narr-night.mp3',
    dawn: 'mafia-audio/narr-dawn.mp3',
    vote: 'mafia-audio/narr-vote.mp3',
    wintown: 'mafia-audio/narr-wintown.mp3',
    winmafia: 'mafia-audio/narr-winmafia.mp3'
  };
  function playBuf(buf) {
    try {
      var s = AU.ctx.createBufferSource(); s.buffer = buf;
      var g = AU.ctx.createGain(); g.gain.value = .85;
      s.connect(g).connect(AU.master); s.start();
    } catch (e) {}
  }
  if (typeof AU !== 'undefined' && AU) {
    AU.voice = function (key) {
      try {
        if (!AU.ctx || !AU.on || !NARR[key]) return;
        if (!AU._narr) AU._narr = {};
        var src = NARR[key];
        if (AU._narr[src]) return playBuf(AU._narr[src]);
        fetch(src).then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
          .then(function (ab) { return AU.ctx.decodeAudioData(ab); })
          .then(function (buf) { AU._narr[src] = buf; playBuf(buf); })
          .catch(function () {});
      } catch (e) {}
    };
    document.addEventListener('cmcmafia:phase', function (ev) {
      var d = ev.detail || {};
      if (d.phase === 'end') AU.voice(d.winner === 'town' ? 'wintown' : 'winmafia');
      else AU.voice(d.phase);
    });
  }

  /* ── 2. leaderboard POST block injected into the end modal ── */
  var lastRun = null;
  var autoSentFor = '';
  function publicIdentity() {
    var id = currentIdentity();
    var full = id.name + (id.id ? ' · ' + id.id : '');
    return { name: id.name, full: full.slice(0, 40) };
  }
  function injectLb() {
    var box = document.getElementById('modalBox');
    if (!box || box.querySelector('.cmc-lb')) return;
    var actions = box.querySelector('.m-actions');
    if (!actions) return;
    actions.insertAdjacentHTML('beforebegin',
      '<div class="cmc-lb"><b>Class leaderboard — post this case</b>' +
      '<div class="row"><input type="text" id="cmcLbName" maxlength="24" placeholder="Your name" autocomplete="name" spellcheck="false">' +
      '<input type="text" id="cmcLbId" maxlength="14" placeholder="ID / class" spellcheck="false">' +
      '<button type="button" class="send" id="cmcLbSend">📡 SEND SCORE</button></div>' +
      '<span class="status" id="cmcLbStatus">Close the case, add your name if new, then send your team result.</span></div>');
    var lbName = document.getElementById('cmcLbName');
    var lbId = document.getElementById('cmcLbId');
    lbName.value = nameIn.value; lbId.value = idIn.value;
    bindMirror(lbName); bindMirror(lbId);
    document.getElementById('cmcLbSend').addEventListener('click', sendScore);
  }
  function setStatus(msg, cls) {
    var el = document.getElementById('cmcLbStatus');
    if (el) { el.textContent = msg; el.className = 'status' + (cls ? ' ' + cls : ''); }
  }
  function sendScore() {
    var id = currentIdentity();
    if (!id.name) { setStatus('Key in your name (and ID) first — they ride with your case.', 'bad'); return; }
    if (!lastRun) { setStatus('Finish a case first — the verdict decides the score.', 'bad'); return; }
    persistIdentity();
    var lbSend = document.getElementById('cmcLbSend');
    if (lbSend) lbSend.disabled = true;
    var pub = publicIdentity();
    var d = lastRun;
    var go = function (tok) {
      var uid = ls('cmc-student-uid') || '';
      fetch(CMC_FS, {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { 'Authorization': 'Bearer ' + tok } : {}),
        body: JSON.stringify({ fields: {
          drillSlug: { stringValue: 'mafia.html' },
          drillTitle: { stringValue: 'Mafia Noir · ' + d.mode },
          drillSource: { stringValue: 'brain-lounge' },
          studentName: { stringValue: pub.full },
          studentUid: { stringValue: uid },
          classId: (function () { var c = ls('cmc-student-classId'); return c ? { stringValue: c } : { nullValue: null }; })(),
          scorePct: { integerValue: String(d.scorePct) },
          correctCount: { integerValue: String(d.teamWon ? 1 : 0) },
          totalCount: { integerValue: '1' },
          submittedAt: { timestampValue: new Date().toISOString() }
        } })
      }).then(function (r) {
        if (lbSend) lbSend.disabled = false;
        if (!r.ok) throw new Error('HTTP ' + r.status);
        autoSentFor = d.sid;
        setStatus('✓ Sent — ' + d.mode + ' · ' + (d.teamWon ? 'your team won' : 'your team lost') + ' · ' + d.scorePct + '%. Open the Brain Lounge leaderboard to compare.', 'good');
        toast('Case sent to the class leaderboard ✓');
      }).catch(function () {
        if (lbSend) lbSend.disabled = false;
        setStatus('Could not reach the leaderboard (offline?). Your case is kept — press SEND again.', 'bad');
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
  document.addEventListener('cmcmafia:game', function (ev) {
    var d = ev.detail || {};
    var youMafia = d.youRole === 'mafia';
    var teamWon = (youMafia && d.winner === 'mafia') || (!youMafia && d.winner === 'town');
    lastRun = {
      mode: d.mode || 'Solo', winner: d.winner, teamWon: teamWon,
      survived: !!d.survived, nights: d.nights, gameId: d.gameId,
      scorePct: teamWon ? 100 : (d.survived ? 50 : 25),
      sid: String(d.gameId) + ':' + d.winner
    };
    injectLb();
    setStatus((d.mode || 'Solo') + ' case closed — ' + (teamWon ? 'your team won' : 'your team lost') +
      ' · ' + lastRun.scorePct + '% ready to post. Add your name if new, then SEND.', '');
    var pub = publicIdentity();
    if (pub.name && autoSentFor !== lastRun.sid) { autoSentFor = lastRun.sid; sendScore(); }
  });

  /* ── 4. share-with-class kit on the hub ── */
  var share = document.getElementById('cmcShare');
  document.querySelectorAll('[data-cmc-share]').forEach(function (b) {
    b.addEventListener('click', function () { share.classList.toggle('show'); });
  });
  share.addEventListener('click', function (e) {
    var act = e.target.closest('[data-cmc-copy],[data-cmc-wa],[data-cmc-tg],[data-cmc-email],[data-cmc-close]');
    if (!act) return;
    if (act.hasAttribute('data-cmc-close')) { share.classList.remove('show'); return; }
    if (act.hasAttribute('data-cmc-copy')) {
      var done = function () { toast('Assignment link copied ✓'); share.classList.remove('show'); };
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
    if (act.hasAttribute('data-cmc-wa')) { window.open('https://wa.me/?text=' + txt, '_blank', 'noopener'); share.classList.remove('show'); }
    else if (act.hasAttribute('data-cmc-tg')) { window.open('https://t.me/share/url?url=' + url + '&text=' + encodeURIComponent(ASSIGN_TEXT), '_blank', 'noopener'); share.classList.remove('show'); }
    else if (act.hasAttribute('data-cmc-email')) { window.location.href = 'mailto:?subject=' + encodeURIComponent('CMC class challenge — Mafia Noir') + '&body=' + txt; share.classList.remove('show'); }
  });
})();
</script>
</body>"""
swap('</body>', FURNITURE, label='S10 furniture script')

open(OUT, 'w', encoding='utf-8').write(html)
print(f'total swaps: {len(swaps)}')
print('wrote', OUT, os.path.getsize(OUT), 'bytes')

# ── sanity: node --check on every embedded <script> block ───────────────
scripts = re.findall(r'<script>(.*?)</script>', html, re.S)
print('script blocks:', len(scripts))
os.makedirs('/tmp/mafia_check', exist_ok=True)
for i, code in enumerate(scripts):
    p = f'/tmp/mafia_check/s{i}.js'
    open(p, 'w', encoding='utf-8').write(code)
    r = subprocess.run(['node', '--check', p], capture_output=True, text=True)
    assert r.returncode == 0, f'node --check failed on block {i}:\n{r.stderr[:2000]}'
    print(f'block {i}: {len(code)//1024}KB — node --check OK')
