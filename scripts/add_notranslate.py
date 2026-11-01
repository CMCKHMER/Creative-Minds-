#!/usr/bin/env python3
"""Add translate="no" + notranslate meta to every standalone HTML page.

The site is English-only. On devices whose browser language is set to
something else (e.g. Chrome UI in Chinese), Chrome auto-rewrites the whole
page — the owner got Chinese labels all over the lounge. The main SPA shell
(index.html) was fixed by hand; this script covers every standalone page
under public/ (biweek tests, TOEFL tools, worksheets, arcade, …) so no
navigation can fall back to auto-translation.

Idempotent: skips files already carrying the switch.
"""
import re
from pathlib import Path

ROOT = Path("/home/z/my-project/tmp/cmc-site/public")

META = ('    <!-- English-only site: block browser auto-translate -->\n'
        '    <meta name="google" content="notranslate" />\n')

changed, skipped = [], []
for html in sorted(ROOT.rglob("*.html")):
    text = html.read_text(encoding="utf-8")
    if 'translate="no"' in text and "notranslate" in text:
        skipped.append(html)
        continue

    new = text
    # 1) translate="no" on the opening <html> tag
    m = re.search(r"<html\b[^>]*>", new)
    if m and 'translate="no"' not in m.group(0):
        tag = m.group(0)
        new = new[:m.start()] + tag[:-1] + ' translate="no">' + new[m.end():]

    # 2) notranslate meta as the first child of <head>
    if "notranslate" not in new:
        m = re.search(r"<head[^>]*>\n?", new)
        if m:
            new = new[:m.end()] + META + new[m.end():]
        else:
            print(f"!! no <head> in {html}")
            continue

    html.write_text(new, encoding="utf-8")
    changed.append(html)

print(f"updated {len(changed)}, already-ok {len(skipped)}")
for p in changed[:5]:
    print("  +", p.relative_to(ROOT))
