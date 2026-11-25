# AI Phase 01 — Smart Learning Engine

**Status: live.** Essay feedback, speaking delivery feedback and the saved score
trajectory all run today, with no per-use API bill.

The roadmap card (`src/data/aiFutureCards.ts`, `status: 'live'`) says
`PHASE 01 · LIVE`; phases 02–04 still say `AI SOON`. A test pins that only one
card claims to be live (`src/tests/aiFutureShowcase.test.ts`).

---

## 1. What a student sees

| Surface | Where | What it does |
|---|---|---|
| Essay feedback | `public/toefl-ibt/toeflwriting-MIGRATED.html` → Submit | Band /5 + ≈/30, four trait bars, the three fixes that matter, what worked |
| Delivery feedback | `public/toefl-ibt/toeflspeaking-MIGRATED.html` → after each recording | Band /5 per answer (fluency, clarity, pacing) with the headline fix, plus a section summary |
| Score trajectory | both pages + the home page live strip (`PracticeTrajectoryCard`) | The last 8 bands per skill, the delta since last time and the best so far |

Nothing is hidden behind a modal that has no entry point: the writing page
carries a line under Submit ("Submitting also scores both responses…"), the
speaking page puts the score under the question that was recorded, and the home
page strip appears between the roadmap header and the holographic cards.

## 2. How the scoring works

Two deterministic engines, both plain ES modules with no dependencies, imported
by the static pages **and** by the test suite (one implementation, no drift):

- `public/assets/js/cmc-writing-rubric.js` — reads the text: length against the
  task minimum, prompt-keyword coverage, e-mail greeting/sign-off, paragraphing,
  worked examples, linker density, sentence-starter variety, sentence-length
  band, lexical variety, mechanics ("i", missing full stop, double spaces).
- `public/assets/js/cmc-speaking-rubric.js` — reads the audio signal (WebAudio
  decode, 50 ms frames): pause ratio, pause count, longest pause, syllable-peak
  pace, level, level stability, clipping, time used against the task limit,
  trailing silence.

Both return `{ band, scores, fixes, strengths }`, where `fixes` is capped at
three, ordered by severity, and always quotes the student's own numbers ("Only 2
linking words in 140 words").

**Honesty rules baked in**

- a band is an estimate, never a TOEFL score — every surface says so;
- speaking is *delivery only*: pronunciation and content need a transcript, and
  the UI says that in words;
- a 5.0 is gated on real evidence (keyword coverage ≥ 0.8, 4+ distinct linkers,
  clean mechanics, wide vocabulary), so a plain-but-correct answer lands ≈3.5;
- under 10 words (writing) or under 1.5 s / silent audio (speaking) returns
  `ok: false` with an explanation instead of a number;
- if the browser cannot decode the recording, no score is shown at all.

## 3. Where the history lives

```
practice_attempts/{uid}/attempts/{attemptId}
  uid, skill ('writing'|'speaking'), band (0–5, half points),
  traits{task,development,coherence,language} | {fluency,clarity,pacing},
  stats{words,sentences,connectives} | {responses,seconds,pauseRatio,wordsPerMinute},
  text? (writing only, ≤4000 chars, for the AI coach / teacher review),
  source, rubricVersion, createdAt
```

- Rules: `firestore.rules` → "PRACTICE ATTEMPTS (Nov 2026)". A student writes
  only under their own uid, reads their own trend; a verified teacher reads any
  student's attempts; nothing is client-updatable or deletable.
- **Deploy the rules after changing them:**
  `npx firebase-tools@latest deploy --only firestore:rules`
  (`firestore-min.rules` is generated — `node scripts/build_min_rules.mjs`).
- Not `drill_attempts`: that collection is world-readable for the ticker, and a
  student's essay is not public data (and a band is not a percentage).
- Offline: `cmc-practice-attempts.js` queues a failed write in `localStorage`
  (`cmc-practice-outbox`, capped at 20) and flushes on the next page load, so an
  attempt is never lost to a classroom connection.

## 4. The optional AI layer (Firebase AI Logic)

`src/lib/aiCoach.ts` asks a model for the thing the rubric cannot judge — the
quality of an argument — and shows it on the home trend card:

- **on demand only** (one button, one call per tap, never automatic);
- **capped** at `AI_COACH_DAILY_LIMIT` (10) reviews per browser per day;
- **not another grade**: the prompt forbids a new score and asks for three
  plain sentences (strongest phrase, biggest improvement, what to practise);
- **degradable**: when AI Logic is not enabled the UI says so and the
  deterministic feedback keeps working.

To switch it on (owner, ~5 minutes in the Firebase console):

1. **Build → AI Logic** → get started → backend **Gemini Developer API**.
2. **App Check** → register the web app with reCAPTCHA Enterprise; browsers must
   present an App Check token before AI Logic answers.
3. Optional: set `VITE_AI_COACH_MODEL` (default `gemini-2.5-flash`).

Nothing needs redeploying for step 1–2 — the SDK is a lazy `import('firebase/ai')`
that only loads when someone taps the button.

## 5. Tests that keep it honest

| File | Pins |
|---|---|
| `src/tests/writingRubric.test.ts` | engine behaviour, calibration, page wiring, "nothing is uploaded" copy |
| `src/tests/speakingRubric.test.ts` | dead air / pace / mumble / clipping / trailing off, real mime type, page wiring |
| `src/tests/practiceAttempts.test.ts` | trajectory maths, outbox, uid-scoped writes, rules text |
| `src/tests/practiceTrajectory.test.ts` | app-vs-static trajectory parity, card states, AI coach guards |
| `src/tests/aiFutureShowcase.test.ts` | exactly one phase claims to be live |

## 6. Known limits (next, honestly)

- Speaking cannot judge pronunciation or content until a transcript path exists
  (Web Speech or an AI Logic audio call — the latter is the natural next step).
- Teachers can read attempts but there is no review screen that overrides an
  automatic band yet; the essay text is stored for exactly that purpose.
- The band is only as good as its rubric: it measures craft that can be counted,
  and a teacher remains the authority.
