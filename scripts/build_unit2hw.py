#!/usr/bin/env python3
"""Build public/rfc3/unit2hw.html from the teacher's Unit 2 upload (init2.html).

Same integration the Unit 14 file (public/rfc3/doctor-fish.html) shipped with:
  · per-homework share gate  — biweekly_tests/hw-kid11-u2-hw1|2|3
  · back-to-CMC pill + teacher preview banner
  · bottom hw-bar: Submit-to-Teacher (drill_attempts pipeline) + share menu
Every integration block is copied BYTE-FOR-BYTE from doctor-fish.html and only
the Unit-14-specific strings are swapped (assert-counted), so the worksheet
content itself stays a faithful 1:1 transcription of the upload.

Unit 14 wrapped its engine in an IIFE, so doctor-fish.html exposes the
gate→engine bridge through window.CMC_HW_SETMODE / window.CMC_HW_GRADE and
skips the forced 'a' init when a #hw- deep link is present. The Unit 2 upload
(init2.html) uses the same IIFE wrapper but predates the hooks, so this
builder adds both engine patches here (assert-counted).
"""
import re, subprocess, sys

UPLOAD = '/home/z/my-project/upload/init2.html'
REF = '/home/z/my-project/tmp/cmc-site/public/rfc3/doctor-fish.html'
OUT = '/home/z/my-project/tmp/cmc-site/public/rfc3/unit2hw.html'

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

# ── 0. engine patches on the upload (gate→engine bridge, deep-link init) ───
# window hook exposure right after setMode() — same line doctor-fish ships.
u = replace1(u,
             "window.scrollTo({top:0,behavior:'smooth'});\n"
             "}\n"
             "$$('.tab').forEach(function(b){",
             "window.scrollTo({top:0,behavior:'smooth'});\n"
             "}\n"
             "window.CMC_HW_SETMODE=setMode;window.CMC_HW_GRADE=grade;\n"
             "$$('.tab').forEach(function(b){")
# a #hw- deep link must win over the default 'a' init (gate re-checks it).
u = replace1(u,
             "$$('.assignment').forEach(refreshProgress);\n"
             "setMode('a');",
             "$$('.assignment').forEach(refreshProgress);\n"
             "if(!/#hw-[abc]/.test(location.hash))setMode('a');")
# family-consistent page title
u = replace1(u, '<title>Unit 2 · Leonardo da Vinci · Homeworks 1–3</title>',
                '<title>Unit 2 · Leonardo da Vinci — Kid 11 Online Homework (Homeworks 1–3)</title>')

# ── 1. furniture + gate CSS (colors are the shared gate identity) ──────────
i = r.find('/* ── CMC site furniture')
j = r.find('@media print', i)
FURN_CSS = r[i:j]
FURN_CSS = replace1(FURN_CSS, "font-family:'Fraunces',Georgia,serif",
                    "font-family:'Cormorant Garamond',Georgia,serif")
PRINT_CSS = ('\n@media print{\n'
             '  .hw-bar,#cmc-back-btn,#hwBanner,.cmc-share,.cmc-toast,#hwGate{display:none!important}\n'
             '}\n')

# ── 2. gate script (docs u14 → u2, gate copy Unit 14 → Unit 2) ─────────────
gs = r.find('/* ── Kid 11 homework share gate')
g0 = r.rfind('<script>', 0, gs)
g1 = r.find('</script>', gs) + len('</script>')
GATE_JS = r[g0:g1]
GATE_JS = GATE_JS.replace('hw-kid11-u14-', 'hw-kid11-u2-')
assert GATE_JS.count('hw-kid11-u2-hw1') >= 1 and GATE_JS.count('hw-kid11-u2-hw2') >= 1 \
    and GATE_JS.count('hw-kid11-u2-hw3') >= 1, 'gate doc names not swapped'
GATE_JS = replace1(GATE_JS,
                   "the <b>Unit 14 homework</b> (Doctor Fish)",
                   "the <b>Unit 2 homework</b> (Leonardo da Vinci)")
GATE_JS = replace1(GATE_JS,
                   "Unit 14 · Doctor Fish ships as the teacher's 3-homework file.",
                   "Unit 2 · Leonardo da Vinci ships as the teacher's 3-homework file.")
# sanity: no u14 leftovers
assert 'u14' not in GATE_JS and 'Doctor Fish' not in GATE_JS

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
INTEG_JS = replace1(INTEG_JS, "a: 'Homework 1 · Spa Intake File',", "a: 'Homework 1 · Museum Docent',")
INTEG_JS = replace1(INTEG_JS, "b: 'Homework 2 · Treatment Analyst',", "b: 'Homework 2 · Timeline Curator',")
INTEG_JS = replace1(INTEG_JS, "c: 'Homework 3 · Health Writer'", "c: 'Homework 3 · Exhibition Critic'")
INTEG_JS = replace1(INTEG_JS, "names the ACTIVE homework (1 Spa Intake File / 2 Treatment Analyst /\n   3 Health Writer)",
                    "names the ACTIVE homework (1 Museum Docent / 2 Timeline Curator /\n   3 Exhibition Critic)")
INTEG_JS = replace1(INTEG_JS, "drillSlug:   { stringValue: 'doctor-fish.html' },",
                    "drillSlug:   { stringValue: 'unit2hw.html' },")
INTEG_JS = replace1(INTEG_JS, "'Unit 14 · Doctor Fish — '", "'Unit 2 · Leonardo da Vinci — '")
INTEG_JS = replace1(INTEG_JS, "'https://cmckhmer.github.io/Creative-Minds-/rfc3/doctor-fish.html'",
                    "'https://cmckhmer.github.io/Creative-Minds-/rfc3/unit2hw.html'")
INTEG_JS = replace1(INTEG_JS, "'Kid 11 Online Homework — Unit 14 · Doctor Fish · Homeworks 1–3 (auto-graded)'",
                    "'Kid 11 Online Homework — Unit 2 · Leonardo da Vinci · Homeworks 1–3 (auto-graded)'")
INTEG_JS = replace1(INTEG_JS, "title: 'Unit 14 · Doctor Fish'", "title: 'Unit 2 · Leonardo da Vinci'")
INTEG_JS = replace1(INTEG_JS, "'Unit 14 · Doctor Fish — Kid 11 Online Homework'",
                    "'Unit 2 · Leonardo da Vinci — Kid 11 Online Homework'")
assert 'u14' not in INTEG_JS and 'Doctor Fish' not in INTEG_JS \
    and 'Spa Intake' not in INTEG_JS and 'Treatment Analyst' not in INTEG_JS \
    and 'Health Writer' not in INTEG_JS and 'doctor-fish' not in INTEG_JS

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
if (ka, kc, ks) != (oa, oc, os_):
    print('UPLOAD answers:', len(ka), 'correct:', len(kc), 'solutions:', len(ks))
    print('OUT    answers:', len(oa), 'correct:', len(oc), 'solutions:', len(os_))
    for name, a, b in (('answers', ka, oa), ('corrects', kc, oc), ('solutions', ks, os_)):
        for idx, (x, y) in enumerate(zip(a, b)):
            if x != y:
                print(name, 'first diff at', idx, ': upload', repr(x), 'out', repr(y))
                break
        else:
            if len(a) != len(b):
                print(name, 'length differs; upload tail:', a[len(b):] if len(a) > len(b) else '',
                      'out tail:', b[len(a):] if len(b) > len(a) else '')
    raise SystemExit('graded keys changed!')
assert (ka, kc, ks) == (oa, oc, os_), 'graded keys changed!'
order_items = sum(len(s.split(',')) for s in ks)
write_tasks = len(re.findall(r'id="w-', out))
assert write_tasks == 8, 'expected 8 write-task sections, got %d' % write_tasks
graded_units = len(oa) + len(oc) + order_items + write_tasks
assert graded_units == 73, 'expected 73 graded units, got %d' % graded_units
# engine intact + hooks present
for fn in ['function grade(root)', 'function setMode(m)', 'function showResults(', 'function resetAll(']:
    assert fn in out, 'engine lost: ' + fn
assert out.count('window.CMC_HW_SETMODE=setMode;window.CMC_HW_GRADE=grade;') == 1
assert out.count("if(!/#hw-[abc]/.test(location.hash))setMode('a');") == 1
assert out.count('class="hw-btn hw-btn-submit" id="submitBtn"') == 1
assert out.count('id="submitBtn"') == 1
# unit swaps complete everywhere
for leftover in ['doctor-fish', 'hw-kid11-u14', 'Unit 14', 'Spa Intake',
                 'Treatment Analyst', 'Health Writer', 'Fraunces']:
    assert leftover not in out, 'leftover in output: ' + leftover
assert out.count('hw-kid11-u2-hw1') == 2 and out.count('hw-kid11-u2-hw2') == 1 \
    and out.count('hw-kid11-u2-hw3') == 1, 'share doc ids not exactly placed'

open(OUT, 'w', encoding='utf-8').write(out)
print('written', OUT, len(out), 'bytes;',
      len(oa), 'data-answer +', len(oc), 'data-correct +', len(ks), 'data-solution (6 items) +',
      write_tasks, 'write-tasks = 73 graded units')

# ── 8. node --check both embedded scripts of the OUTPUT ────────────────────
scripts = re.findall(r'<script>(.*?)</script>', out, re.S)
ok = 0
for idx, js in enumerate(scripts):
    if 'function' in js or 'fetch(' in js:
        p = '/tmp/u2_script_%d.js' % idx
        open(p, 'w', encoding='utf-8').write(js)
        res = subprocess.run(['node', '--check', p], capture_output=True, text=True)
        assert res.returncode == 0, 'script %d syntax error: %s' % (idx, res.stderr[:400])
        ok += 1
print('node --check passed on', ok, 'embedded scripts')
