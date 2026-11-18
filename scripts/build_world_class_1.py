#!/usr/bin/env python3
"""
Builds the synced, CMC-glass-themed, bug-fixed World Class 1 Teacher's Edition
under public/gep/world-class-1/ from the 12 uploaded unit HTML files:
  - index.html        : Book Overview Hub (live search, filters, progress, Scope & Sequence)
  - main.html         : Redirect alias -> index.html (preserves legacy links/bookmarks)
  - unit.html         : Unit 1  — Who We Are
  - unit2.html..12    : Units 2 — 12

Fixes applied across all 12 units:
  1. Removes all <base target="_blank"> tags (which broke #anchors & unit navigation).
  2. Unifies top navigation on all 12 units (including orphaned Unit 8, which lacked
     top-nav and linked to missing WorldClass1_Overview.html) + bottom Prev/Overview/Next pager.
  3. Replaces broken inline <script> blocks (fixing U4/U5 document-wide querySelectorAll
     vocab/grammar collision, U6 dropped 'that' relative clauses, U6-U12 substring
     false-positives, U3 sticky selectTopic highlight, U3 unchecked-checkbox 3/5 trap,
     and dead functions) with the shared, exercise-scoped wc1-engine.js.
  4. Expands data-answer with verified linguistic alternatives (past continuous/simple,
     present perfect continuous, both adverbial clause orders, which/that relative clauses,
     comparatives with/without 'much', US/UK spellings, contractions) and adds verified
     answer keys + Check / Show Key / Reset bars to Reading T/F/P, Listening T/F &
     transcript fills, Video T/F, Unit 2 Beijing MCQ, and Unit 3 Energy T/F quiz.
  5. Strips light-only inline background/color styles so every element meets contrast in
     both dark smoked-glass and light pale-slate milk-glass CMC themes.
  6. Adds synchronous teacher-gate.js in <head> for pre-paint theme sync & teacher access.
"""

from __future__ import annotations
import html
import os
import re

SRC_DIR = "/tmp/arena-coding-uploads"
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "gep", "world-class-1")

UNIT_META = [
    (1,  "unit.html",   "Who We Are",                 "Review of Past Tenses",                         "#6fb1fb"),
    (2,  "unit2.html",  "The World Awaits",           "Uses of Infinitives and Gerunds",               "#38bdf8"),
    (3,  "unit3.html",  "The Great Energy Challenge", "Review of Future Forms",                        "#34d399"),
    (4,  "unit4.html",  "The World's a Stage",        "Infinitive Complements",                        "#a78bfa"),
    (5,  "unit5.html",  "No Need to Panic",           "Adverbial Clauses",                             "#fb7185"),
    (6,  "unit6.html",  "In Style",                   "Adjective Clauses (Subject Relative Pronouns)", "#f472b6"),
    (7,  "unit7.html",  "On the Move",                "Comparative Forms",                             "#2dd4bf"),
    (8,  "unit8.html",  "Think Twice",                "Past Modals",                                   "#818cf8"),
    (9,  "unit9.html",  "In the Wild",                "Review of Passive Voice",                       "#4ade80"),
    (10, "unit10.html", "Decisions, Decisions",       "First & Second Conditionals",                   "#fbbf24"),
    (11, "unit11.html", "Rain or Shine",              "Phrasal Verbs",                                 "#60a5fa"),
    (12, "unit12.html", "What's Your Game",           "Reported Speech",                               "#8198ff"),
]

# Expanded accepted alternatives for existing data-answer blanks (unit, index) -> full answer string
EXPANDED_ANSWERS: dict[int, dict[str, str]] = {
    1: {
        "was attending": "was attending | attended",
        "has lived": "has lived | has been living",
        "has worked": "has worked | has been working",
        "smoked": "smoked | has smoked",
        "have talked": "have talked | have been talking",
    },
    3: {
        "am meeting": "am meeting | am going to meet",
    },
    5: {
        "The equipment stopped working because the temperature dropped to -40°C.":
            "The equipment stopped working because the temperature dropped to -40°C. | Because the temperature dropped to -40°C, the equipment stopped working. | Since the temperature dropped to -40°C, the equipment stopped working.",
        "Although the climber was injured, he refused to quit.":
            "Although the climber was injured, he refused to quit. | Even though the climber was injured, he refused to quit. | Though the climber was injured, he refused to quit. | The climber refused to quit although he was injured.",
        "If you feel symptoms of altitude sickness, you should descend immediately.":
            "If you feel symptoms of altitude sickness, you should descend immediately. | You should descend immediately if you feel symptoms of altitude sickness.",
        "The survivors had been waiting for 48 hours when the rescue team arrived.":
            "The survivors had been waiting for 48 hours when the rescue team arrived. | When the rescue team arrived, the survivors had been waiting for 48 hours. | By the time the rescue team arrived, the survivors had been waiting for 48 hours.",
    },
    7: {
        "much more expensive": "much more expensive | more expensive",
    },
    8: {
        "might have misunderstood": "might have misunderstood | may have misunderstood | could have misunderstood",
        "could have taken": "could have taken | should have taken",
    },
    10: {
        "were": "were | was",
        "do not leave": "do not leave | don't leave",
    },
    12: {
        "practiced": "practiced | practised",
        "the following month": "the following month | the next month",
        "had learned": "had learned | had learnt",
    },
}

# Verified True/False/Possible keys per (unit, card_id)
TFP_KEYS: dict[tuple[int, str], list[str]] = {
    (1, "video"):     ["T", "T", "F", "T", "T"],
    (1, "reading"):   ["F", "T", "T", "P", "T", "P", "F", "P"],
    (3, "reading"):   ["T", "F", "T", "F", "T"],
    (4, "listening"): ["T", "F", "F", "T"],
    (4, "reading"):   ["F", "T", "F", "T", "F"],
    (5, "reading"):   ["F", "T", "F", "T", "T"],
    (5, "video"):     ["F", "T", "T", "F"],
    (6, "listening"): ["F", "T", "F", "T"],
    (6, "reading"):   ["T", "F", "T", "F", "F"],
    (6, "video"):     ["F", "T", "T", "F"],
    (7, "listening"): ["T", "F", "T", "T"],
    (7, "reading"):   ["F", "T", "T", "F", "F"],
    (7, "video"):     ["F", "T", "F", "T"],
    (8, "listening"): ["T", "F", "T", "T"],
    (8, "reading"):   ["F", "T", "F", "T", "F"],
    (8, "video"):     ["F", "T", "F", "T"],
    (9, "listening"): ["T", "F", "F", "T"],
    (9, "reading"):   ["T", "F", "T", "F", "T"],
    (9, "video"):     ["T", "F", "T", "F"],
    (10, "listening"): ["F", "T", "F", "T"],
    (10, "reading"):   ["F", "F", "T", "F", "T"],
    (10, "video"):     ["F", "T", "F", "T"],
    (11, "listening"): ["F", "T", "F", "T"],
    (11, "reading"):   ["F", "T", "T", "F", "T", "T", "T", "T"],  # Ex B (5) + Ex C (3)
    (11, "video"):     ["T", "F", "T", "T"],
    (12, "listening"): ["F", "T", "F", "T"],
    (12, "reading"):   ["F", "F", "T", "F", "T"],
    (12, "video"):     ["F", "T", "F", "T"],
}

# Verified Listening B transcript grammar gap-fills where parenthetical prompts make answers unambiguous
LISTENING_B_ANSWERS: dict[int, list[str]] = {
    6: [
        "that they sell | which they sell | they sell",
        "who created | that created",
        "that is | which is",
        "who is",
        "that matches | which matches",
    ],
    8: [
        "should have thought",
        "must feel | must have felt",
        "could have asked | should have asked",
        "might not have realized | might not have realised",
        "permanent",
        "reputation",
    ],
    10: [
        "decided",
        "ate | had eaten",
        "would feel | would have felt",
        "was able",
        "skip | skipped",
        "will probably skip | would probably skip",
        "was",
        "said | had said",
        "would help | would have helped",
        "would not learn | wouldn't learn | would not have learned",
    ],
    11: [
        "broke",
        "ended",
        "decided",
        "turned",
        "spent",
        "went",
        "hid",
    ],
    12: [
        "have been training | have trained | trained",
        "start",
        "watches",
        "feel",
        "lose",
        "Don't give | Do not give",
        "discipline",
    ],
}

ACTION_BAR_HTML = (
    '<div class="wc1-actions">'
    '<button type="button" class="check-btn" onclick="WC1.checkExercise(this)">Check Answers</button>'
    '<button type="button" class="wc1-key-btn" aria-pressed="false" onclick="WC1.toggleExerciseKey(this)">🔑 Show Key</button>'
    '<button type="button" class="wc1-reset-btn" onclick="WC1.resetExercise(this)">Reset</button>'
    '</div>'
    '<div class="feedback" role="status" aria-live="polite"></div>'
)


def strip_tags(s: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s))).strip()


def render_topbar(active_unit: int | None) -> str:
    pills = []
    for num, fn, title, _, _ in UNIT_META:
        cls = "wc1-unit-pill active" if num == active_unit else "wc1-unit-pill"
        cur = ' aria-current="page"' if num == active_unit else ""
        pills.append(
            f'<a href="{fn}" class="{cls}" data-unit-num="{num}"{cur} '
            f'title="Unit {num}: {html.escape(title)}">{num}</a>'
        )

    left_links = [
        '<a href="../../#gep-isec" class="wc1-pill-link" data-wc1-cmc-home title="Back to Creative Minds GEP &amp; ISEC">← CMC GEP</a>'
    ]
    if active_unit is not None:
        left_links.append('<a href="index.html" class="wc1-pill-link wc1-brand" title="World Class 1 Book Overview">📚 Overview</a>')
    else:
        left_links.append('<span class="wc1-pill-link wc1-brand" aria-current="page">📚 World Class 1</span>')

    right_controls = []
    if active_unit is not None:
        if active_unit > 1:
            prev_fn = UNIT_META[active_unit - 2][1]
            right_controls.append(f'<a href="{prev_fn}" class="wc1-pill-link wc1-hide-sm" title="Previous Unit (Alt+←)">← Prev</a>')
        if active_unit < 12:
            next_fn = UNIT_META[active_unit][1]
            right_controls.append(f'<a href="{next_fn}" class="wc1-pill-link wc1-hide-sm" title="Next Unit (Alt+→)">Next →</a>')
        right_controls.append('<button type="button" class="wc1-tool-btn" data-wc1-keys aria-pressed="false" title="Toggle all teacher answer keys">🔑 Answer Key</button>')
    right_controls.append('<button type="button" class="wc1-tool-btn" data-wc1-theme aria-pressed="false" title="Toggle dark / light site theme">🌙 Dark</button>')
    right_controls.append('<button type="button" class="wc1-tool-btn wc1-hide-sm" data-wc1-print title="Print clean classroom copy">🖨️ Print</button>')

    return (
        '<nav class="wc1-topbar" aria-label="World Class 1 book navigation">\n'
        f'  <div class="wc1-nav-left">{"".join(left_links)}</div>\n'
        f'  <div class="wc1-unit-strip" role="list" aria-label="Jump to unit">{"".join(pills)}</div>\n'
        f'  <div class="wc1-nav-right">{"".join(right_controls)}</div>\n'
        '</nav>'
    )


def render_pager(unit_num: int) -> str:
    if unit_num > 1:
        pnum, pfn, ptitle, _, _ = UNIT_META[unit_num - 2]
        prev_html = (
            f'<a href="{pfn}" class="wc1-pager-link is-prev">'
            f'<span class="wc1-pager-kicker">← Previous · Unit {pnum}</span>'
            f'<span class="wc1-pager-title">{html.escape(ptitle)}</span></a>'
        )
    else:
        prev_html = (
            '<a href="index.html" class="wc1-pager-link is-prev">'
            '<span class="wc1-pager-kicker">← Book Cover</span>'
            '<span class="wc1-pager-title">All 12 Units Overview</span></a>'
        )

    center_html = (
        '<a href="index.html" class="wc1-pager-link is-center">'
        '<span class="wc1-pager-kicker">Teacher\'s Book</span>'
        '<span class="wc1-pager-title">📚 Table of Contents</span></a>'
    )

    if unit_num < 12:
        nnum, nfn, ntitle, _, _ = UNIT_META[unit_num]
        next_html = (
            f'<a href="{nfn}" class="wc1-pager-link is-next">'
            f'<span class="wc1-pager-kicker">Next · Unit {nnum} →</span>'
            f'<span class="wc1-pager-title">{html.escape(ntitle)}</span></a>'
        )
    else:
        next_html = (
            '<a href="index.html" class="wc1-pager-link is-next">'
            '<span class="wc1-pager-kicker">Book Complete →</span>'
            '<span class="wc1-pager-title">Back to World Class 1 Hub</span></a>'
        )

    return f'<nav class="wc1-pager" aria-label="Previous and next unit">{prev_html}{center_html}{next_html}</nav>'


def clean_inline_styles(body: str) -> str:
    """Strips light-only inline background/text/border colors while keeping layout styles."""
    def fix_style(match: re.Match[str]) -> str:
        raw = match.group(1)
        decls = [d.strip() for d in raw.split(";") if d.strip()]
        kept = []
        had_light_bg = False
        for d in decls:
            if ":" not in d:
                continue
            prop, val = [x.strip() for x in d.split(":", 1)]
            pl = prop.lower()
            if pl in ("background", "background-color"):
                had_light_bg = True
                continue
            if pl == "color":
                continue
            if pl in ("border", "border-top", "border-bottom", "border-right"):
                continue
            if pl == "border-left":
                kept.append("border-left: 3px solid var(--unit-accent)")
                continue
            if pl == "accent-color":
                kept.append("accent-color: var(--unit-accent)")
                continue
            kept.append(f"{prop}: {val}")
        if had_light_bg:
            kept.append("background: var(--wc-surface)")
            kept.append("border: 1px solid var(--wc-border)")
        return f'style="{"; ".join(kept)}"' if kept else ""

    return re.sub(r'style="([^"]*)"', fix_style, body)


def upgrade_unit3_energy_quiz(body: str) -> str:
    """Converts Unit 3's ambiguous checkbox quiz into explicit True/False toggle rows."""
    quiz_keys = ["F", "F", "T", "F", "T"]
    pattern = re.compile(
        r'(<div class="exercise-label">Exercise B — Energy Quiz: True or False\?</div>)([\s\S]*?)'
        r'(<button[^>]*onclick="checkQuiz\(\)"[^>]*>.*?</button>\s*<div class="feedback" id="quiz-feedback"></div>)'
    )
    m = pattern.search(body)
    assert m, "Unit 3 Energy Quiz block not found"
    opts = re.findall(r'<label class="quiz-option"[^>]*>\s*<input[^>]*>\s*<span>(.*?)</span>\s*</label>', m.group(2), re.S)
    assert len(opts) == 5, f"Expected 5 U3 quiz options, got {len(opts)}"
    rows = ['<p style="font-size:0.9rem; margin-bottom:0.8rem;">Decide whether each statement is True (T) or False (F), then check your answers.</p>']
    for stmt, ans in zip(opts, quiz_keys):
        rows.append(
            f'<div class="wc1-tfp-row"><span>{stmt.strip()}</span>'
            f'<div class="tfp-options" data-tfp-answer="{ans}">'
            f'<button type="button" class="tfp-btn" onclick="selectTFP(this)">T</button>'
            f'<button type="button" class="tfp-btn" onclick="selectTFP(this)">F</button>'
            f'</div></div>'
        )
    replacement = m.group(1) + "\n      " + "\n      ".join(rows) + "\n      " + ACTION_BAR_HTML
    return body[:m.start()] + replacement + body[m.end():]


def upgrade_unit2_beijing_quiz(body: str) -> str:
    """Adds radio values, answer keys, and Check / Show Key / Reset bar to Unit 2 Listening A."""
    answers = {"bj1": "b", "bj2": "c", "bj3": "c"}
    for name, correct in answers.items():
        letters = iter(["a", "b", "c"])
        def add_val(_m: re.Match[str], nm: str = name) -> str:
            ltr = next(letters)
            return f'<input type="radio" name="{nm}" value="{ltr}">'
        body = re.sub(rf'<input type="radio" name="{name}"[^>]*>', add_val, body)

    ex_pat = re.compile(
        r'(<div class="exercise">\s*<div class="exercise-label">Exercise A — How much do you know about Beijing\?</div>)([\s\S]*?)(?=\s*<div class="tip">)'
    )
    em = ex_pat.search(body)
    assert em, "Unit 2 Beijing quiz not found"
    inner = em.group(2)
    for name, correct in answers.items():
        inner, n_sub = re.subn(
            rf'<div>(\s*<p[^>]*>[^<]*</p>\s*<div[^>]*>(?:(?!</div>)[\s\S])*?name="{name}"[\s\S]*?</div>\s*)</div>',
            rf'<div class="wc1-radio-group wc1-subbox" data-radio-answer="{correct}">\1</div>',
            inner,
            count=1,
        )
        assert n_sub == 1, f"Failed wrapping {name}"
    inner = re.sub(r'(<div class="wc1-radio-group[^"]*"[^>]*>\s*)<p([^>]*)>', r'\1<p class="wc1-radio-q"\2>', inner)
    # Insert action bar right before the closing </div> of .exercise
    close_idx = inner.rfind("</div>")
    rebuilt = em.group(1) + inner[:close_idx] + "  " + ACTION_BAR_HTML + "\n    " + inner[close_idx:]
    return body[:em.start()] + rebuilt + body[em.end():]


def upgrade_exercises_in_card(unit_num: int, card_id: str, card_html: str) -> str:
    """Upgrades blank exercises, Listening B fills, and TFP comprehension blocks inside a card."""
    # 1. Expand existing data-answer values with verified linguistic alternatives
    alt_map = EXPANDED_ANSWERS.get(unit_num, {})
    if alt_map:
        def expand_da(m: re.Match[str]) -> str:
            orig = html.unescape(m.group(1))
            expanded = alt_map.get(orig, orig)
            return f'data-answer="{html.escape(expanded, quote=True)}"'
        card_html = re.sub(r'data-answer="([^"]*)"', expand_da, card_html)

    # 2. Replace legacy single <button class="check-btn"...> + <div class="feedback"...> with full action bar
    card_html = re.sub(
        r'<button[^>]*class="check-btn"[^>]*onclick="check(?:Vocab|Grammar)\([^"]*\)"[^>]*>.*?</button>\s*'
        r'<div[^>]*class="feedback"[^>]*></div>',
        ACTION_BAR_HTML,
        card_html,
    )

    # 3. Add verified data-answer + action bar to Listening B transcript gap-fills (U6, U8, U10, U11, U12)
    if card_id == "listening" and unit_num in LISTENING_B_ANSWERS:
        expected_list = LISTENING_B_ANSWERS[unit_num]
        exb_pat = re.compile(
            r'(<div class="exercise">\s*<div class="exercise-label">Exercise B[\s\S]*?)(</div>\s*(?=<div class="exercise"|<div class="tip"|</div>\s*$))'
        )
        bm = exb_pat.search(card_html)
        if bm:
            chunk = bm.group(1)
            blanks_found = re.findall(r'<span class="blank-input" contenteditable="true"[^>]*></span>', chunk)
            assert len(blanks_found) == len(expected_list), (
                f"U{unit_num} Listening B blank count mismatch: {len(blanks_found)} vs {len(expected_list)}"
            )
            it = iter(expected_list)
            def attach_lb_ans(m: re.Match[str]) -> str:
                ans = html.escape(next(it), quote=True)
                tag = m.group(0)
                return tag.replace('contenteditable="true"', f'contenteditable="true" data-answer="{ans}"', 1)
            chunk = re.sub(r'<span class="blank-input" contenteditable="true"[^>]*></span>', attach_lb_ans, chunk)
            chunk = chunk.rstrip() + "\n      " + ACTION_BAR_HTML + "\n    "
            card_html = card_html[:bm.start()] + chunk + bm.group(2) + card_html[bm.end():]

    # 4. Attach verified data-tfp-answer to every .tfp-options in this card & add action bars
    tfp_key = TFP_KEYS.get((unit_num, card_id))
    if tfp_key:
        found = re.findall(r'<div class="tfp-options">', card_html)
        assert len(found) == len(tfp_key), (
            f"U{unit_num} #{card_id} TFP count mismatch: HTML has {len(found)}, key has {len(tfp_key)}"
        )
        it_tfp = iter(tfp_key)
        card_html = re.sub(
            r'<div class="tfp-options">',
            lambda _: f'<div class="tfp-options" data-tfp-answer="{next(it_tfp)}">',
            card_html,
        )
        # Ensure button type="button" and wrap parent row with class wc1-tfp-row
        card_html = re.sub(
            r'<div([^>]*)>(\s*<span[^>]*>[\s\S]*?</span>\s*<div class="tfp-options" data-tfp-answer="[^"]+">[\s\S]*?</div>\s*)</div>',
            r'<div class="wc1-tfp-row">\2</div>',
            card_html,
        )
        card_html = card_html.replace('<button class="tfp-btn"', '<button type="button" class="tfp-btn"')

    return card_html


def attach_tfp_action_bars(body: str) -> str:
    """Adds Check / Show Key / Reset bar to every .exercise containing data-tfp-answer (if not already present)
    and stamps data-gradable='1' on every gradable .exercise."""
    # Walk through <div class="exercise"> blocks tracking nested <div> depth
    out = []
    pos = 0
    ex_open = re.compile(r'<div class="exercise">')
    tag_re = re.compile(r'</?div\b[^>]*>')

    while True:
        m = ex_open.search(body, pos)
        if not m:
            out.append(body[pos:])
            break
        out.append(body[pos:m.start()])
        depth = 1
        scan = m.end()
        end_idx = len(body)
        while depth > 0:
            tm = tag_re.search(body, scan)
            if not tm:
                break
            if tm.group(0).startswith("</div"):
                depth -= 1
                if depth == 0:
                    end_idx = tm.start()
                    scan = tm.end()
                    break
            else:
                depth += 1
            scan = tm.end()

        inner = body[m.end():end_idx]
        has_tfp = 'data-tfp-answer="' in inner
        has_blank = 'data-answer="' in inner
        has_radio = 'data-radio-answer="' in inner
        has_actions = 'class="wc1-actions"' in inner

        if has_tfp and not has_actions:
            inner = inner.rstrip() + "\n      " + ACTION_BAR_HTML + "\n    "
            has_actions = True

        is_gradable = has_tfp or has_blank or has_radio
        open_tag = '<div class="exercise" data-gradable="1">' if is_gradable else '<div class="exercise">'
        out.append(open_tag + inner + "</div>")
        pos = scan

    return "".join(out)


def process_unit(unit_num: int, filename: str, expected_title: str, grammar_topic: str, accent: str) -> dict:
    src_path = os.path.join(SRC_DIR, filename)
    raw = open(src_path, encoding="utf-8").read()

    # Extract subtitle
    sub_m = re.search(r'<div class="subtitle"[^>]*>(.*?)</div>', raw, re.S)
    subtitle_html = sub_m.group(1).strip() if sub_m else html.escape(grammar_topic)
    subtitle_text = strip_tags(subtitle_html)

    # Extract container inner HTML (between <div class="container"> and footer)
    cont_m = re.search(r'<div class="container">\s*([\s\S]*?)\s*</div>\s*<footer', raw)
    assert cont_m, f"Container not found in {filename}"
    container_inner = cont_m.group(1)

    # Normalize #vocabulary -> #vocab across all 12 units for consistent deep-linking
    container_inner = container_inner.replace('id="vocabulary"', 'id="vocab"')

    # Fix missing space after closing quotation mark before sentence in Unit 12 grammar
    container_inner = re.sub(r'("\s*)<br\s*/?>', r'\1<br>', container_inner)
    container_inner = re.sub(r'([.?!]")([A-Z])', r'\1 \2', container_inner)

    # Ensure all buttons have explicit type="button"
    container_inner = re.sub(r'<button(?![^>]*\btype=)', '<button type="button"', container_inner)

    # Unit-specific quiz upgrades
    if unit_num == 2:
        container_inner = upgrade_unit2_beijing_quiz(container_inner)
    if unit_num == 3:
        container_inner = upgrade_unit3_energy_quiz(container_inner)

    # Upgrade every card section
    card_splits = list(re.finditer(r'<div class="card" id="([^"]+)">', container_inner))
    assert len(card_splits) >= 9, f"Expected >=9 cards in {filename}, got {len(card_splits)}"

    rebuilt_cards = []
    section_links = []
    card_summaries = {}
    vocab_words = []
    outcomes = []

    short_labels = {
        "outcomes": "Outcomes",
        "vocab": "Vocabulary",
        "grammar": "Grammar",
        "listening": "Listening",
        "reading": "Reading",
        "video": "Video",
        "connections": "Connections",
        "writing": "Writing",
        "speaking": "Speaking",
        "fluency": "Fluency",
    }

    for idx, cm in enumerate(card_splits):
        cid = cm.group(1)
        start = cm.start()
        end = card_splits[idx + 1].start() if idx + 1 < len(card_splits) else len(container_inner)
        chunk = container_inner[start:end]

        # Extract metadata before transforming
        cs_m = re.search(r'<div class="card-subtitle">(.*?)</div>', chunk, re.S)
        card_summaries[cid] = strip_tags(cs_m.group(1)) if cs_m else ""
        vocab_words.extend(strip_tags(w) for w in re.findall(r'<div class="vocab-word">(.*?)</div>', chunk, re.S))
        if cid == "outcomes":
            outcomes = [strip_tags(li) for li in re.findall(r"<li[^>]*>(.*?)</li>", chunk, re.S)]

        chunk = upgrade_exercises_in_card(unit_num, cid, chunk)
        rebuilt_cards.append(chunk)
        section_links.append((cid, short_labels.get(cid, cid.title())))

    body_html = "".join(rebuilt_cards)
    body_html = clean_inline_styles(body_html)
    body_html = attach_tfp_action_bars(body_html)

    gradable_count = len(re.findall(r'data-gradable="1"', body_html))
    answer_item_count = (
        len(re.findall(r'data-answer="', body_html))
        + len(re.findall(r'data-tfp-answer="', body_html))
        + len(re.findall(r'data-radio-answer="', body_html))
    )

    sec_nav_items = "".join(f'<a href="#{cid}">{html.escape(lbl)}</a>' for cid, lbl in section_links)

    page_html = f"""<!DOCTYPE html>
<html lang="en" data-theme="dark" data-unit="{unit_num}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="World Class 1 Teacher's Edition — Unit {unit_num}: {html.escape(expected_title)} ({html.escape(subtitle_text)}). Creative Minds GEP Program.">
<title>Unit {unit_num}: {html.escape(expected_title)} — World Class 1 Teacher's Book · CMC GEP</title>
<script src="teacher-gate.js"></script>
<link rel="stylesheet" href="wc1-theme.css">
</head>
<body>

{render_topbar(unit_num)}

<nav class="section-nav" aria-label="Unit {unit_num} sections">
  {sec_nav_items}
</nav>

<header class="hero">
  <div class="hero-eyebrow-row">
    <span class="unit-badge">World Class 1 · Unit {unit_num} of 12</span>
    <span class="wc1-teacher-chip">Teacher's Book · GEP</span>
    <span class="wc1-progress-chip" data-wc1-unit-progress>0 / {gradable_count} exercises checked</span>
  </div>
  <h1>{html.escape(expected_title)}</h1>
  <div class="subtitle">{html.escape(subtitle_text)}</div>
  <div class="wc1-key-banner" role="status">🔑 Teacher Answer Key mode is active — inline answers are highlighted across all exercises.</div>
</header>

<main class="container">
{body_html}

  <div class="wc1-actions" style="justify-content:flex-end; margin-top:0.5rem;">
    <button type="button" class="wc1-reset-btn" data-wc1-reset-unit>↺ Reset All Unit {unit_num} Inputs</button>
  </div>

  {render_pager(unit_num)}
</main>

<footer class="wc1-footer">
  World Class 1 · Unit {unit_num}: {html.escape(expected_title)} · Creative Minds GEP Teacher's Edition (National Geographic Learning)
</footer>

<script src="wc1-engine.js"></script>
</body>
</html>
"""

    out_path = os.path.join(OUT_DIR, filename)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(page_html)

    return {
        "num": unit_num,
        "file": filename,
        "title": expected_title,
        "grammar": grammar_topic,
        "accent": accent,
        "subtitle": subtitle_text,
        "vocab_count": len(vocab_words),
        "vocab_words": vocab_words,
        "outcomes": outcomes,
        "cards": card_summaries,
        "gradable_count": gradable_count,
        "answer_items": answer_item_count,
    }


def build_hub(units: list[dict]) -> None:
    total_vocab = sum(u["vocab_count"] for u in units)
    total_ex = sum(u["gradable_count"] for u in units)
    total_items = sum(u["answer_items"] for u in units)

    cards_html = []
    scope_rows = []

    for u in units:
        search_blob = " ".join([
            f"unit {u['num']}",
            u["title"],
            u["grammar"],
            u["subtitle"],
            " ".join(u["vocab_words"]),
            " ".join(u["cards"].values()),
            " ".join(u["outcomes"]),
        ]).lower()

        read_t = html.escape(u["cards"].get("reading", ""))
        list_t = html.escape(u["cards"].get("listening", ""))
        vid_t = html.escape(u["cards"].get("video", ""))
        writ_t = html.escape(u["cards"].get("writing", ""))
        spk_t = html.escape(u["cards"].get("speaking", ""))

        cards_html.append(f"""
    <article class="wc1-unit-card" data-unit-card="{u['num']}" data-ex-count="{u['gradable_count']}" data-search="{html.escape(search_blob, quote=True)}" style="--card-accent:{u['accent']}">
      <div class="wc1-uc-top">
        <span class="wc1-uc-num">Unit {u['num']:02d}</span>
        <span class="wc1-uc-status" data-unit-status>{u['gradable_count']} interactive checks</span>
      </div>
      <a href="{u['file']}" class="wc1-uc-title">{html.escape(u['title'])}</a>
      <p class="wc1-uc-sub">{html.escape(u['subtitle'])}</p>
      <div class="wc1-uc-meta">
        <div><span>Grammar:</span> {html.escape(u['grammar'])}</div>
        <div><span>Vocabulary:</span> {u['vocab_count']} key terms · {html.escape(u['cards'].get('vocab', ''))}</div>
        <div><span>Reading:</span> {read_t}</div>
        <div><span>Listening &amp; Video:</span> {list_t} · {vid_t}</div>
        <div><span>Writing &amp; Speaking:</span> {writ_t} · {spk_t}</div>
      </div>
      <div class="wc1-uc-links">
        <a href="{u['file']}" class="wc1-uc-open">Open Unit {u['num']} →</a>
        <a href="{u['file']}#vocab" class="wc1-uc-jump">Vocab</a>
        <a href="{u['file']}#grammar" class="wc1-uc-jump">Grammar</a>
        <a href="{u['file']}#reading" class="wc1-uc-jump">Reading</a>
        <a href="{u['file']}#fluency" class="wc1-uc-jump">Fluency</a>
      </div>
    </article>""")

        scope_rows.append(
            f"<tr>"
            f"<td><strong><a href=\"{u['file']}\" style=\"color:var(--wc-accent);text-decoration:none;\">U{u['num']:02d} · {html.escape(u['title'])}</a></strong></td>"
            f"<td>{html.escape(u['grammar'])}</td>"
            f"<td>{u['vocab_count']} words</td>"
            f"<td>{read_t}</td>"
            f"<td>{writ_t}</td>"
            f"<td>{spk_t}</td>"
            f"</tr>"
        )

    hub_html = f"""<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="World Class 1 — Complete 12-Unit Interactive Teacher's Edition for the Creative Minds General English Program (GEP).">
<title>World Class 1 — Teacher's Book (Units 1–12) · Creative Minds GEP</title>
<script src="teacher-gate.js"></script>
<link rel="stylesheet" href="wc1-theme.css">
</head>
<body>

{render_topbar(None)}

<header class="hero wc1-hub-hero">
  <div>
    <div class="hero-eyebrow-row" style="justify-content:flex-start;">
      <span class="unit-badge">Creative Minds · GEP Program</span>
      <span class="wc1-teacher-chip">Teacher's Edition · Units 1–12</span>
    </div>
    <h1>World Class 1</h1>
    <p class="subtitle">
      Complete 12-unit General English Program teacher's book with interactive vocabulary &amp; grammar checks,
      one-click classroom answer keys, National Geographic readings, listening &amp; video guides, writing models,
      speaking roleplays, and fluency boards — synced live across units and devices.
    </p>
    <div class="wc1-actions" style="margin-top:1.25rem;">
      <a href="unit.html" class="check-btn" style="text-decoration:none;" data-wc1-continue>Start Unit 1: Who We Are →</a>
      <button type="button" class="wc1-key-btn" data-wc1-scope-toggle aria-expanded="false">📋 Scope &amp; Sequence</button>
    </div>
  </div>
  <div class="wc1-stat-grid" aria-label="Book summary statistics">
    <div class="wc1-stat">
      <div class="wc1-stat-num">12 Units</div>
      <div class="wc1-stat-lbl">Complete Book</div>
    </div>
    <div class="wc1-stat">
      <div class="wc1-stat-num">{total_vocab}</div>
      <div class="wc1-stat-lbl">Target Vocab</div>
    </div>
    <div class="wc1-stat">
      <div class="wc1-stat-num" data-wc1-total-checked>0 / {total_ex}</div>
      <div class="wc1-stat-lbl">Checks ({total_items} Items)</div>
    </div>
    <div class="wc1-stat">
      <div class="wc1-stat-num" data-wc1-visited-count>0 / 12</div>
      <div class="wc1-stat-lbl">Units Opened</div>
    </div>
  </div>
</header>

<main class="wc1-hub-wrap">
  <section class="card wc1-scope-panel" data-wc1-scope-panel hidden aria-label="World Class 1 Scope and Sequence">
    <div class="card-header">
      <div class="card-icon">📋</div>
      <div>
        <div class="card-title">Scope &amp; Sequence — Units 1 to 12</div>
        <div class="card-subtitle">Quick syllabus overview across grammar, vocabulary, reading, writing, and speaking</div>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Unit</th>
          <th>Grammar Focus</th>
          <th>Vocab</th>
          <th>Reading</th>
          <th>Writing</th>
          <th>Speaking</th>
        </tr>
      </thead>
      <tbody>
        {"".join(scope_rows)}
      </tbody>
    </table>
  </section>

  <div class="wc1-controls" role="search" aria-label="Filter World Class 1 units">
    <input
      type="search"
      class="wc1-search"
      data-wc1-search
      aria-label="Search units by topic, grammar, vocabulary, or reading"
      placeholder="Search 12 units by title, grammar (e.g. passive, modals), vocabulary, or reading…"
    >
    <div class="wc1-filter-row" role="group" aria-label="Filter by unit range">
      <button type="button" class="wc1-filter-btn active" data-wc1-filter="all" aria-pressed="true">All 12</button>
      <button type="button" class="wc1-filter-btn" data-wc1-filter="1-6" aria-pressed="false">Units 1–6</button>
      <button type="button" class="wc1-filter-btn" data-wc1-filter="7-12" aria-pressed="false">Units 7–12</button>
      <button type="button" class="wc1-filter-btn" data-wc1-filter="started" aria-pressed="false">Opened</button>
    </div>
  </div>

  <p class="card" data-wc1-empty style="display:none; text-align:center; font-weight:700;">
    No units match that filter yet — try clearing the search box or switching back to "All 12".
  </p>

  <section class="wc1-unit-grid" data-wc1-hub-grid aria-label="World Class 1 units">
    {"".join(cards_html)}
  </section>
</main>

<footer class="wc1-footer">
  World Class 1 · Complete Teacher's Edition (Units 1–12) · Creative Minds General English Program (GEP)
</footer>

<script src="wc1-engine.js"></script>
</body>
</html>
"""

    with open(os.path.join(OUT_DIR, "index.html"), "w", encoding="utf-8") as f:
        f.write(hub_html)

    # Legacy main.html alias -> index.html so bookmarks or direct main.html visits always work
    alias_html = """<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="refresh" content="0; url=index.html">
<title>World Class 1 — Teacher's Book · Creative Minds GEP</title>
<script src="teacher-gate.js"></script>
<link rel="stylesheet" href="wc1-theme.css">
<script>window.location.replace('index.html' + window.location.search + window.location.hash);</script>
</head>
<body>
<main class="container" style="padding-top:3rem;text-align:center;">
  <a href="index.html" class="wc1-pill-link wc1-brand">Open World Class 1 — Teacher's Book →</a>
</main>
</body>
</html>
"""
    with open(os.path.join(OUT_DIR, "main.html"), "w", encoding="utf-8") as f:
        f.write(alias_html)


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    units = [process_unit(*meta) for meta in UNIT_META]
    build_hub(units)
    tot_v = sum(u["vocab_count"] for u in units)
    tot_e = sum(u["gradable_count"] for u in units)
    tot_i = sum(u["answer_items"] for u in units)
    print(f"Built World Class 1 Teacher's Edition in {OUT_DIR}:")
    for u in units:
        print(
            f"  U{u['num']:02d} ({u['file']:11s}) {u['title']:28s} | "
            f"vocab={u['vocab_count']:2d} | exercises={u['gradable_count']} | items={u['answer_items']:2d}"
        )
    print(f"TOTAL: 12 units + index.html + main.html | {tot_v} vocab terms | {tot_e} checked exercises | {tot_i} graded items")


if __name__ == "__main__":
    main()
