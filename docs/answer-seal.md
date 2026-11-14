# Answer seal — how the bi-weekly test answers are protected

## The problem this solves

The site is a static GitHub Pages deploy built from a public repository. The
teacher gate on the test pages (`teacher-gate.js`) only covers the page with
CSS. While the answers sat in the page source, any student could read them
with "View source", or by opening the file on GitHub.

## How it works now

| Piece | Where | Who can read it |
|---|---|---|
| Questions and options | `public/biweek-planner/tests/*.html` | everyone |
| Answers, **encrypted** | the `window.CMC_SEAL=` line of each page, and `public/biweek-planner/answer-seals.json` | everyone, but it is unreadable without the private key |
| Public key (seals only, cannot open) | `public/biweek-planner/answer-seal.pub.json` | everyone |
| **Private key** (opens the seals) | Firestore document `teacher_secrets/answer-seal` | verified teachers only, enforced by `firestore.rules` |

- **A student on an invite link** never receives the key. The browser sends
  the raw answer sheet; the score is worked out later on the teacher's
  device. Students see the same thank-you page as before.
- **A signed-in teacher** opening a test page gets the key from Firestore,
  the answers are decrypted in memory, and preview and instant grading work
  as before. If the key cannot be fetched, Submit is held and the page says
  why; nothing is graded against an empty key.
- **The dashboard** (Bi-Weekly Tests → View results) grades each submitted
  sheet with the same key. Attempts recorded before this change keep the
  score they were stored with.
- **Studio** linked tests are graded the same way.

The protection is exactly as strong as the "verified teacher" check in
`firestore.rules` (`isVerifiedTeacher()`): an email address whose domain
contains `edu`, a verified email, and an entry in `teachers/{uid}`. If
students have school addresses that match, tighten `isCmcTeacher()` first.

## One-time setup (site owner)

1. Publish the current `firestore.rules` in the Firebase console
   (Firestore → Rules). `npm run rules:min` writes the comment-free copy,
   `firestore-min.rules`, if the console needs the smaller file.
2. Sign in to the site with the owner account, open the dashboard, and go to
   **Bi-Weekly Tests → Answer protection**.
3. Paste the key code (it starts with `cmcseal1.`) and press **Install key**.
   The dashboard checks the code against the site before saving it.

Until step 3 is done, teachers cannot preview-grade the tests and new
student attempts show "Not scored". Nothing is lost: the attempts are saved
and are scored as soon as the key is installed.

Keep a copy of the key code somewhere safe and private (a password manager).
It must never be committed: `.gitignore` excludes `.secrets/` and
`*.private.json`, and a unit test fails the build if a working key code
appears in any tracked file.

## Adding or editing a test

1. Create or edit the page under `public/biweek-planner/tests/` with the
   answers in `window.TEST_BANKS` as before.
2. Run `npm run seal` **before committing**. It encrypts the answers of every
   unsealed page with the public key, replaces them with placeholders and
   rewrites `answer-seals.json`. No private key is needed for this step.
3. Add the test to `TEST_CATALOG` in `src/components/BiWeeklyTestsPanel.tsx`
   so its results can be scored in the dashboard.
4. Commit. `npm test` (and so the deploy) fails if a page still carries a
   readable answer, lacks a seal, or is missing from the catalog.

To change the answers of a sealed page, put the full set of real answers for
that page back into `window.TEST_BANKS`, delete its `window.CMC_SEAL=` line,
and run `npm run seal` again.

## Commands

| Command | What it does |
|---|---|
| `npm run seal` | Seal every unsealed page; rebuild `answer-seals.json` |
| `npm run seal:check` | Exit 1 if any page carries a readable answer |
| `node scripts/seal_tests.mjs --verify <key file>` | Confirm a key file opens all seals |
| `node scripts/seal_tests.mjs --open <slug> <key file>` | Print one test's answers as JSON |
| `CMC_SEAL_KEY=<key file> node scripts/make_private_test.mjs <slug>` | Build a private twin from a sealed page |

## Replacing the key

If the key code is ever exposed: for each page, restore the real answers and
delete the `window.CMC_SEAL=` line; delete `answer-seal.pub.json`; run
`node scripts/seal_tests.mjs --init-key <new key file outside the repo>` and
`npm run seal`; then install the new code in the dashboard.

## What this does not cover

- **Git history.** Every answer that was committed before this change is
  still readable in the repository's history on GitHub. The seal protects
  the live site and the current files. Tests whose results matter should get
  new questions, or the history has to be rewritten or the repository made
  private.
- **A teacher account.** Anyone who passes the teacher check can read the
  key, and so every answer.
- **Proctoring.** The timer, fullscreen and tab-switch checks still run in
  the student's browser and can be bypassed by a determined student.
