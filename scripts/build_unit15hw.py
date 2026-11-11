#!/usr/bin/env python3
"""Build public/rfc3/unit15hw.html from the teacher's Unit 15 upload.

Same integration the Unit 13 file (public/rfc3/unit13hw.html) shipped with:
  · per-homework share gate  — biweekly_tests/hw-kid11-u15-hw1|2|3
  · back-to-CMC pill + teacher preview banner
  · bottom hw-bar: Submit-to-Teacher (drill_attempts pipeline) + share menu
Every integration block is copied BYTE-FOR-BYTE from unit13hw.html and only
the Unit-13-specific strings are swapped (assert-counted), so the worksheet
content itself stays a faithful 1:1 transcription of the upload.
"""
import re, subprocess, sys

UPLOAD = '/home/z/my-project/upload/unit15.html'
REF = '/home/z/my-project/tmp/cmc-site/public/rfc3/unit13hw.html'
OUT = '/home/z/my-project/tmp/cmc-site/public/rfc3/unit15hw.html'

u = open(UPLOAD, encoding='utf-8').read()
r = open(REF, encoding='utf-8').read()

def cut(src, start_marker, end_marker, include_end=True):
    i = src.find(start_marker)
    assert i != -1, 'start marker missing: ' + start_marker[:60]
    j = src.find(end_marker, i)
    assert j != -1, 'end marker missing: ' + end_marker[:60]
    return src[i:j + (len(end_marker) if include_end else 0)]

def replace1(s, old, new):
    n = s.count(old)
    assert n == 1, 'replace1 expected 1 hit, got %d for %r' % (n, old[:70])
    return s.replace(old, new)

# ── 1. furniture + gate CSS (colors are the shared gate identity) ──────────
i = r.find('/* ── CMC site furniture')
j = r.find('@media print', i)
FURN_CSS = r[i:j]
FURN_CSS = replace1(FURN_CSS, "font-family:'Fraunces',Georgia,serif",
                    "font-family:'Chakra Petch',sans-serif")
PRINT_CSS = ('\n@media print{\n'
             '  .hw-bar,#cmc-back-btn,#hwBanner,.cmc-share,.cmc-toast,#hwGate{display:none!important}\n'
             '}\n')

# ── 2. gate script (docs u13 → u15, gate copy Unit 13 → Unit 15) ───────────
gs = r.find('/* ── Kid 11 homework share gate')
g0 = r.rfind('<script>', 0, gs)
g1 = r.find('</script>', gs) + len('</script>')
GATE_JS = r[g0:g1]
GATE_JS = GATE_JS.replace('hw-kid11-u13-', 'hw-kid11-u15-')
assert GATE_JS.count('hw-kid11-u15-hw1') >= 1 and GATE_JS.count('hw-kid11-u15-hw2') >= 1 \
    and GATE_JS.count('hw-kid11-u15-hw3') >= 1, 'gate doc names not swapped'
GATE_JS = replace1(GATE_JS,
                   'the <b>Unit 13 homework</b> (New Homes for Animals)',
                   'the <b>Unit 15 homework</b> (DNA Bank)')
# sanity: no u13 leftovers
assert 'u13' not in GATE_JS and 'New Homes' not in GATE_JS

# ── 3. back-to-CMC pill + teacher banner markup ────────────────────────────
BACK_BTN = cut(r, '<!-- Back to CMC home', '</a>')
BANNER = cut(r, '<!-- Teacher preview banner', '</div>')

# ── 4. bottom bar + toast + share menu markup ──────────────────────────────
h0 = r.find('<!-- Bottom action bar')
h1 = r.find('<script>', h0)
HWBAR = r[h0:h1].rstrip() + '\n'

# ── 5. integration script (name/date sync + submit + share) ────────────────
is0 = r.find('/* ── Kid 11 online homework: hero name/date sync')
s0 = r.rfind('<script>', 0, is0)
s1 = r.find('</script>', is0) + len('</script>')
INTEG_JS = r[s0:s1]
INTEG_JS = replace1(INTEG_JS, "a: 'Homework 1 · Field Notebook',", "a: 'Homework 1 · Lab Induction',")
INTEG_JS = replace1(INTEG_JS, "b: 'Homework 2 · Relocation Mission',", "b: 'Homework 2 · Chain-Reaction Analyst',")
INTEG_JS = replace1(INTEG_JS, "c: 'Homework 3 · Campaign Studio'", "c: 'Homework 3 · Conservation Campaigner'")
INTEG_JS = replace1(INTEG_JS, "drillSlug:   { stringValue: 'unit13hw.html' },",
                    "drillSlug:   { stringValue: 'unit15hw.html' },")
INTEG_JS = replace1(INTEG_JS, "'Unit 13 · New Homes for Animals — '", "'Unit 15 · DNA Bank — '")
INTEG_JS = replace1(INTEG_JS, "'https://cmckhmer.github.io/Creative-Minds-/rfc3/unit13hw.html'",
                    "'https://cmckhmer.github.io/Creative-Minds-/rfc3/unit15hw.html'")
INTEG_JS = replace1(INTEG_JS, "'Kid 11 Online Homework — Unit 13 · New Homes for Animals · Homeworks 1–3 (auto-graded)'",
                    "'Kid 11 Online Homework — Unit 15 · DNA Bank · Homeworks 1–3 (auto-graded)'")
INTEG_JS = replace1(INTEG_JS, "title: 'Unit 13 · New Homes for Animals'", "title: 'Unit 15 · DNA Bank'")
INTEG_JS = replace1(INTEG_JS, "'Unit 13 · New Homes for Animals — Kid 11 Online Homework'",
                    "'Unit 15 · DNA Bank — Kid 11 Online Homework'")
assert 'u13' not in INTEG_JS and 'New Homes' not in INTEG_JS

# ── 6. assemble ────────────────────────────────────────────────────────────
out = u

# CSS: furniture + gate CSS goes before the upload's own @media print block
pm = out.find('@media print{')
assert pm != -1
out = out[:pm] + FURN_CSS + PRINT_CSS + out[pm:]

# gate script before </head>
assert out.count('</head>') == 1
out = out.replace('</head>', GATE_JS + '\n</head>')

# back-btn + banner right after <body data-mode="a">
assert out.count('<body data-mode="a">') == 1
out = out.replace('<body data-mode="a">',
                  '<body data-mode="a">\n\n' + BACK_BTN + '\n\n' + BANNER)

# bottom bar before <noscript>
assert out.count('<noscript>') == 1
out = out.replace('<noscript>', HWBAR + '\n<noscript>')

# integration script before </body>
assert out.count('</body>') == 1
out = out.replace('</body>', INTEG_JS + '\n</body>')

# ── 7. sanity: the worksheet content itself must be untouched ──────────────
def keys(src):
    return (re.findall(r'data-answer="([^"]*)"', src),
            re.findall(r'data-correct="([^"]*)"', src),
            re.findall(r'data-solution="([^"]*)"', src))
ka, kc, ks = keys(u)
oa, oc, os_ = keys(out)
assert (ka, kc, ks) == (oa, oc, os_), 'graded keys changed!'
order_items = sum(len(s.split(',')) for s in ks)
write_tasks = len(re.findall(r'id="w-', u))
assert write_tasks == 8, 'expected 8 write-task sections, got %d' % write_tasks
graded_units = len(ka) + len(kc) + order_items + write_tasks
assert graded_units == 74, 'expected 74 graded units, got %d' % graded_units
# engine intact
for fn in ['function grade(root)', 'function setMode(m)', 'function showResults(', 'function resetAll(']:
    assert fn in out, 'engine lost: ' + fn
assert out.count('class="hw-btn hw-btn-submit" id="submitBtn"') == 1
assert out.count('id="submitBtn"') == 1

open(OUT, 'w', encoding='utf-8').write(out)
print('written', OUT, len(out), 'bytes;',
      len(ka), 'data-answer +', len(kc), 'data-correct +', len(ks), 'data-solution = 74 keys')

# ── 8. node --check both embedded scripts of the OUTPUT ────────────────────
scripts = re.findall(r'<script>(.*?)</script>', out, re.S)
ok = 0
for idx, js in enumerate(scripts):
    if 'function' in js or 'fetch(' in js:
        p = '/tmp/u15_script_%d.js' % idx
        open(p, 'w', encoding='utf-8').write(js)
        res = subprocess.run(['node', '--check', p], capture_output=True, text=True)
        assert res.returncode == 0, 'script %d syntax error: %s' % (idx, res.stderr[:400])
        ok += 1
print('node --check passed on', ok, 'embedded scripts')
