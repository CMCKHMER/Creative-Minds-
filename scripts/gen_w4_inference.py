#!/usr/bin/env python3
"""Generate private/isec2-w4-inference.html from private/isec2-w4-reading.html.

The Aii Level-11b "Toefl Drill: W4 - Reading/Recognizing Inference" worksheet
(source: teacher's Google Doc, pages 1-3) becomes a live assigned test:
  - Section 1: 7 comprehension MCQs (Q1, Q3, Q6 are multi-select)
  - Section 2: 5 inference-type questions (Cause/Comparative/Predictive/
    Emotional-Attitudinal/Generalization)
  - Section 3: 5 Support-or-Assume items (S/A)

The clone inherits the full CMC-PRIVATE-TEST-V1 runtime (student auth gate,
assignment window, locked timer, one-attempt submission to test_submissions).
Only four things change: <title>, the reading-passage card, the
window.CMC_PRIVATE_TEST payload, and a runtime extension that lets a question
declare multi:true so its options render as checkboxes (collectAnswers already
joins every checked value into the "0|2" form the teacher-side grader expects).
Answers are NOT embedded in the page — the key is installed via the panel.
"""
import json
import re
import sys

SRC = "public/biweek-planner/tests/private/isec2-w4-reading.html"
DST = "public/biweek-planner/tests/private/isec2-w4-inference.html"

PASSAGE = (
    "Keeping a city clean is not only the job of sanitation workers. It is a shared habit that "
    "grows when people feel responsible, respected, and able to act. First, cities can make "
    "cleaning easy. Placing enough bins in busy areas, emptying them often, and offering "
    "separate containers for recyclables reduce the excuse to litter. Clear signs with simple "
    "pictures help residents and visitors know what goes where. Second, encouragement works "
    "better than shame. Public campaigns that show proud neighborhoods, clean streets, and "
    "happy children are more likely to inspire change than posters that call people dirty. "
    "Third, involve local people. Schools can organize clean-up days, businesses can adopt a "
    "street or park, and community groups can report overflowing bins or illegal dumping. When "
    "residents help design solutions, they protect them. Fourth, reward good habits. Small "
    "prizes for clean classrooms, streets, or markets can create friendly competition. It also "
    "reduces health risks and makes public spaces more pleasant. Finally, enforcement must be "
    "fair. Fines may be necessary for repeated dumping, but they should be paired with "
    "education and practical alternatives. If a neighborhood has no bins, fining people for "
    "littering feels unjust. A clean city is built by daily choices: putting waste in the "
    "right place, teaching children by example, and speaking up when public spaces are "
    "neglected. When leaders, businesses, and residents work together, cleanliness becomes "
    "normal, not a special event. The goal is not a perfectly spotless city for a day, but a "
    "healthy, proud place to live every day."
)

G1 = "w4i-comprehension"
G2 = "w4i-inference-types"
G3 = "w4i-support-assume"

TYPE_CHOICES = ["Cause", "Comparative", "Predictive", "Emotional / Attitudinal", "Generalization"]
SA_CHOICES = ["S \u2014 directly supported by the reading", "A \u2014 assumed or not directly supported"]

questions = [
    # ── Section 1 · Comprehension (doc: "7 Comprehension Questions") ──
    {"gid": G1, "qnum": 1, "multi": True,
     "prompt": "According to the passage, what makes it easier for people not to litter? (Choose TWO.)",
     "choices": ["Placing enough bins in busy areas", "Emptying bins often",
                 "Calling people dirty", "Reducing public signs"]},
    {"gid": G1, "qnum": 2,
     "prompt": "Why does the author say encouragement works better than shame?",
     "choices": ["Shame always leads to fines.",
                 "Positive campaigns are more likely to inspire change.",
                 "Shame never teaches sorting rules.",
                 "Encouragement replaces all enforcement."]},
    {"gid": G1, "qnum": 3, "multi": True,
     "prompt": "How can local people get involved? (Choose THREE.)",
     "choices": ["Schools organize clean-up days.", "Businesses adopt a street or park.",
                 "Community groups report overflowing bins.", "Residents ignore illegal dumping."]},
    {"gid": G1, "qnum": 4,
     "prompt": "What does the passage say about rewards?",
     "choices": ["They can create friendly competition.", "They should be large and expensive.",
                 "They are only for sanitation workers.", "They replace the need for bins."]},
    {"gid": G1, "qnum": 5,
     "prompt": "What is the author's view on fines?",
     "choices": ["Fines are always unjust.", "Fines should never be used.",
                 "Fines may be needed but must be fair and paired with education.",
                 "Fines are the only way to keep a city clean."]},
    {"gid": G1, "qnum": 6, "multi": True,
     "prompt": "What does the author mean by \"cleanliness becomes normal, not a special event\"? (Choose TWO.)",
     "choices": ["Cleaning should happen every day.", "Clean-up days are the only solution.",
                 "A clean city should not depend on one-time campaigns.",
                 "People should only clean during festivals."]},
    {"gid": G1, "qnum": 7,
     "prompt": "Which statement best states the main idea?",
     "choices": ["Sanitation workers alone are responsible for clean cities.",
                 "Keeping a city clean requires shared daily habits, practical support, positive involvement, and fair enforcement.",
                 "Shaming people is the most effective way to stop littering.",
                 "Fines are more important than education."]},
    # ── Section 2 · Recognizing Inference Types (doc: "5 Exercise") ──
    {"gid": G2, "qnum": 8,
     "prompt": "\u201cThe author suggests that shaming people is less effective than encouraging them.\u201d What type of inference is this?",
     "choices": list(TYPE_CHOICES)},
    {"gid": G2, "qnum": 9,
     "prompt": "\u201cThe author implies that if a neighborhood has no bins, fines will feel unjust.\u201d What type of inference is this?",
     "choices": list(TYPE_CHOICES)},
    {"gid": G2, "qnum": 10,
     "prompt": "\u201cThe author expects that when residents help design solutions, they will protect them.\u201d What type of inference is this?",
     "choices": list(TYPE_CHOICES)},
    {"gid": G2, "qnum": 11,
     "prompt": "\u201cThe author feels that proud neighborhoods and happy children are inspiring images.\u201d What type of inference is this?",
     "choices": list(TYPE_CHOICES)},
    {"gid": G2, "qnum": 12,
     "prompt": "\u201cThe author concludes that a clean city is built by daily choices, not a special event.\u201d What type of inference is this?",
     "choices": list(TYPE_CHOICES)},
    # ── Section 3 · Support or Assume? (doc: "5 Activity") ──
    {"gid": G3, "qnum": 13, "prompt": "Sanitation workers alone cannot keep a city clean.",
     "choices": list(SA_CHOICES)},
    {"gid": G3, "qnum": 14, "prompt": "Positive public campaigns are more likely to inspire change than shaming.",
     "choices": list(SA_CHOICES)},
    {"gid": G3, "qnum": 15, "prompt": "Small prizes always make people keep streets clean.",
     "choices": list(SA_CHOICES)},
    {"gid": G3, "qnum": 16, "prompt": "If there are no bins, fining people for littering feels unjust.",
     "choices": list(SA_CHOICES)},
    {"gid": G3, "qnum": 17, "prompt": "Cleanliness should become a special event.",
     "choices": list(SA_CHOICES)},
]

payload = {
    "testId": "biweek-isec2-w4-inference",
    "meta": {
        "title": "W4 \u00b7 Reading: Recognizing Inference \u2014 Keep a City Clean",
        "kicker": "Week 4 \u00b7 Level 11b \u00b7 Reading / Inference",
        "icon": "fa-lightbulb",
        "color": "#fbbf24",
        "instructions": (
            "Aii Level 11b TOEFL Drill (W4 \u00b7 Reading / Recognizing Inference). Read the passage "
            "\u201cHow to Encourage People to Keep a City Clean\u201d and answer 17 items in three sections: "
            "7 comprehension questions, 5 inference-type questions, and a Support-or-Assume activity. "
            "Questions 1, 3 and 6 are multi-select \u2014 tick exactly as many answers as the question asks for."
        ),
        "transcript": "",
        "fields": ["name", "date"],
    },
    "groups": [
        {"id": G1, "title": "Section 1 \u00b7 Comprehension (Questions 1\u20137)",
         "focus": "Questions 1, 3 and 6 are multi-select \u2014 choose exactly TWO or THREE as asked.",
         "dirs": ""},
        {"id": G2, "title": "Section 2 \u00b7 Recognizing Inference Types (Questions 8\u201312)",
         "focus": "Each type \u2014 Cause, Comparative, Predictive, Emotional / Attitudinal, Generalization \u2014 is used exactly once.",
         "dirs": ""},
        {"id": G3, "title": "Section 3 \u00b7 Support or Assume? (Questions 13\u201317)",
         "focus": "S = directly supported by the reading \u00b7 A = assumed or not directly supported.",
         "dirs": ""},
    ],
    "questions": questions,
}

html = open(SRC, encoding="utf-8").read()
orig = html

# 1) <title>
html = html.replace(
    "<title>ISEC II \u00b7 C2 Reading: Corporate Epistemology \u00b7 TOEFL ITP \u2014 Private (teacher-scored)</title>",
    "<title>W4 \u00b7 Reading: Recognizing Inference \u2014 Keep a City Clean \u00b7 TOEFL Drill \u2014 Private (teacher-scored)</title>",
)

# 2) Reading-passage card (the static amber glass block between #qmap and #test-form)
html = re.sub(
    r'(<div class="glass rounded-lg p-4 mb-4 border-l-2" style="border-left-color:#fbbf24">)'
    r'.*?(</p></div>)',
    lambda m: m.group(1)
    + '<h4 class="text-xs font-bold text-amber-300 mb-2">Reading Passage \u2014 How to Encourage People to Keep a City Clean</h4>'
    + '<p class="text-xs text-slate-300 whitespace-pre-line leading-relaxed">'
    + PASSAGE
    + m.group(2),
    html, count=1, flags=re.S,
)

# 3) Test payload (single long line beginning window.CMC_PRIVATE_TEST=)
payload_js = "window.CMC_PRIVATE_TEST=" + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";"
html, n = re.subn(r"window\.CMC_PRIVATE_TEST=\{.*?\};", lambda m: payload_js, html, count=1, flags=re.S)
assert n == 1, "payload line not found"

# 4) Runtime: allow per-question checkbox (multi-select) rendering.
radio_line = 'return \'<label class="option"><input type="radio" name="\'+q.gid+\'-q\'+q.qnum+\'" value="\'+i+\'"><span class="option-letter text-xs">\'+String.fromCharCode(65+i)+\'.</span><span class="text-xs text-slate-300">\'+choice+\'</span></label>\';'
multi_line = ('var inpType=q.multi?\'checkbox\':\'radio\';'
              'return \'<label class="option"><input type="\'+inpType+\'" name="\'+q.gid+\'-q\'+q.qnum+\'" value="\'+i+\'">'
              '<span class="option-letter text-xs">\'+String.fromCharCode(65+i)+\'.</span>'
              '<span class="text-xs text-slate-300">\'+choice+\'</span></label>\';')
assert radio_line in html, "runtime radio line not found"
html = html.replace(radio_line, multi_line)

assert html != orig
open(DST, "w", encoding="utf-8").write(html)

# ── Self-verification ────────────────────────────────────────────────
out = open(DST, encoding="utf-8").read()
m = re.search(r"window\.CMC_PRIVATE_TEST=(\{.*?\});", out, flags=re.S)
data = json.loads(m.group(1))
qnums = [q["qnum"] for q in data["questions"]]
multis = [q["qnum"] for q in data["questions"] if q.get("multi")]
assert qnums == list(range(1, 18)), qnums
assert multis == [1, 3, 6], multis
assert all(len(q["choices"]) in (2, 4, 5) for q in data["questions"])
assert "test_submissions" in out and "translate=\"no\"" in out and "notranslate" in out
assert PASSAGE[:60] in out
print("OK  wrote", DST, len(out), "bytes")
print("OK  payload:", len(data["questions"]), "questions, qnums 1..17 contiguous, multi =", multis)
print("OK  runtime checkbox patch present:", "inpType=q.multi?'checkbox':'radio'" in out)
