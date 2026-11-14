#!/usr/bin/env python3
"""Light theme stage 3 — DEEPEN (owner, Nov 2026: "The light grey them not
showing or can't tell the difference").

Stage 1 (v53) put every light page canvas on slate-200 #e2e8f0 and stage 2
(v57) turned the white sheets grey — but slate-200/100 are so close to white
that on many displays the change is invisible. This pass shifts the whole
light palette one step down the slate ramp so the grey is unmistakable:

  page canvas  #e2e8f0 (slate-200) -> #cbd5e1 (slate-300)
  sheets       rgba(238,242,247,.92) -> rgba(226,232,240,.92) (slate-200)
  tokens       --s2 / --surface-2 #eef2f7 -> #e2e8f0

White content cards and inputs STAY white — on the deeper grey canvas they
pop hard, which is the point. #e2e8f0 is also the dark-theme TEXT colour, so
every swap below is a context-pinned needle (background declarations only);
dark text values (--tx:#e2e8f0, color:#e2e8f0) are never touched.
Idempotent; verifies after write.
"""
import sys
from pathlib import Path

ROOT = Path('/home/z/my-project/tmp/cmc-site/public')

# (needle, replacement, label) — applied to every public/*.html
HTML_NEEDLES = [
    ('--bg:#e2e8f0', '--bg:#cbd5e1', 'light --bg canvas -> slate-300'),
    ('--er:#dc2626;background:#e2e8f0', '--er:#dc2626;background:#cbd5e1',
     'body.light trailing canvas (rfc1) -> slate-300'),
    ('--error:#dc2626;background:#e2e8f0', '--error:#dc2626;background:#cbd5e1',
     'body.light trailing canvas (rfc2/rfc3) -> slate-300'),
    ('background:#e2e8f0!important', 'background:#cbd5e1!important',
     'no-flash layer -> slate-300'),
    ('background: #e2e8f0 !important', 'background: #cbd5e1 !important',
     'toefl main light body -> slate-300'),
    ('body.light .container{background:rgba(238,242,247,.92)',
     'body.light .container{background:rgba(226,232,240,.92)',
     'sheet -> slate-200 .92'),
    ('--s2:#eef2f7', '--s2:#e2e8f0', '--s2 token -> slate-200'),
    ('--surface-2:#eef2f7', '--surface-2:#e2e8f0', '--surface-2 token -> slate-200'),
]

GATE_NEEDLES = [
    ("var bg = light ? '#e2e8f0' : '#020617';",
     "var bg = light ? '#cbd5e1' : '#020617';", 'teacher-gate overlay'),
    ("bg: light ? '#e2e8f0' : '#020617',",
     "bg: light ? '#cbd5e1' : '#020617',", 'student-invite overlay'),
]

STUDIO_NEEDLE = ('background:#e2e8f0', 'background:#cbd5e1', 'studio light canvas')

def main() -> int:
    failures = 0
    touched = 0
    for path in sorted(ROOT.rglob('*.html')):
        text = path.read_text(encoding='utf-8', errors='ignore')
        original = text
        notes = []
        for needle, repl, label in HTML_NEEDLES:
            if needle in text:
                text = text.replace(needle, repl)
                notes.append(label)
        if path.name == 'index.html' and path.parent.name == 'studio':
            for needle, repl, label in HTML_NEEDLES + [STUDIO_NEEDLE]:
                if needle in text:
                    text = text.replace(needle, repl)
                    notes.append('studio: ' + label)
        if text != original:
            path.write_text(text, encoding='utf-8')
            touched += 1
            print(f"  ok  {path.relative_to(ROOT)}: {'; '.join(sorted(set(notes)))}")

    for path, needles in (
        (ROOT / 'biweek-planner/teacher-gate.js', GATE_NEEDLES[:1]),
        (ROOT / 'biweek-planner/student-invite.js', GATE_NEEDLES[1:]),
    ):
        text = path.read_text(encoding='utf-8')
        for needle, repl, label in needles:
            if needle in text:
                path.write_text(text.replace(needle, repl), encoding='utf-8')
                touched += 1
                print(f'  ok  {path.relative_to(ROOT)}: {label} -> slate-300')

    print(f'\n{touched} files deepened; verification (no light-canvas needles may remain):')
    leftovers = [
        '--bg:#e2e8f0', '--s2:#eef2f7', '--surface-2:#eef2f7',
        'background:#e2e8f0!important', 'background: #e2e8f0 !important',
        'rgba(238,242,247,.92)', "light ? '#e2e8f0'",
    ]
    bad = []
    for path in sorted(ROOT.rglob('*')):
        if not path.is_file() or path.suffix not in ('.html', '.js'):
            continue
        t = path.read_text(encoding='utf-8', errors='ignore')
        for needle in leftovers:
            if needle in t:
                bad.append(f'{path.relative_to(ROOT)} :: {needle}')
    if bad:
        failures = len(bad)
        print('STILL ON OLD GREY:')
        for b in bad[:12]:
            print('  ', b)
        return 1
    print(f'  ok  all {touched} patched files + whole public/ tree clean')
    return 0

if __name__ == '__main__':
    sys.exit(main())
