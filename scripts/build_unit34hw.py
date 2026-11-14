#!/usr/bin/env python3
"""Build public/rfc3/unit3hw.html (Pocahontas) and unit4hw.html (Walt Disney)
from the teacher's Unit 3/Unit 4 uploads.

Same integration the Unit 2 file (public/rfc3/unit2hw.html) shipped with —
per-homework share gate (biweekly_tests/hw-kid11-u3-hw1|2|3 and
hw-kid11-u4-hw1|2|3), back-to-CMC pill + teacher preview banner, bottom
hw-bar (Submit-to-Teacher + share menu), and the two engine patches
(window.CMC_HW_SETMODE/CMC_HW_GRADE + #hw- deep-link init) that the
upload's IIFE engine predates. Every integration block is copied
BYTE-FOR-BYTE from doctor-fish.html (the Unit 14 reference) and only the
unit-specific strings are swapped (assert-counted), so the worksheet
content itself stays a faithful 1:1 transcription of the upload.
"""
import re, subprocess

REF = '/home/z/my-project/tmp/cmc-site/public/rfc3/doctor-fish.html'
OUTDIR = '/home/z/my-project/tmp/cmc-site/public/rfc3'

UNITS = [
    dict(key='u3', upload='/home/z/my-project/upload/unit3.html',
         out=f'{OUTDIR}/unit3hw.html',
         title='Unit 3 · Pocahontas · Homeworks 1–3',
         unit="Unit 3 · Pocahontas", slug='unit3hw.html',
         prefix='hw-kid11-u3-', font='Marcellus',
         hw1='The Archive Record', hw2='Timeline Historian', hw3='Museum Interpreter',
         graded=73),
    dict(key='u4', upload='/home/z/my-project/upload/unit4.html',
         out=f'{OUTDIR}/unit4hw.html',
         title='Unit 4 · Walt Disney · Homeworks 1–3',
         unit="Unit 4 · Walt Disney", slug='unit4hw.html',
         prefix='hw-kid11-u4-', font='Newsreader',
         hw1='The Storyboard Desk', hw2='Timeline Producer', hw3='Legacy Writer',
         graded=75),
]

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

# ── reference blocks cut once (byte-for-byte from Unit 14) ─────────────────
i = r.find('/* ── CMC site furniture')
j = r.find('@media print', i)
FURN_CSS_RAW = r[i:j]
PRINT_CSS = ('\n@media print{\n'
             '  .hw-bar,#cmc-back-btn,#hwBanner,.cmc-share,.cmc-toast,#hwGate{display:none!important}\n'
             '}\n')
gs = r.find('/* ── Kid 11 homework share gate')
g0 = r.rfind('<script>', 0, gs)
g1 = r.find('</script>', gs) + len('</script>')
GATE_JS_RAW = r[g0:g1]
BACK_BTN = cut(r, '<!-- Back to CMC home', '</a>')
BANNER = cut(r, '<!-- Teacher preview banner', '</div>')
h0 = r.find('<!-- Bottom action bar')
h1 = r.find('<script>', h0)
HWBAR = r[h0:h1].rstrip() + '\n'
is0 = r.find('/* ── Kid 11 online homework: hero name/date sync')
s0 = r.rfind('<script>', 0, is0)
s1 = r.find('</script>', is0) + len('</script>')
INTEG_JS_RAW = r[s0:s1]

def keys(src):
    return (re.findall(r'data-answer="([^"]*)"', src),
            re.findall(r'data-correct="([^"]*)"', src),
            re.findall(r'data-solution="([^"]*)"', src))

for U in UNITS:
    print(f"== building {U['out']}")
    u = open(U['upload'], encoding='utf-8').read()

    # ── 0. engine patches on the upload (gate→engine bridge, deep-link init) ─
    u = replace1(u,
                 "window.scrollTo({top:0,behavior:'smooth'});\n"
                 "}\n"
                 "$$('.tab').forEach(function(b){",
                 "window.scrollTo({top:0,behavior:'smooth'});\n"
                 "}\n"
                 "window.CMC_HW_SETMODE=setMode;window.CMC_HW_GRADE=grade;\n"
                 "$$('.tab').forEach(function(b){")
    u = replace1(u,
                 "$$('.assignment').forEach(refreshProgress);\n"
                 "setMode('a');",
                 "$$('.assignment').forEach(refreshProgress);\n"
                 "if(!/#hw-[abc]/.test(location.hash))setMode('a');")
    u = replace1(u, f"<title>{U['title']}</title>",
                 f"<title>{U['title'].replace(' · Homeworks 1–3', '')} — Kid 11 Online Homework (Homeworks 1–3)</title>")

    # ── 1. furniture CSS with the unit's own serif ──────────────────────────
    FURN_CSS = replace1(FURN_CSS_RAW, "font-family:'Fraunces',Georgia,serif",
                        f"font-family:'{U['font']}',Georgia,serif")

    # ── 2. gate script (docs u14 → u3/u4, gate copy Unit 14 → unit) ─────────
    GATE_JS = GATE_JS_RAW.replace('hw-kid11-u14-', U['prefix'])
    assert GATE_JS.count(U['prefix'] + 'hw1') >= 1 and GATE_JS.count(U['prefix'] + 'hw2') >= 1 \
        and GATE_JS.count(U['prefix'] + 'hw3') >= 1, 'gate doc names not swapped'
    name = U['unit'].split('· ')[1]
    unum = U['key'].replace('u', '') if 'key' in U else U['unit'].split(' ')[1]
    GATE_JS = replace1(GATE_JS,
                       "the <b>Unit 14 homework</b> (Doctor Fish)",
                       f"the <b>Unit {unum} homework</b> ({name})")
    GATE_JS = replace1(GATE_JS,
                       "Unit 14 · Doctor Fish ships as the teacher's 3-homework file.",
                       f"{U['unit']} ships as the teacher's 3-homework file.")
    assert 'u14' not in GATE_JS and 'Doctor Fish' not in GATE_JS

    # ── 3. integration script (name/date sync + submit + share) ────────────
    INTEG_JS = INTEG_JS_RAW
    INTEG_JS = replace1(INTEG_JS, "a: 'Homework 1 · Spa Intake File',",
                        f"a: 'Homework 1 · {U['hw1']}',")
    INTEG_JS = replace1(INTEG_JS, "b: 'Homework 2 · Treatment Analyst',",
                        f"b: 'Homework 2 · {U['hw2']}',")
    INTEG_JS = replace1(INTEG_JS, "c: 'Homework 3 · Health Writer'",
                        f"c: 'Homework 3 · {U['hw3']}'")
    INTEG_JS = replace1(INTEG_JS,
                        "names the ACTIVE homework (1 Spa Intake File / 2 Treatment Analyst /\n   3 Health Writer)",
                        f"names the ACTIVE homework (1 {U['hw1']} / 2 {U['hw2']} /\n   3 {U['hw3']})")
    INTEG_JS = replace1(INTEG_JS, "drillSlug:   { stringValue: 'doctor-fish.html' },",
                        f"drillSlug:   {{ stringValue: '{U['slug']}' }},")
    INTEG_JS = replace1(INTEG_JS, "'Unit 14 · Doctor Fish — '", f"'{U['unit']} — '")
    INTEG_JS = replace1(INTEG_JS, "'https://cmckhmer.github.io/Creative-Minds-/rfc3/doctor-fish.html'",
                        f"'https://cmckhmer.github.io/Creative-Minds-/rfc3/{U['slug']}'")
    INTEG_JS = replace1(INTEG_JS, "'Kid 11 Online Homework — Unit 14 · Doctor Fish · Homeworks 1–3 (auto-graded)'",
                        f"'Kid 11 Online Homework — {U['unit']} · Homeworks 1–3 (auto-graded)'")
    INTEG_JS = replace1(INTEG_JS, "title: 'Unit 14 · Doctor Fish'", f"title: '{U['unit']}'")
    INTEG_JS = replace1(INTEG_JS, "'Unit 14 · Doctor Fish — Kid 11 Online Homework'",
                        f"'{U['unit']} — Kid 11 Online Homework'")
    for leftover in ['u14', 'Doctor Fish', 'Spa Intake', 'Treatment Analyst',
                     'Health Writer', 'doctor-fish']:
        assert leftover not in INTEG_JS, 'leftover in INTEG_JS: ' + leftover

    # ── 4. assemble ─────────────────────────────────────────────────────────
    out = u
    pm = out.find('@media print{')
    assert pm != -1
    out = out[:pm] + FURN_CSS + PRINT_CSS + out[pm:]
    assert out.count('</head>') == 1
    out = out.replace('</head>', GATE_JS + '\n</head>')
    assert out.count('<body data-mode="a">') == 1
    out = out.replace('<body data-mode="a">',
                      '<body data-mode="a">\n\n' + BACK_BTN + '\n\n' + BANNER)
    assert out.count('<noscript>') == 1
    out = out.replace('<noscript>', HWBAR + '\n<noscript>')
    assert out.count('</body>') == 1
    out = out.replace('</body>', INTEG_JS + '\n</body>')

    # ── 5. sanity: the worksheet content itself must be untouched ───────────
    ka, kc, ks = keys(u)
    oa, oc, os_ = keys(out)
    assert (ka, kc, ks) == (oa, oc, os_), 'graded keys changed!'
    order_items = sum(len(s.split(',')) for s in ks)
    write_tasks = len(re.findall(r'id="w-', out))
    assert write_tasks == 8, 'expected 8 write-task sections, got %d' % write_tasks
    graded_units = len(oa) + len(oc) + order_items + write_tasks
    assert graded_units == U['graded'], 'expected %d graded units, got %d' % (U['graded'], graded_units)
    for fn in ['function grade(root)', 'function setMode(m)', 'function showResults(', 'function resetAll(']:
        assert fn in out, 'engine lost: ' + fn
    assert out.count('window.CMC_HW_SETMODE=setMode;window.CMC_HW_GRADE=grade;') == 1
    assert out.count("if(!/#hw-[abc]/.test(location.hash))setMode('a');") == 1
    assert out.count('class="hw-btn hw-btn-submit" id="submitBtn"') == 1
    assert out.count('id="submitBtn"') == 1
    for leftover in ['doctor-fish', 'hw-kid11-u14', 'Unit 14', 'Spa Intake',
                     'Treatment Analyst', 'Health Writer', 'Fraunces']:
        assert leftover not in out, 'leftover in output: ' + leftover
    assert out.count(U['prefix'] + 'hw1') == 2 and out.count(U['prefix'] + 'hw2') == 1 \
        and out.count(U['prefix'] + 'hw3') == 1, 'share doc ids not exactly placed'
    # the unit's own name must survive everywhere it belongs
    assert U['unit'] in out and out.count(U['slug']) >= 2

    open(U['out'], 'w', encoding='utf-8').write(out)
    print('written', U['out'], len(out), 'bytes;',
          len(oa), 'data-answer +', len(oc), 'data-correct +', order_items,
          'order items +', write_tasks, 'write-tasks =', graded_units, 'graded units')

    # ── 6. node --check both embedded scripts of the OUTPUT ─────────────────
    scripts = re.findall(r'<script>(.*?)</script>', out, re.S)
    ok = 0
    for idx, js in enumerate(scripts):
        if 'function' in js or 'fetch(' in js:
            p = '/tmp/u34_script_%d_%d.js' % (3 if 'unit3' in U['slug'] else 4, idx)
            open(p, 'w', encoding='utf-8').write(js)
            res = subprocess.run(['node', '--check', p], capture_output=True, text=True)
            assert res.returncode == 0, 'script %d syntax error: %s' % (idx, res.stderr[:400])
            ok += 1
    print('node --check passed on', ok, 'embedded scripts')
print('DONE')
