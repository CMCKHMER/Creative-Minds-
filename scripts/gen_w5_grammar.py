#!/usr/bin/env python3
"""Generate private/isec2-w5-grammar.html from private/isec2-w3-grammar.html.

The Aii Level-11b "Toefl Drill: W5" worksheet (teacher's Google Doc, pages 1-2
+ OFFICIAL answer sheet) becomes live assigned test biweek-isec2-w5-grammar:
  - Part 1: 15 multiple-choice grammar items (relative clauses, subjunctive,
    reported speech, verb patterns)
  - Part 2: 10 error-identification items, letters and phrases taken verbatim
    from the teacher's answer sheet
  The answer sheet itself is NOT in this file (public repository): it is read
  from the JSON file named by the CMC_W5_KEY environment variable.

Error-ID prompts follow the W3 page's established convention: [A]..[D] markers
placed immediately BEFORE their segment, choices = the four segment texts,
letters ascending in sentence order — arranged so each official letter lands
on its official error phrase. All 25 questions are single-select radio; no
runtime changes needed. Answers are NOT embedded — key installed via panel.
"""
import json
import re

SRC = "public/biweek-planner/tests/private/isec2-w3-grammar.html"
DST = "public/biweek-planner/tests/private/isec2-w5-grammar.html"

G1 = "w5g-mc"
G2 = "w5g-error"

questions = [
    # ── Part 1 · Multiple Choice (doc page 1-2, verbatim) ──
    {"gid": G1, "qnum": 1,
     "prompt": "The old house, ___ is said to be haunted, stands at the end of the street.",
     "choices": ["who", "which", "what", "whom"]},
    {"gid": G1, "qnum": 2,
     "prompt": "The villagers suggested that we ___ the abandoned graveyard after dark.",
     "choices": ["avoid", "avoided", "avoiding", "avoids"]},
    {"gid": G1, "qnum": 3,
     "prompt": "Do you mind if I ___ a photo of the strange light in the sky?",
     "choices": ["take", "took", "taking", "takes"]},
    {"gid": G1, "qnum": 4,
     "prompt": "The scientist ___ discovered the signal from space works at a famous observatory.",
     "choices": ["where", "who", "which", "what"]},
    {"gid": G1, "qnum": 5,
     "prompt": "I wish I ___ brave enough to spend a night in that haunted castle.",
     "choices": ["am", "will be", "were", "have been"]},
    {"gid": G1, "qnum": 6,
     "prompt": "The witness asked if the strange figure ___ speak any human language.",
     "choices": ["can", "could", "will", "may"]},
    {"gid": G1, "qnum": 7,
     "prompt": "The UFO sighting ___ was reported by several people remains unexplained.",
     "choices": ["what", "who", "which", "where"]},
    {"gid": G1, "qnum": 8,
     "prompt": "The team decided ___ the cave despite the ghost stories.",
     "choices": ["explore", "exploring", "to explore", "explored"]},
    {"gid": G1, "qnum": 9,
     "prompt": "Do you feel like ___ a documentary about alien abductions tonight?",
     "choices": ["watch", "to watch", "watching", "watched"]},
    {"gid": G1, "qnum": 10,
     "prompt": "This is the forest ___ people claim to have seen glowing creatures.",
     "choices": ["which", "that", "who", "where"]},
    {"gid": G1, "qnum": 11,
     "prompt": "It's time we ___ the truth about the mysterious disappearances.",
     "choices": ["discover", "discovered", "discovering", "to discover"]},
    {"gid": G1, "qnum": 12,
     "prompt": "The girl said that she ___ seen a shadow move across her bedroom wall.",
     "choices": ["has", "had", "have", "having"]},
    {"gid": G1, "qnum": 13,
     "prompt": "The belief ___ aliens have visited Earth is popular among some people.",
     "choices": ["which", "that", "what", "who"]},
    {"gid": G1, "qnum": 14,
     "prompt": "Would you rather ___ a ghost or meet an alien?",
     "choices": ["see", "saw", "to see", "seeing"]},
    {"gid": G1, "qnum": 15,
     "prompt": "The man ___ lives in the lighthouse claims he has communicated with extraterrestrials.",
     "choices": ["which", "what", "who", "whom"]},
    # ── Part 2 · Error Identification (official key letters baked in) ──
    {"gid": G2, "qnum": 16,
     "prompt": "My friends don't mind [A] me to stay [B] in the haunted house [C] overnight, [D] but I must be careful.",
     "choices": ["me to stay", "in the haunted house", "overnight,", "but I must be careful"]},
    {"gid": G2, "qnum": 17,
     "prompt": "The strange lights [A] that appeared [B] in the sky last night [C] was seen [D] by many people.",
     "choices": ["that appeared", "in the sky last night", "was seen", "by many people"]},
    {"gid": G2, "qnum": 18,
     "prompt": "[A] Although [B] the house is old, [C] but [D] it is still in good condition.",
     "choices": ["Although", "the house is old,", "but", "it is still in good condition."]},
    {"gid": G2, "qnum": 19,
     "prompt": "Would you mind [A] to help me [B] investigate [C] the mysterious noise [D] in the attic?",
     "choices": ["to help me", "investigate", "the mysterious noise", "in the attic"]},
    {"gid": G2, "qnum": 20,
     "prompt": "[A] If I had a camera, I [B] will take [C] a picture [D] of the UFO.",
     "choices": ["If I had a camera, I", "will take", "a picture", "of the UFO."]},
    {"gid": G2, "qnum": 21,
     "prompt": "The alien creature [A] who [B] was caught [C] on camera has [D] not been identified yet.",
     "choices": ["who", "was caught", "on camera", "not been identified yet"]},
    {"gid": G2, "qnum": 22,
     "prompt": "We haven't [A] seen any ghosts [B] since we [C] move [D] into this old hotel.",
     "choices": ["seen any ghosts", "since we", "move", "into this old hotel"]},
    {"gid": G2, "qnum": 23,
     "prompt": "The teacher made us [A] to write [B] a report [C] about the possibility of [D] life on other planets.",
     "choices": ["to write", "a report", "about the possibility of", "life on other planets"]},
    {"gid": G2, "qnum": 24,
     "prompt": "The village [A] in where [B] they live [C] is now [D] a popular tourist attraction.",
     "choices": ["in where", "they live", "is now", "a popular tourist attraction."]},
    {"gid": G2, "qnum": 25,
     "prompt": "Because [A] the ghost story [B] was terrifying, [C] so [D] the children refused to sleep alone.",
     "choices": ["the ghost story", "was terrifying,", "so", "the children refused to sleep alone."]},
]

# Official answer sheet letters (1-based qnum -> letter), Part 1 + Part 2.
# NOT kept in this file: the repository is public. Point CMC_W5_KEY at a JSON
# file outside version control, e.g. {"1": "B", "2": "A", ...} (25 entries).
import os
_key_path = os.environ.get("CMC_W5_KEY", "")
if not _key_path or not os.path.exists(_key_path):
    raise SystemExit("Set CMC_W5_KEY to the official answer sheet JSON (kept outside the repo).")
with open(_key_path, encoding="utf-8") as _fh:
    OFFICIAL = {int(k): str(v).upper() for k, v in json.load(_fh).items()}
assert sorted(OFFICIAL) == list(range(1, 26)), "the answer sheet needs letters for questions 1-25"
LETTER_IDX = {"A": 0, "B": 1, "C": 2, "D": 3}

payload = {
    "testId": "biweek-isec2-w5-grammar",
    "meta": {
        "title": "W5 \u00b7 Grammar: Mysteries & the Unexplained",
        "kicker": "Week 5 \u00b7 Level 11b \u00b7 Grammar",
        "icon": "fa-ghost",
        "color": "#a78bfa",
        "instructions": (
            "Aii Level 11b TOEFL Drill (W5 \u00b7 Grammar). Ghosts, UFOs and strange lights \u2014 25 items in two "
            "parts: Part 1, choose the best option to complete each sentence (15 questions); Part 2, identify "
            "the ONE lettered part of each sentence that must be changed (10 questions)."
        ),
        "transcript": "",
        "fields": ["name", "date"],
    },
    "groups": [
        {"id": G1, "title": "Part 1 \u00b7 Multiple Choice (Questions 1\u201315)",
         "focus": "Choose the best option to complete each sentence.", "dirs": ""},
        {"id": G2, "title": "Part 2 \u00b7 Error Identification (Questions 16\u201325)",
         "focus": "Each sentence has four lettered parts, [A]\u2013[D]. Identify the ONE underlined part that must be changed and choose its letter.",
         "dirs": ""},
    ],
    "questions": questions,
}

html = open(SRC, encoding="utf-8").read()
orig = html

# 1) <title>
html = html.replace(
    "<title>ISEC II \u00b7 C1 Grammar: Conciseness & Precision \u00b7 TOEFL ITP \u2014 Private (teacher-scored)</title>",
    "<title>W5 \u00b7 Grammar: Mysteries & the Unexplained \u00b7 TOEFL Drill \u2014 Private (teacher-scored)</title>",
)

# 2) Test payload
payload_js = "window.CMC_PRIVATE_TEST=" + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";"
html, n = re.subn(r"window\.CMC_PRIVATE_TEST=\{.*?\};", lambda m: payload_js, html, count=1, flags=re.S)
assert n == 1, "payload line not found"

assert html != orig
open(DST, "w", encoding="utf-8").write(html)

# ── Self-verification ────────────────────────────────────────────────
out = open(DST, encoding="utf-8").read()
m = re.search(r"window\.CMC_PRIVATE_TEST=(\{.*?\});", out, flags=re.S)
data = json.loads(m.group(1))
qnums = [q["qnum"] for q in data["questions"]]
assert qnums == list(range(1, 26)), qnums
assert all(len(q["choices"]) == 4 for q in data["questions"])
assert not any(q.get("multi") for q in data["questions"])
# every official letter must exist as a choice index in range
for q in data["questions"]:
    assert LETTER_IDX[OFFICIAL[q["qnum"]]] < len(q["choices"])
# every Part 2 prompt carries exactly the 4 markers in order
for q in data["questions"]:
    if q["gid"] == G2:
        marks = re.findall(r"\[([A-D])\]", q["prompt"])
        assert marks == ["A", "B", "C", "D"], (q["qnum"], marks)
assert "test_submissions" in out and "translate=\"no\"" in out
print("OK  wrote", DST, len(out), "bytes")
print("OK  payload: 25 questions (15 MC + 10 error-ID), official letters consistent")
print("OK  official key loaded from CMC_W5_KEY (25 letters, not printed)")
