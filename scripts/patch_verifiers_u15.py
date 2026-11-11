#!/usr/bin/env python3
"""Patch the two existing homework verifiers for the Unit 15 rows:
- every browser context now also closes the u15 share docs (no network),
- fold-count labels grow by the three Unit 15 rows (teacher view),
- Doctor Fish badge 8 -> 11 resources."""
import re

U13 = '/home/z/my-project/tmp/cmc-site/scripts/verify_unit13_homework.mjs'
DF = '/home/z/my-project/tmp/cmc-site/scripts/verify_doctor_fish.mjs'

# ── verify_unit13_homework.mjs ─────────────────────────────────────────────
s = open(U13, encoding='utf-8').read()

# 1. route constant + closed-route helper next to the existing ones
old = "const DF_ROUTE = '**/documents/biweekly_tests/hw-kid11-doctor-fish*';"
assert s.count(old) == 1
s = s.replace(old, old + "\nconst U15_ROUTE = '**/documents/biweekly_tests/hw-kid11-u15-hw*';\n"
             "// Unit 15 exists in the data file but stays CLOSED for every Unit 13\n"
             "// scenario here — closed docs must never leak to the real network.\n"
             "const routeU15Closed = (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{\"error\":{\"code\":404}}' });")

# 2. insert a u15 closed route after every U13_ROUTE route call
pat = re.compile(r"^([ \t]*await page\.route\(U13_ROUTE,[^\n]*)$", re.M)
s, n = pat.subn(lambda m: m.group(1) + "\n  await page.route(U15_ROUTE, routeU15Closed);", s)
print('u13 verifier: inserted u15 route after', n, 'U13 route lines')
assert n == 12, 'expected 12 U13 route lines'

# 3. fold labels: teacher now sees 7 homework rows (DF + 3 u13 + 3 u15)
assert s.count("'More homeworks · 2 more'") == 2
s = s.replace("'More homeworks · 2 more'", "'More homeworks · 5 more'")
assert s.count("'More homeworks · 1 more'") == 1
s = s.replace("'More homeworks · 1 more'", "'More homeworks · 4 more'")
s = s.replace("'fold label counts the two rows still folded away'",
              "'fold label counts the five rows still folded away (Doctor Fish + HW1 visible; HW2, HW3 and the three Unit 15 rows folded)'")
s = s.replace("'fold label counts only the one still-hidden row'",
              "'fold label counts the four still-hidden rows (HW2 + the three Unit 15 rows)'")
open(U13, 'w', encoding='utf-8').write(s)
print('u13 verifier patched')

# ── verify_doctor_fish.mjs ─────────────────────────────────────────────────
d = open(DF, encoding='utf-8').read()
pat2 = re.compile(r"^([ \t]*await (?:ctx|page)\.route\('\*\*/documents/biweekly_tests/hw-kid11-u13-hw\*',[^\n]*\}\)\);)[ \t]*$", re.M)
d, n2 = pat2.subn(lambda m: m.group(1) + "\n" + re.match(r"^([ \t]*)", m.group(1)).group(1)
                  + "await " + re.search(r"await (ctx|page)\.route", m.group(1)).group(1)
                  + ".route('**/documents/biweekly_tests/hw-kid11-u15-hw*', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{\"error\":{\"code\":404}}' }));",
                  d)
print('doctor fish verifier: inserted u15 route after', n2, 'u13 route lines')
assert n2 == 12, 'expected 12 u13 route lines in doctor fish verifier'
assert d.count("'8 resources'") == 1
d = d.replace("'8 resources'", "'11 resources'")
d = d.replace('8 resources: 4 sheets + Doctor Fish + 3 Unit 13 homeworks',
              '11 resources: 4 sheets + Doctor Fish + 3 Unit 13 + 3 Unit 15 homeworks')
open(DF, 'w', encoding='utf-8').write(d)
print('doctor fish verifier patched')

for p in (U13, DF):
    r = open(p, encoding='utf-8').read()
    assert 'hw-kid11-u15-hw*' in r
print('both verifiers reference the u15 docs')
