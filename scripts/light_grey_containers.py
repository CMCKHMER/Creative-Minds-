#!/usr/bin/env python3
"""Light theme stage 2 — the white SHEETS (owner, Nov 2026: "the light option
… has not accomplished the task … Some areas have been hard to focus on and i
want you to change the pure white BG to a light grey for the whole site").

Stage 1 (already shipped) turned every page CANVAS grey (#e2e8f0) but left the
big near-white sheets white "as elevation". The user is still seeing glare,
so this pass retints the sheets themselves on the rfc1/rfc2/rfc3 worksheets:

  body.light .container{background:rgba(255,255,255,.92) -> rgba(238,242,247,.92)
  --s2:#fff           -> --s2:#eef2f7          (rfc1 share panel / stat chips)
  --surface-2:#ffffff -> --surface-2:#eef2f7   (rfc2/rfc3 share panel)

White content surfaces that should still POP (inputs, passage cards, option
cards) keep their explicit #fff overrides — on the grey sheet they become the
focus points. Idempotent; verifies after write.
"""
import sys
from pathlib import Path

ROOT = Path('/home/z/my-project/tmp/cmc-site/public')
TARGETS = sorted(
    list(ROOT.glob('rfc1/*.html'))
    + list(ROOT.glob('rfc2/rfc2*.html'))
    + list(ROOT.glob('rfc3/*.html'))
)

def patch(text: str):
    changes = []
    if 'body.light .container{background:rgba(255,255,255,.92)' in text:
        text = text.replace(
            'body.light .container{background:rgba(255,255,255,.92)',
            'body.light .container{background:rgba(238,242,247,.92)',
        )
        changes.append('container sheet -> rgba(238,242,247,.92)')
    for old, new in (('--s2:#fff;', '--s2:#eef2f7;'), ('--s2:#fff}', '--s2:#eef2f7}'),
                     ('--surface-2:#ffffff;', '--surface-2:#eef2f7;'),
                     ('--surface-2:#ffffff}', '--surface-2:#eef2f7}')):
        if old in text:
            text = text.replace(old, new)
            changes.append(old.rstrip(';}') + ' -> #eef2f7')
    return text, changes

def main() -> int:
    failures = 0
    touched = 0
    for path in TARGETS:
        html = path.read_text(encoding='utf-8')
        patched, changes = patch(html)
        if changes:
            path.write_text(patched, encoding='utf-8')
            touched += 1
            print(f"  ok  {path.relative_to(ROOT)}: {'; '.join(sorted(set(changes)))}")

    print(f'\n{touched} files retinted; verification:')
    for path in TARGETS:
        t = path.read_text(encoding='utf-8')
        white_sheet = 'body.light .container{background:rgba(255,255,255,.92)' in t
        white_token = '--s2:#fff' in t or '--surface-2:#fff' in t
        has_sheet_rule = 'body.light .container{background:' in t
        has_token = '--s2:' in t or '--surface-2:' in t
        grey_somewhere = 'rgba(238,242,247,.92)' in t or '#eef2f7' in t
        if white_sheet or white_token or ((has_sheet_rule or has_token) and not grey_somewhere):
            failures += 1
            print(f'  FAIL  {path.relative_to(ROOT)}  white_sheet={white_sheet} white_token={white_token}')
        else:
            print(f'  ok    {path.relative_to(ROOT)}')
    return 1 if failures else 0

if __name__ == '__main__':
    sys.exit(main())
