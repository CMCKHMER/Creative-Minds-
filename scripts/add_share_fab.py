#!/usr/bin/env python3
"""Inject the CMC share-with-class floating kit into standalone game pages that
have no share UI of their own (owner request, Nov 2026: "implement a share
button for each game or assignment").

Targets: voice-quest.html, word-forge.html, writequest.html,
syntax-clash-pro.html, arcade/galica/index.html.
(the rfc worksheets + toefl-ibt + biweek tests + homework pages already carry
share UI; cryo-lockdown + dev-pick-ghost-mountain ship the bottom-bar kit).

The kit is a bottom-left floating button (📣): native share sheet on phones,
Copy Link / WhatsApp / Telegram / Email panel on desktop, tiny toast, Escape
closes, print-hidden. Idempotent: files already carrying the fab are skipped.
"""
import re
import sys
from pathlib import Path

ROOT = Path('/home/z/my-project/tmp/cmc-site/public')
TARGETS = [
    ROOT / 'voice-quest.html',
    ROOT / 'word-forge.html',
    ROOT / 'writequest.html',
    ROOT / 'syntax-clash-pro.html',
    ROOT / 'arcade' / 'galica' / 'index.html',
]

BLOCK = '''<!-- CMC share-with-class kit (owner: a share button for each game or assignment) -->
<style>#cmc-share-fab{position:fixed;left:14px;bottom:14px;z-index:99990;width:46px;height:46px;border-radius:14px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .25s;box-shadow:0 8px 24px rgba(0,0,0,.35);font-size:17px;background:linear-gradient(135deg,#38bdf8,#6366f1);color:#fff;border:1px solid rgba(255,255,255,.18)}
#cmc-share-fab:hover{transform:translateY(-2px) scale(1.05);box-shadow:0 12px 30px rgba(56,189,248,.4)}
#cmc-share-fab-panel{position:fixed;left:14px;bottom:68px;z-index:99990;min-width:230px;padding:10px;border-radius:14px;background:rgba(15,23,42,.96);backdrop-filter:blur(16px);border:1px solid rgba(56,189,248,.25);box-shadow:0 12px 40px rgba(0,0,0,.5);color:#f1f5f9;font-family:'Inter',system-ui,sans-serif;display:none}
#cmc-share-fab-panel.open{display:block}
#cmc-share-fab-panel button{display:block;width:100%;text-align:left;padding:10px 12px;margin-top:6px;border-radius:9px;border:1px solid rgba(148,163,184,.22);background:rgba(255,255,255,.04);color:#e2e8f0;font:600 13px 'Inter',system-ui,sans-serif;cursor:pointer}
#cmc-share-fab-panel button:hover{border-color:#38bdf8}
#cmc-share-fab-toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%) translateY(10px);z-index:99995;background:#0d1930;color:#e2e8f0;border:1px solid rgba(56,189,248,.4);border-radius:999px;padding:9px 18px;font:600 13px 'Inter',system-ui,sans-serif;opacity:0;pointer-events:none;transition:.25s;max-width:92vw}
#cmc-share-fab-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
@media print{#cmc-share-fab,#cmc-share-fab-panel,#cmc-share-fab-toast{display:none!important}}</style>
<button id="cmc-share-fab" aria-label="Share this game with your class" aria-haspopup="true">📣</button>
<div id="cmc-share-fab-panel" role="menu" aria-label="Share options">
  <div style="font-size:10px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#67e8f9;padding:4px 8px 2px">Share with class</div>
  <button type="button" data-c="copy">🔗 Copy game link</button>
  <button type="button" data-c="wa">💬 WhatsApp</button>
  <button type="button" data-c="tg">✈️ Telegram</button>
  <button type="button" data-c="em">✉️ Email</button>
  <button type="button" data-c="close">✕ Close</button>
</div>
<div id="cmc-share-fab-toast" role="status" aria-live="polite"></div>
<script>(function(){var T=document.title.split('—')[0].trim()||document.title;var U=location.href;var TXT='🎮 '+T+' — play on CMC';
function toast(m){var t=document.getElementById('cmc-share-fab-toast');t.textContent=m;t.classList.add('show');clearTimeout(t._h);t._h=setTimeout(function(){t.classList.remove('show')},2600);}
var fab=document.getElementById('cmc-share-fab'),panel=document.getElementById('cmc-share-fab-panel');
fab.addEventListener('click',function(){if(navigator.share){navigator.share({title:T,text:TXT,url:U}).catch(function(){});return;}panel.classList.toggle('open');});
panel.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;var c=b.getAttribute('data-c');
if(c==='close'){panel.classList.remove('open');}
else if(c==='copy'){var done=function(){toast('Game link copied \\u2713');panel.classList.remove('open');};
if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(U).then(done,function(){try{var ta=document.createElement('textarea');ta.value=U;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();done();}catch(err){toast('Copy failed \\u2014 long-press the URL');}});}else{try{var ta2=document.createElement('textarea');ta2.value=U;document.body.appendChild(ta2);ta2.select();document.execCommand('copy');ta2.remove();done();}catch(err2){toast('Copy failed \\u2014 long-press the URL');}}}
else if(c==='wa'){window.open('https://wa.me/?text='+encodeURIComponent(TXT+' '+U),'_blank','noopener');panel.classList.remove('open');}
else if(c==='tg'){window.open('https://t.me/share/url?url='+encodeURIComponent(U)+'&text='+encodeURIComponent(TXT),'_blank','noopener');panel.classList.remove('open');}
else if(c==='em'){location.href='mailto:?subject='+encodeURIComponent(T)+'&body='+encodeURIComponent(TXT+'\\n'+U);panel.classList.remove('open');}});
document.addEventListener('keydown',function(e){if(e.key==='Escape')panel.classList.remove('open');});})();</script>
'''

def main() -> int:
    failures = 0
    for path in TARGETS:
        html = path.read_text(encoding='utf-8')
        if 'cmc-share-fab' in html:
            print(f'  skip (already has the fab): {path.name}')
            continue
        if '</body>' not in html:
            print(f'FAIL  no </body> anchor: {path}')
            failures += 1
            continue
        updated = html.replace('</body>', BLOCK + '</body>', 1)
        # sanity: one fab button in the markup; panel + toast referenced in CSS,
        # markup and script
        assert updated.count('id="cmc-share-fab"') == 1, f'{path.name}: fab button not single'
        assert updated.count('cmc-share-fab-panel') >= 3, f'{path.name}: missing panel refs'
        assert updated.count('cmc-share-fab-toast') >= 3, f'{path.name}: missing toast refs'
        path.write_text(updated, encoding='utf-8')
        print(f'  ok  injected share fab → {path.relative_to(ROOT)}')
    # final re-grep across all targets
    print('\nverification greps:')
    for path in TARGETS:
        html = path.read_text(encoding='utf-8')
        n = html.count('cmc-share-fab')
        state = 'ok' if n >= 2 else 'MISSING'
        if n < 2:
            failures += 1
        print(f'  [{state}] {path.relative_to(ROOT)}: {n} fixture refs')
    return 1 if failures else 0

if __name__ == '__main__':
    sys.exit(main())
