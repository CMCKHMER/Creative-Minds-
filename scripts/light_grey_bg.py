#!/usr/bin/env python3
"""Light-grey site-wide background (owner request, Nov 2026: "the light option
of the page has not accomplished the task of making viewing better. Some areas
have been hard to focus on and i want you to change the pure white BG to a
light grey for the whole site").

The React app + biweek-planner already light-mode to #e2e8f0 (slate-200,
"never solid white per design brief" in src/index.css). The offenders that
still render near-white (#f8fafc slate-50) or off-palette (#eef2f7) are the
static pages, patched here to the SAME #e2e8f0:

  - biweek-planner/tests/*.html (public + private variants): --bg:#f8fafc
  - toefl-ibt/index.html + toefl-ibt/*-MIGRATED.html: #f8fafc !important
  - rfc1/rfc2/rfc3 worksheets + homework pages: --bg:#eef2f7

Only the page background var/declaration is touched — cards stay white
(rgba(255,255,255,…) surfaces read as elevation on the grey). Idempotent.
"""
import re
import sys
from pathlib import Path

ROOT = Path('/home/z/my-project/tmp/cmc-site/public')
GREY = '#e2e8f0'

def patch(text: str):
    """Return (patched_text, list_of_change_labels)."""
    changes = []
    # 1. biweek tests + any page using the light --bg var with slate-50
    if '--bg:#f8fafc' in text:
        text = text.replace('--bg:#f8fafc', f'--bg:{GREY}')
        changes.append('--bg:#f8fafc → #e2e8f0')
    if '--bg: #f8fafc' in text:
        text = text.replace('--bg: #f8fafc', f'--bg: {GREY}')
        changes.append('--bg: #f8fafc → #e2e8f0')
    # 2. toefl-ibt light body declaration (keep the radial overlays after it)
    for pat in ('background: #f8fafc !important', 'background:#f8fafc!important'):
        if pat in text:
            text = text.replace(pat, f'background: {GREY} !important' if ' ' in pat else f'background:{GREY}!important')
            changes.append(f'{pat!r} → #e2e8f0 !important')
    # 3. rfc worksheet + homework light themes (#eef2f7 → site grey)
    if '--bg:#eef2f7' in text:
        text = text.replace('--bg:#eef2f7', f'--bg:{GREY}')
        changes.append('--bg:#eef2f7 → #e2e8f0')
    # 4. any remaining light body/page rule with a bare #f8fafc page background
    #    (MIGRATED toefl pages: body{background:#f8fafc!important} shapes)
    def body_bg(m):
        inner = m.group(0)
        if 'background' in inner and '#f8fafc' in inner:
            changed = inner.replace('#f8fafc', GREY)
            if changed != inner:
                changes.append('light body rule #f8fafc → #e2e8f0')
            return changed
        return inner
    text = re.sub(
        r'(?:html|body)\[data-theme=["\']?light["\']?\][^{]*\{[^}]*\}|(?:html|body)\.light[^{]*\{[^}]*\}',
        body_bg, text)
    # 5. final sweep: any remaining slate-50 / off-palette light BACKGROUND
    #    declarations — the rfc body.light rule's own `background:#eef2f7`
    #    trailing the var list, the rfc pre-paint inline JS background string,
    #    small surfaces. Background declarations only — `color:#f8fafc` text
    #    values on dark surfaces are never touched.
    for a, b in (
        ('background:#eef2f7', f'background:{GREY}'),
        ('background: #eef2f7', f'background: {GREY}'),
        ('background:#f8fafc', f'background:{GREY}'),
        ('background: #f8fafc', f'background: {GREY}'),
        ('background-color:#f8fafc', f'background-color:{GREY}'),
        ('background-color: #f8fafc', f'background-color: {GREY}'),
    ):
        if a in text:
            text = text.replace(a, b)
            changes.append(f'{a} → {b}')
    return text, changes

def main() -> int:
    total_files = 0
    total_changes = 0
    for p in sorted(ROOT.rglob('*.html')):
        rel = p.relative_to(ROOT)
        # the private test variants mirror the public ones
        orig = p.read_text(encoding='utf-8', errors='ignore')
        patched, changes = patch(orig)
        if changes:
            p.write_text(patched, encoding='utf-8')
            total_files += 1
            total_changes += len(changes)
            print(f"  ok  {rel}: {'; '.join(sorted(set(changes)))}")
    print(f'\n{total_files} files patched, {total_changes} declarations changed')
    # verification sweep: no light page background should remain non-grey
    bad = []
    for p in sorted(ROOT.rglob('*.html')):
        t = p.read_text(encoding='utf-8', errors='ignore')
        if re.search(r'--bg:\s*#f8fafc|--bg:\s*#eef2f7|background(-color)?:\s*#eef2f7|background(-color)?:\s*#f8fafc', t):
            bad.append(str(p.relative_to(ROOT)))
    if bad:
        print('STILL OFF-PALETTE:', *bad[:10], sep='\n  ')
        return 1
    print('verification: every light --bg is now #e2e8f0')
    return 0

if __name__ == '__main__':
    sys.exit(main())
