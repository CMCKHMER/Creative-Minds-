#!/usr/bin/env python3
# Mafia Noir — wire the owner's painted artwork into the game (owner: "i got
# 8 images for the mafia game. implement them in the right areas").
#
# Chains AFTER build_mafia.py and build_mafia_online.py. Works on
# public/mafia.html in place, relative to the repository, and is safe to run
# twice: a page that already carries the marker below is left untouched.
# Every swap is assert-counted, so a changed page fails loudly instead of
# being patched half-way.
#
#   public/mafia-art/mafia-cardback.jpg   BACK of every role card (deal reveal
#                                         in solo / pass & play / online, and
#                                         the elimination reveal)
#   public/mafia-art/mafia-<role>.jpg     FRONT of the role card, one picture
#                                         per role (mafia, detective, doctor,
#                                         villager) + the Roles list in
#                                         "How to Play"
#   public/mafia-art/mafia-town-wins.jpg  top of the CASE CLOSED screen when
#                                         the city wins
#
# Also fixes two bugs met on those screens: (B1) the CASE CLOSED grid of
# player roles was invisible; (B2) tall modals opened scrolled to the bottom.
#
# Nothing depends on a picture arriving: the drawn card back stays underneath
# its picture, a role card whose picture fails falls back to the icon design,
# and the win banner removes itself.
#
#   python3 scripts/patch_mafia_art.py          apply
#   python3 scripts/patch_mafia_art.py --check  exit 1 when the page lacks it
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = os.path.join(ROOT, 'public', 'mafia.html')
ART = os.path.join(ROOT, 'public', 'mafia-art')
MARK = '/* ── owner artwork (patch_mafia_art.py) ── */'

FILES = ['mafia-cardback.jpg', 'mafia-mafia.jpg', 'mafia-detective.jpg',
         'mafia-doctor.jpg', 'mafia-villager.jpg', 'mafia-town-wins.jpg']

html = open(PAGE, encoding='utf-8').read()

if '--check' in sys.argv:
    missing = [f for f in FILES if not os.path.exists(os.path.join(ART, f))]
    if MARK not in html or missing:
        print('mafia art: NOT wired' + (f' (missing files: {", ".join(missing)})' if missing else ''))
        sys.exit(1)
    print('mafia art: wired, all 6 pictures present')
    sys.exit(0)

if MARK in html:
    print('mafia art: already wired — nothing to do')
    sys.exit(0)

for f in FILES:
    assert os.path.exists(os.path.join(ART, f)), f'missing picture: public/mafia-art/{f}'

swaps = []


def swap(old, new, count=1, label=''):
    global html
    found = html.count(old)
    assert found == count, f'[{label or old[:50]}] expected {count} occurrence(s), found {found}'
    html = html.replace(old, new)
    swaps.append(label or old[:60])


# ── A1: CSS, appended to the page's LAST <style> block ──────────────────
CSS = MARK + """
.card3d .back .cb-art{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.rf-art{display:none}
.rolefront.has-art{padding-top:7%}
.rolefront.has-art .rf-art{display:block;position:absolute;left:0;right:0;top:0;height:68%;overflow:hidden;-webkit-mask-image:linear-gradient(#000 60%,transparent);mask-image:linear-gradient(#000 60%,transparent)}
.rolefront.has-art .rf-art img{width:100%;height:112%;object-fit:cover;object-position:50% 0;display:block}
.rolefront.has-art::before{z-index:1}
.rolefront.has-art>div:not(.rf-art){position:relative;z-index:2}
.rolefront.has-art .rf-team{padding:4px 9px 3px;border-radius:999px;background:rgba(5,7,15,.72);border:1px solid color-mix(in srgb,var(--rc) 45%,transparent)}
.rolefront.has-art .rf-icon{width:17%;margin:64% 0 2%;background:#0c0f22;box-shadow:0 0 18px color-mix(in srgb,var(--rc) 45%,transparent),0 0 0 3px rgba(5,7,15,.6)}
.rolefront.has-art .rf-name{text-shadow:0 2px 10px #05070f}
.rolefront.has-art .rf-desc{margin-top:3%;font-size:10.5px;line-height:1.5}
.end-art{margin:-28px -26px 0;aspect-ratio:5/2;max-height:42vh;overflow:hidden;border-radius:14px 14px 0 0;-webkit-mask-image:linear-gradient(#000 66%,transparent);mask-image:linear-gradient(#000 66%,transparent)}
.end-art img{width:100%;height:100%;object-fit:cover;object-position:50% 55%;display:block;animation:endArtIn 1.6s ease-out both}
.end-art+.m-kicker{position:relative;margin-top:-22px}
@keyframes endArtIn{from{opacity:0;transform:scale(1.06)}}
.hr .hr-pic{position:relative;flex:0 0 auto;width:46px;height:46px;border-radius:8px;overflow:hidden;display:grid;place-items:center;border:1px solid var(--hc);background:#0c0f22}
.hr .hr-pic img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 18%}
@media(max-width:356px){.rolefront.has-art .rf-art{height:58%}.rolefront.has-art .rf-icon{margin-top:50%}.rolefront.has-art .rf-name{font-size:21px}}
@media(prefers-reduced-motion:reduce){.end-art img{animation:none}}
"""
head, sep, tail = html.rpartition('</style>')
assert sep, 'no </style> in the page'
html = head + CSS + sep + tail
swaps.append('A1 css')

# ── A2: card back — the picture sits on top of the drawn back ───────────
swap('fill="#e8b64c">MN</text></svg>`}',
     'fill="#e8b64c">MN</text></svg><img class="cb-art" src="mafia-art/mafia-cardback.jpg" alt="" decoding="async" onerror="this.remove()">`}',
     label='A2 card back picture')

# ── A3: role card front — one picture per role ──────────────────────────
swap('return `<div class="rolefront" style="--rc:${r.color}"><div class="rf-team">',
     'return `<div class="rolefront has-art" style="--rc:${r.color}"><div class="rf-art"><img src="mafia-art/mafia-${k}.jpg" alt="" decoding="async" onerror="this.closest(\'.rolefront\').classList.remove(\'has-art\')"></div><div class="rf-team">',
     label='A3 role card picture')

# ── A4: CASE CLOSED — sunrise over the city when the town wins ──────────
swap('openModal(`<div class="m-kicker">CASE CLOSED · ',
     'openModal(`${winner==="town"?\'<div class="end-art"><img src="mafia-art/mafia-town-wins.jpg" alt="The townspeople watch the sun rise over the city — AI illustration" onerror="this.parentNode.remove()"></div>\':""}<div class="m-kicker">CASE CLOSED · ',
     label='A4 town-wins banner')

# ── A5: "How to Play" — role pictures in the Roles list ─────────────────
swap('${Object.values(ROLE).map(r=>`<div class="hr" style="--hc:${r.color}">${r.icon}<span>',
     '${Object.entries(ROLE).map(([k,r])=>`<div class="hr" style="--hc:${r.color}"><span class="hr-pic">${r.icon}<img src="mafia-art/mafia-${k}.jpg" alt="" loading="lazy" onerror="this.remove()"></span><span>',
     label='A5 rules role pictures')

# ── A6: warm the pictures the first deal needs, after the page has loaded ─
swap('$("#soloIcon").innerHTML=IC.solo;',
     '(function(){const warm=()=>["mafia-art/mafia-cardback.jpg","mafia-art/mafia-villager.jpg"].forEach(u=>{new Image().src=u});'
     'if(document.readyState==="complete")setTimeout(warm,600);else addEventListener("load",()=>setTimeout(warm,600),{once:true})})();\n'
     '$("#soloIcon").innerHTML=IC.solo;',
     label='A6 warm card pictures')

# ── B1: bug found on the way — the CASE CLOSED role grid never appeared ──
# .rev rests at opacity:0 and its animation only names a `from` frame, so the
# animation ended where it began: every player's role tile stayed invisible.
swap('@keyframes revIn{from{opacity:0;transform:rotateY(90deg)}}',
     '@keyframes revIn{from{opacity:0;transform:rotateY(90deg)}to{opacity:1;transform:none}}',
     label='B1 reveal grid visible')

# ── B2: a tall modal opened scrolled to its bottom on a phone ────────────
# Focusing the first button scrolled the box down to it, so CASE CLOSED opened
# on the buttons with the verdict (and now the picture) above the screen, and
# "How to Play" opened at its last line. Focus stays; the scroll does not.
swap('const b=$("#modalBox button");if(b)setTimeout(()=>b.focus(),50)}',
     '$("#modalBox").scrollTop=0;const b=$("#modalBox button");if(b)setTimeout(()=>b.focus({preventScroll:true}),50)}',
     label='B2 openModal keeps the top')
swap('const b=box.querySelector("button");if(b)setTimeout(()=>b.focus(),50)})}',
     'const b=box.querySelector("button");if(b)setTimeout(()=>b.focus({preventScroll:true}),50)})}',
     label='B2 modalPromise keeps the top')

open(PAGE, 'w', encoding='utf-8').write(html)
print(f'mafia art: wired ({len(swaps)} swaps): ' + ', '.join(swaps))
