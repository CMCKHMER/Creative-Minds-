#!/usr/bin/env python3
"""Audit light-theme CSS in the CMC site: print every light-related rule
(selector + body) per page family so the page BACKGROUND can be told apart
from card/surface backgrounds. Read-only."""
import re
from pathlib import Path

ROOT = Path('/home/z/my-project/tmp/cmc-site')
PAGES = [
    'public/biweek-planner/tests/diagnostic.html',
    'public/biweek-planner/index.html',
    'public/toefl-ibt/index.html',
    'public/syntax-clash-pro.html',
    'public/writequest.html',
    'public/arcade/galica/index.html',
    'public/voice-quest.html',
    'public/news/index.html',
]
# match selector{body} for rules whose selector mentions light themes
RULE = re.compile(r'([^{}]+)\{([^{}]*)\}')

for rel in PAGES:
    p = ROOT / rel
    html = p.read_text(encoding='utf-8', errors='ignore')
    print(f'===== {rel} =====')
    n = 0
    for sel, body in RULE.findall(html):
        s = sel.strip().replace('\n', ' ')
        if not re.search(r'\.light|data-theme=["\']?light|light-theme|prefers-color-scheme:\s*light', s):
            continue
        b = ' '.join(body.split())
        if len(b) > 160:
            b = b[:160] + '…'
        n += 1
        print(f'  {s[:110]} → {b}')
    if not n:
        print('  (no light rules)')
    print()
