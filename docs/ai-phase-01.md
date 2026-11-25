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

Two features use a model, both **on demand only**:

| Feature | Where | What it adds |
|---|---|---|
| Essay second opinion | home trend card ("Ask the AI coach to read my last essay") | judgement of the argument — the rubric can only count |
| Listening pass | speaking page, per answer ("Ask the AI to listen to this answer") | pronunciation + clarity, which the signal alone cannot show |

Guards on both: one tap = one call, **10 per browser per day**, essay trimmed to
2400 chars, audio capped at 5 MB, prompt forbids a new band ("Do not give a band
or a score"), and neither button renders until App Check is configured.

### Do I need to set anything up in Firebase? — yes, three things

All in the console for **creative-minds-cambodia**:

1. **Build → AI Logic → Get started**, choose the **Gemini Developer API**
   backend (not Vertex), enable it for the web app. This is the API that answers
   the call.
2. **Build → App Check → Apps → your web app → Register**, provider
   **reCAPTCHA Enterprise**. Copy the **site key**. Firebase refuses browser
   calls to AI Logic without an App Check token, so this step is mandatory.
3. Put the site key where the code expects it — **no rebuild required**.
   Firestore → **`site_config`** → **`ai`** → field **`appCheckKey`** (type
   string), value = the reCAPTCHA Enterprise site key. `site_config` is already
   `allow read: if true; allow write: if isCmcAdmin();`, so nothing to publish.
   Both the React app and the static TOEFL pages read it on load:

   | Source | Wins over | When to use |
   |---|---|---|
   | `VITE_FIREBASE_APPCHECK_KEY` | everything | CI / a build that owns its own key |
   | `window.CMC_APPCHECK_KEY` | Firestore | one static page, quick override |
   | `site_config/ai.appCheckKey` | — | **the console path: paste, reload, done** |

   A reCAPTCHA Enterprise *site* key is public by design (it ships inside every
   client bundle), which is why a public-read Firestore document is safe here;
   the secret half never leaves Google.

   Also add the site's domains (`cmckhmer.github.io`, `localhost`) in the
   reCAPTCHA Enterprise key's allowed domains.

Nothing else needs deploying: the SDK is a lazy import that loads on the first
tap, and the key is read from Firestore on page load.

### How do I know it is actually working?

The home trend card carries a **status line with a “Test connection” button**:

| Status line | Meaning | Fix |
|---|---|---|
| `AI coach: App Check key not set` | step 2/3 missing — no call is even attempted | register App Check, then paste the site key into `site_config/ai` → `appCheckKey` |
| `AI coach: App Check token rejected` | key set but the domain is not allowed, or App Check is not registered | check the reCAPTCHA allowed domains + App Check registration |
| `AI coach: AI Logic not switched on` | step 1 missing (API not enabled / wrong backend) | Build → AI Logic → Get started |
| `AI coach connected · gemini-2.5-flash` | a real generation came back | nothing — it works |

The probe sends one tiny prompt ("reply ready") and reports the actual error
text underneath, so the console step that is still missing is named on the card.

**The status line and the checklist are teacher/admin-only.** A student never
sees console instructions or a disabled button: while AI is off the coach block
simply does not render for them.

### "My chart says no saved attempts yet" — the card tells you why

For a teacher, an empty trend runs one read probe (`diagnosePracticeStore`) and
reports the real answer with its HTTP status:

| Line | Meaning |
|---|---|
| `Score storage is reachable.` | rules are published; the student simply has not practised yet |
| `…refused by the database rules … (HTTP 403)` | publish `firestore-min.rules` — this is the usual cause |
| `…token was rejected (401)` | sign out and in again |
| `No signed-in student session` | no Firebase session in this browser |
| `Firestore could not be reached` | network/adblock — not a config problem |
`src/lib/aiCoach.ts` (`probeAICoach`, `classifyAiFailure`) is what maps each
failure onto a step; `src/tests/aiLogic.test.ts` pins the mapping.

With AI off, nothing breaks: the deterministic bands, the trajectory and the
teacher review all work, and the AI buttons simply do not appear.

## 5. Teacher review

The teacher console (`FirebaseDashboard`) now has **Practice attempts · Phase 01**:

- pick a class → pick a student → their saved attempts (writing and speaking);
- open any attempt to read the response (`text`) and the trait scores;
- leave a review: a band of the teacher's own (or “keep the automatic band”) plus
  a comment up to 600 chars.

Reviews live in `practice_reviews/{attemptId}` — a separate document, so the
attempt a student actually produced never changes (see the rules block of the
same name). A teacher correcting themselves overwrites only their own review
(`reviewerUid` is checked on every write).

## 5. Tests that keep it honest

| File | Pins |
|---|---|
| `src/tests/writingRubric.test.ts` | engine behaviour, calibration, page wiring, "nothing is uploaded" copy |
| `src/tests/speakingRubric.test.ts` | dead air / pace / mumble / clipping / trailing off, real mime type, page wiring |
| `src/tests/practiceAttempts.test.ts` | trajectory maths, outbox, uid-scoped writes, rules text |
| `src/tests/practiceTrajectory.test.ts` | app-vs-static trajectory parity, card states, AI coach guards |
| `src/tests/practiceReview.test.ts` | review upsert, half-point rounding, refused saves, uid attribution |
| `src/tests/aiLogic.test.ts` | AI gates, quota, size cap, SDK-load failure, diagnostics mapping, teacher panel wiring |
| `src/tests/aiFutureShowcase.test.ts` | exactly one phase claims to be live |

## 6. Known limits (next, honestly)

- The AI listening pass needs App Check + AI Logic (steps above); until then the
  button is hidden and delivery scoring is the on-device rubric only.
- Students cannot yet *see* a teacher's review on the practice pages — the data
  and rules allow it (`practice_reviews` read is granted to the student), the
  read-out is the next small piece.
- The band is only as good as its rubric: it measures craft that can be counted,
  and a teacher remains the authority.
