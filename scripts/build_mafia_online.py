#!/usr/bin/env python3
# Wire Mafia Noir's ONLINE mode to Firebase Firestore (owner: "need to link
# mafia online play to firebase"). Chains AFTER build_mafia.py (which already
# transplanted the furniture + the three bug fixes into public/mafia.html).
#
# The upload's online mode assumed a WebSocket server at /ws — GitHub Pages
# is static, so v65 parked the mode with an explanatory guard. This script
# replaces the transport with a Firestore-backed host-authoritative table:
#
#   mafia_rooms/{code}            room doc: hostUid, seats, config, seq and
#                                 the authoritative engine state mirrored
#                                 AES-GCM-ENCRYPTED (.engine) — the key lives
#                                 only in the host's localStorage, so a read
#                                 of the room doc never exposes roles.
#   mafia_rooms/{code}/views/{uid}   that player's PERSONAL view (own role,
#                                 syndicate team, detective files, filtered
#                                 feed). Rules: read = owner only.
#   mafia_rooms/{code}/actions/{uid} night action / ballot / chat / heartbeat.
#                                 Rules: write = owner only, read = owner or
#                                 the host (who validates every action).
#
# The client protocol is byte-identical to the upload: MN_FS feeds handleO()
# the same {joined|log|state|chat|error|left} messages, so the table, lobby,
# chat, banners and end modal render unchanged. Sign-in rides the site's
# existing cmc-student-* session (same as chess3d's REST rooms).
# firestore.rules gains a documented mafia_rooms block — the owner publishes
# it from the Firebase console (the file header documents the 2-minute paste).
import re
import subprocess

SRC = '/home/z/my-project/tmp/cmc-site/public/mafia.html'
OUT = SRC
SHIM = '/home/z/my-project/tmp/cmc-site/scripts/mafia_online_shim.js'
RULES = '/home/z/my-project/tmp/cmc-site/firestore.rules'

html = open(SRC, encoding='utf-8').read()
swaps = []

def swap(old, new, count=1, label=''):
    global html
    found = html.count(old)
    assert found == count, f'[{label or old[:60]}] expected {count} occurrence(s), found {found}'
    html = html.replace(old, new)
    swaps.append(label)

# ── W1: sendO routes into the Firestore shim ────────────────────────────
swap('function sendO(o){if(O.ws&&O.ws.readyState===WebSocket.OPEN)O.ws.send(JSON.stringify(o));else toast("Still connecting…")}',
     'function sendO(o){MN_FS.send(o)}',
     label='W1 sendO → MN_FS')

# ── W2: connectO = the shim (no WebSocket; resume via mnSession) ────────
i = html.find('function connectO(){')
assert i > 0, 'connectO missing'
j = html.find('function handleO(m){')
assert j > i, 'handleO anchor missing'
html = html[:i] + 'function connectO(){MN_FS.connect()}\n' + html[j:]
swaps.append('W2 connectO → MN_FS')

# ── W3: the parked-table guard becomes the SIGN-IN gate ─────────────────
i = html.find('function onlineUnavailable(){')
assert i > 0, 'onlineUnavailable missing'
tail = 'closeModal()};}'  # the arrow-body brace + the function's closing brace
j = html.find(tail, html.find('$("#ouBack").onclick')) + len(tail)
NEW_GUARD = (
 'function onlineUnavailable(kind){'
 'setConn("off");'
 'var denied=kind==="denied",unver=false;try{unver=denied&&localStorage.getItem("cmc-student-verified")==="0"}catch(e){}'
 'openModal("<div class=\'m-kicker\'>ONLINE TABLES</div><div class=\'m-title\'>"+(unver?"Verify your email first":denied?"Online tables are not switched on":"Sign in to play online")+"</div>"'
 '+(unver'
 '?"<p class=\'m-sub\'>Online tables only accept CMC accounts with a <b>verified email address</b>. Open the verification link CMC sent to your inbox, sign in again on the CMC site, then come back.<br><br>Solo Case and Pass &amp; Play work without it.</p>"'
 ':denied'
 '?"<p class=\'m-sub\'>You are signed in, but the CMC database refused the request. Either your email address is not verified yet (check your inbox, then sign in again), or the site owner has not published the database rules for Mafia rooms.<br><br>Solo Case and Pass &amp; Play work in the meantime.</p>"'
 ':"<p class=\'m-sub\'>Online rooms run on CMC accounts — roles, votes and the case file are tied to real players. <b>Sign in on the CMC site</b> (header → account), then come back and open or join a table.<br><br>Solo Case and Pass &amp; Play work without an account.</p>")'
 '+"<div class=\'m-actions\'><a class=\'btn gold\' href=\'https://cmckhmer.github.io/Creative-Minds-/\' style=\'text-decoration:none\'>SIGN IN ON CMC →</a><button class=\'btn dim\' id=\'ouBack\'>BACK TO MODES</button></div>");'
 '$("#ouBack").onclick=()=>{app.screen="hub";render();closeModal()};}')
html = html[:i] + NEW_GUARD + html[j:]
swaps.append('W3 onlineUnavailable → sign-in gate')

# ── W4: inject the MN_FS shim before the furniture <script>'s siblings ──
shim = open(SHIM, encoding='utf-8').read().strip()
shim_block = '<script>\n' + shim + '\n</script>\n</body>'
swap('</body>', shim_block, label='W4 shim injected')

# ── W6: the host pace selects were DEAD (audit find, v67) ───────────────
# The create form's Night/Discussion/Ballot selects (cfgNight/cfgDay/cfgVote)
# were never read by the engine — every room ran the shim defaults
# (night 90s / day 150s / vote 45s) no matter what the host picked. The shim
# already accepts {type:'config', key, value} from the host during the lobby
# (clamped 10-300s); this wires the UI to it: on entering the lobby the host
# pushes the three select values once, and again whenever a select changes.
# connectO clears the memo so a NEW room re-pushes even with unchanged picks.
swap('function connectO(){MN_FS.connect()}',
     'function connectO(){O._cfgKey=null;MN_FS.connect()}',
     label='W6a config memo reset on connect')
swap('function renderOnlineLobby(){const V=app.V,host=V.room.hostId===O.session?.playerId;',
     'function renderOnlineLobby(){const V=app.V,host=V.room.hostId===O.session?.playerId;'
     'if(host&&V.room.phase==="lobby"){const ck=["night","day","vote"].map(k=>$("#cfg"+k.charAt(0).toUpperCase()+k.slice(1))).map(el=>el?el.value:"").join("|");'
     'if(O._cfgKey!==ck){O._cfgKey=ck;["night","day","vote"].forEach((k,i)=>{const v=ck.split("|")[i];if(v)sendO({type:"config",key:k,value:+v})})}}',
     label='W6b pace selects → shim config')

open(OUT, 'w', encoding='utf-8').write(html)
print(f'total swaps: {len(swaps)}')
for s in swaps: print('  •', s)
print('wrote', OUT)

# ── W5: firestore.rules — mafia_rooms block (idempotent) ────────────────
rules = open(RULES, encoding='utf-8').read()
if 'match /mafia_rooms/{roomId}' not in rules:
    BLOCK = '''
    // ONLINE MAFIA ROOMS (Nov 2026): the hidden-information table for Mafia
    // Noir (public/mafia.html, Brain Lounge bay 04) — the Firestore transport
    // that replaced the WebSocket server the upload assumed. Same identity
    // discipline as chess_rooms: verified players only, host owns the doc.
    // Two subcollections chess never needed, because mafia is HIDDEN-info:
    //   views/{uid}  — that player's PERSONAL view (own role, syndicate team,
    //                  detective files, channel-filtered chat). Readable ONLY
    //                  by that player; the host device writes them all. A
    //                  town player's view never carries another player's role.
    //   actions/{uid} — night action / ballot / chat / heartbeat. Players
    //                  write only their own; the host reads them to resolve
    //                  the phase and validates eligibility client-side.
    // The authoritative engine state is mirrored into the room doc's .engine
    // field AES-GCM-ENCRYPTED — the key lives only in the host's localStorage
    // — so even the room doc (readable by every verified player, like
    // chess_rooms) never carries a readable role.
    match /mafia_rooms/{roomId} {
      allow read: if isVerifiedUser();
      allow create: if isVerifiedUser()
        && request.resource.data.code == roomId
        && request.resource.data.hostUid == request.auth.uid
        && request.resource.data.hostName is string
        && request.resource.data.status == 'open'
        && request.resource.data.engine is string;
      allow update: if isVerifiedUser()
        && request.auth.uid == resource.data.hostUid;
      allow delete: if isVerifiedUser()
        && request.auth.uid == resource.data.hostUid;

      match /views/{uid} {
        allow read: if isVerifiedUser() && request.auth.uid == uid;
        allow create, update: if isVerifiedUser()
          && request.auth.uid == get(/databases/$(database)/documents/mafia_rooms/$(roomId)).data.hostUid;
        allow delete: if isVerifiedUser()
          && request.auth.uid == get(/databases/$(database)/documents/mafia_rooms/$(roomId)).data.hostUid;
      }
      match /actions/{uid} {
        allow read: if isVerifiedUser()
          && (request.auth.uid == uid
              || request.auth.uid == get(/databases/$(database)/documents/mafia_rooms/$(roomId)).data.hostUid);
        allow create, update: if isVerifiedUser() && request.auth.uid == uid;
        allow delete: if isVerifiedUser()
          && request.auth.uid == get(/databases/$(database)/documents/mafia_rooms/$(roomId)).data.hostUid;
      }
    }
'''
    anchor = '    // ── STUDIO SHARED DOCS & WORKSHEETS (Nov 2026) ──'
    assert anchor in rules, 'rules anchor missing'
    rules = rules.replace(anchor, BLOCK + '\n' + anchor)
    open(RULES, 'w', encoding='utf-8').write(rules)
    print('firestore.rules: mafia_rooms block ADDED (owner publishes via console — 2 min paste)')
else:
    print('firestore.rules: mafia_rooms block already present')

# ── sanity: every embedded <script> block parses ────────────────────────
scripts = re.findall(r'<script>(.*?)</script>', html, re.S)
os_makedirs = __import__('os').makedirs
os_makedirs('/tmp/mafia_check2', exist_ok=True)
for i, code in enumerate(scripts):
    p = f'/tmp/mafia_check2/s{i}.js'
    open(p, 'w', encoding='utf-8').write(code)
    r = subprocess.run(['node', '--check', p], capture_output=True, text=True)
    assert r.returncode == 0, f'node --check failed on block {i}:\n{r.stderr[:2000]}'
print(f'script blocks: {len(scripts)} — node --check OK')
