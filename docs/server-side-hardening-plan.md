# Server-Side Hardening Plan — Draft

**Status:** draft for owner review · **Date:** 2026-11-02
**Scope:** server-side grading and attempt limits for everything a signed-in
member can be scored on.

---

## 1. Verified current state (what is ALREADY server-side)

Audited against `firestore.rules`, `functions/index.js`,
`supabase/functions/member-mini-mock/index.ts`, `src/lib/memberMock.ts`,
`src/components/MiniMockTest.tsx` on 2026-11-02.

| Surface | Grading | Attempt limit | Answers exposed to browser? |
|---|---|---|---|
| Private bi-weekly tests (`test_submissions` flow) | **Teacher-side** (Option A — teacher dashboard grades against `test_keys`, scores cached in `test_scores`) | **Server-enforced**: doc ID `{assignmentId}__{studentUid}` is create-once at the database level; window enforced by `opensAt`/`closesAt` in rules | **No** — private test pages ship answer-free; keys live only in `test_keys` (teacher-only rules) |
| Public drills (static worksheets, Word Forge, games → `drill_attempts`) | Client-side | None (append-only history, unlimited creates) | No (answers are graded locally at submission time) |
| Member mini-mock (`MiniMockTest` + `member-mini-mock` Edge Function) | **Client-side** (`countCorrect()` in the browser) | **None server-side** — unlimited retakes, each result client-reported | **YES — both paths** (see Gap 1) |
| Ticker stats | `rollupTicker` Cloud Function (Blaze) rewrites `ticker_stats/latest` every 5 min; client writes denied | n/a | n/a |

`drill_attempts` rules already validate the *shape* of every submission
(integer `scorePct` 0–100, non-negative counts, `studentUid` must equal the
Bearer token's uid) and make history append-only. What they cannot do is
attest that the *value* was produced by a real run — that is the remaining gap.

## 2. Gaps

### Gap 1 — Mini-mock answers reach the browser on BOTH delivery paths

* **Edge Function path:** `member-mini-mock` validates the bank strictly, then
  returns it verbatim — `correctIndex` and `explanation` included
  (`index.ts`: `return jsonResponse(request, { questions: bank })`). Any
  entitled member can read the answers from the network response before the
  timer starts.
* **Fallback path:** if Supabase is not configured (or the function 404s),
  `fetchMemberMiniMock()` fetches the bundled `public/data/mini-mock-bank.json`
  — the full answer key ships with the repo and is served publicly on GitHub
  Pages.

### Gap 2 — Mini-mock grading is client-side and self-reported

`MiniMockTest.finishTest()` computes the score in the browser and POSTs it to
`drill_attempts` (`drillSlug: 'mini-mock-01'`). The rules verify shape and
identity, not authenticity: any verified member can claim any 0–100 score for
that slug without opening the test.

### Gap 3 — No server-side attempt accounting for the member mini-mock

Assigned bi-weekly tests enforce one attempt via the create-once doc-ID rule.
The member mini-mock has no equivalent: retakes are unlimited and untracked
server-side. (Client-only attempt state, where a page keeps one in
`localStorage`, is advisory by definition and is treated in this plan as "no
limit".)

## 3. Phase A — Server-side start/grade split for the member mini-mock

Split the single `member-mini-mock` action into **`start`** and **`grade`**.
No new infrastructure: the Edge Function already holds the bank in
`MINI_MOCK_QUESTIONS_JSON` and the service key.

### 3.1 `POST { action: 'start' }`

1. Existing checks stay: origin allowlist → Bearer token → email-verified →
   active entitlement.
2. Mint `attemptId` (server-generated UUID) and persist an attempt row:
   `{ attemptId, userId, startedAt, status: 'open' }` in a Supabase table
   `member_mock_attempts` (service-key write, RLS-denied to clients).
3. Return the bank **sanitized**: strip `correctIndex` and `explanation` from
   every question before the response leaves the function. Everything else
   (`id`, `skill`, `prompt`, `choices`, `passage`, `audioScript`) is unchanged.

### 3.2 `POST { action: 'grade', attemptId, answers }`

1. Load the attempt row; reject if missing, not owned by the caller,
   `status != 'open'`, or older than a hard TTL (e.g. 45 min).
2. Grade **server-side** from the env bank: compare each answer to
   `correctIndex`; compute `correctCount`, `totalCount`, `scorePct`, and
   per-question outcomes.
3. Update the attempt row (`status: 'graded'`, score, duration) — this row is
   the **server-attested** record.
4. Return per-question feedback (correct answer + explanation) — only after
   grading, so the browser never holds answers mid-test.

### 3.3 Strict client + delete the bundled bank

* `memberMock.ts` drops the bundled-bank fallback entirely (any error from the
  function is a hard load error with a retry hint).
* Delete `public/data/mini-mock-bank.json` and its type/parser special-casing.
* `MiniMockTest` submits answers to `grade` instead of grading locally;
  results, review screen and `drill_attempts` mirror post all read from the
  server's grade response.

### 3.4 Deployment ordering (owner actions, in this order)

1. **Deploy the updated Edge Function first** (both actions live; the old
   single-response shape stays available for one release window).
2. Ship the strict client bundle.
3. After one release cycle, remove the legacy single-action branch from the
   function.
4. Delete `public/data/mini-mock-bank.json` from the repo **and** purge it
   from the Pages deployment history is not possible — instead the file simply
   stops being referenced; if it must vanish from the live site, rename the
   bank env var and rotate the questions in `MINI_MOCK_QUESTIONS_JSON` (the
   bundled copy then contains only stale questions).

> Rollback: the legacy branch restoration is a client-only revert; attempt
> rows are additive and harm nothing if the split is rolled back.

## 4. Phase B — Rules-only idempotent attempt IDs for client-graded drills

Goal: one server-enforced attempt per drill per day for everything that still
grades client-side (public worksheets, Word Forge, other games), **without**
touching functions or clients' payloads beyond the doc ID.

### 4.1 Change

`drill_attempts` document IDs become `{uid}__{drillSlug}__{yyyyMMdd}`
(client-chosen day key, self-consistent). Rules:

```
match /drill_attempts/{attemptId} {
  allow create: if isVerifiedUser()
    && request.resource.data.studentUid == request.auth.uid
    // …existing shape checks unchanged…
    && request.resource.data.drillSlug is string
    && request.resource.data.drillSlug.size() > 0
    && request.resource.data.drillSlug.size() <= 80
    && request.resource.data.dayKey is string
    && request.resource.data.dayKey.matches('^[0-9]{8}$')
    && attemptId == (request.auth.uid + '__'
                     + request.resource.data.drillSlug + '__'
                     + request.resource.data.dayKey);
}
```

A second submission with the same ID collides at the database and is denied —
the attempt limit stops being a UI nicety. Reads stay public; immutability
(`update, delete: if false`) is unchanged.

### 4.2 Client compatibility

Every writer (CMC.submitDrill, the React submitScore module, Word Forge's
CMC_SYNC, worksheet POSTs) already sends `studentUid` + `drillSlug`; they add
`dayKey` (UTC `yyyyMMdd` of the submission) and use the composite doc ID. Old
documents keep their auto-IDs; they are immutable history and need no
migration.

## 5. Phase C — Accepted trade-offs (documented, not fixed now)

1. **Day-key time travel:** a hostile client can send a future/older `dayKey`
   (still 8 digits) to buy extra attempts. Cost of abuse: a self-reported
   practice score on a non-monetary leaderboard. Accepted.
2. **Client-graded drills stay trust-based** outside mini-mock: the public
   worksheets grade in-browser by design (they are practice, not assessment);
   real assessment now flows through the teacher-graded private-test system
   and, after Phase A, the server-graded mini-mock.
3. **`teachers/{uid}` allowlist remains self-service** for any verified
   `*edu*` email (append-only, immutable after create). Tightening it to a
   hardcoded list trades recovery-from-lockout for hardening; revisit only if
   key leakage is ever observed.
4. **Email-contains-"edu" heuristic** stays the site-wide role gate, in sync
   between `firestore.rules` (`isCmcTeacher`) and
   `src/lib/firebaseAuth.ts` (`detectRoleFromEmail`). RE2 cannot do
   look-around; both sides must change together if the heuristic changes.
5. **Anonymous ticker reads on `drill_attempts`** remain public-read: the
   homepage ticker and leaderboards require it, and documents contain no
   personal data beyond the student-chosen display name.

## 6. Verification checklist (after each phase)

* Phase A: `start` response contains no `correctIndex`/`explanation` keys
  (network-panel check on a real member session); second `grade` call with the
  same `attemptId` → 409; unauthenticated and unentitled calls → 401/403;
  `mini-mock-bank.json` gone from `dist/` and 404 on Pages.
* Phase B: simulator run of the new `drill_attempts` clause (same-ID second
  create denied; wrong-uid prefix denied; mismatched `dayKey` denied; correct
  first create allowed); live regression of one worksheet + Word Forge
  submission; ticker and leaderboards unaffected (read path untouched).
* Both: `npx tsc --noEmit`, `npx vitest run`, `npm run build`, and the live
  smoke of the affected pages, per the standard QA chain.
