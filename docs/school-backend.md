# School backend on Firebase

The site stays on Firebase (Auth + Firestore, Blaze plan). This file tracks
the build order and what each step stores.

| Step | What | State |
| --- | --- | --- |
| 1 | Roster-verified registration, classes Kid 5 to Kid 11 (morning and afternoon) | built, Nov 2026 |
| 2 | Server-side grading for anything that counts (`docs/server-side-hardening-plan.md`) | designed below, not built |
| 3 | One profile page per student (homework, tests, games, history) | not started |
| 4 | Attendance (present / absent / late per class per day) | not started |
| 5 | Audit log, grade weights, report exports | not started |

Also built in Nov 2026, outside the numbered steps: classes private per
teacher, and a profile picture for every account (both below).

## Step 1 — registration

**Teacher** (Daily assessment records → Open the assessment workspace)

1. *Kid 5–11 classes* creates the fourteen classes that do not exist yet,
   named `Kid N — Morning` / `Kid N — Afternoon`, owned by the signed-in teacher.
2. *Registration* tab: paste the class list (one student per line: school ID,
   name), then *Open registration*. *Update registration* after editing the
   list, *Release* to take a wrong account off a student, *Close registration*
   to withdraw the places nobody took.

**Student** (Live class results, signed in with a verified email): types
school ID and full name. Capital letters, punctuation and name order do not
matter; the ID and every word of the name do. A match places the account in
that class. One account per student, one student per account.

### What is stored

- `roster_seats/{seatKey}` — one per student on a published list. The id is
  SHA-256 of `cmc-seat-v1|<ID>|<name>` after normalising (`src/lib/roster.ts`),
  so a student can fetch their own seat but nobody except a teacher can list
  seats. Fields: class, row, name, school ID, teacher, and the account that
  took it (`claimedBy`, `claimedEmail`, `claimedName`, `claimedAt`).
- `student_links/{uid}` — `{ uid, seatKey, linkedAt }`, the seat an account holds.

A registration is one commit of two writes; `firestore.rules` checks each
against the other with `getAfter()`. There is no Cloud Function in this step.

### Checks

- `npx vitest run src/tests/roster.test.ts` — matching, paste, publish plan, rule pins.
- `npm run build && npm run verify:registration` — one teacher and two
  students in separate browsers against an in-memory database that applies
  the two rule blocks, written out in JS.

### Not covered yet

- The rules have not been compiled or exercised by Firebase itself. After
  publishing `firestore.rules`, register one test student for real.
- "Teacher" in the rules means a verified address whose domain contains `edu`
  (or the site-owner account). A student who signs up with a school
  `…edu…` mailbox would pass as a teacher. Students should register with a
  personal address until teacher access is an explicit list.
- Scores are not attached to the seat yet. That is step 2 and step 3.
- The older class-code flow (`classes` / `enrollments`, "Join a class") is untouched.

## Private per teacher (Nov 2026)

Owner decision: each teacher sets up their own classes, and a teacher must
not see another teacher's assessment records.

- `assessment_classes/{id}` and its `students`: read and written only by the
  teacher who owns the class (`teacherUid`, or `teacherEmail` for a
  re-created account) and by the site owner. A list query has to filter on
  the caller's own `teacherUid`.
- `roster_seats`: a student may still `get` a seat by its key (that is how
  registration works); listing, publishing, releasing and removing seats is
  limited to seats carrying the caller's `teacherUid`.
- `student_links`: readable by the student and by teachers one at a time;
  only the site owner can list them. A link is changed or removed by the
  teacher of the seat it points to.
- A student who is already on another teacher's published list is shown in
  the Registration tab as "Already on another teacher's class list" and is
  not moved.

Checks: `npm run verify:registration` (the "private" scenario signs in a
second teacher), `src/tests/roster.test.ts`.

Not covered: homework and game scores (`drill_attempts`) are still readable
by every teacher. They move behind the same wall with step 2.

## Profile picture (Nov 2026)

The account menu (laptop and phone) has "Add a profile picture". The user
uploads a photo or picks one of sixteen built-in avatars.

- Stored in `user_avatars/{uid}`: `kind` (`photo` or `preset`), `photo` (a
  `data:` URL), `preset` (an avatar id), `updatedAt`.
- A photo is cut to a square and shrunk to 160 px in the browser before it
  is sent (a few kilobytes). The original file is never uploaded, and
  Firebase Storage is not used.
- Private: only the account itself reads its picture. The site owner can
  read and delete one, and cannot write one. Showing pictures to teachers or
  classmates would be a separate decision, because many users are children.
- Code: `src/lib/avatar.ts`, `src/hooks/useAvatar.ts`,
  `src/components/AvatarBadge.tsx`, `src/components/ProfilePhotoModal.tsx`.

Checks: `src/tests/avatar.test.ts`, `npm run build && npm run verify:profile-photo`.

## Daily homework archive (Blaze, Nov 2026)

The teacher's **Scores** sheet re-reads the whole page list every time it opens
(and again whenever the row count changes) — right for "who handed in just
now", poor as a record: the read is capped, it costs a full page read per view,
and nothing would survive a later cleanup of `drill_attempts`.

The `exportHomeworkSheets` Cloud Function (`functions/index.js`) runs **once a
day at 21:00 Cambodia time** and turns the six Grade-11 homework pages into a
ready-made CSV score sheet per homework:

- `homework_exports/<page>__hw<1|2|3>` — `slug`, `homework`, `title`,
  `generatedAt`, `students`, `submissions`, `rowCount`, `omitted`, and `csv`.
  Written only by the function (rules deny every client write); read by
  verified teachers (`isVerifiedTeacher()`), which is the same gate as the
  sheet itself.
- The teacher's sheet shows **"Download nightly archive"** when the document
  exists. The file has exactly the live sheet's columns, so a term's sheets
  can be kept even after `drill_attempts` is trimmed.
- The pure logic (`functions/lib/homeworkExport.cjs`) is pinned to the live
  sheet by `src/tests/homeworkExport.test.ts` — same grouping (names matched by
  case/spacing), same first-try fallback, byte-identical CSV.
- A homework with no submissions still gets a document (empty `csv`), so the
  sheet can tell "nothing handed in" apart from "archive not generated".

**Cost.** 6 equality queries + 18 small writes per day on rows that already
exist — far below the Firestore free tier that still applies on Blaze (50K
reads / 20K writes per day). No Storage, no egress, one Cloud Scheduler job
(the first three are free), `maxInstances: 1` so a stuck run cannot fan out.
The query uses the automatic single-field index on `drillSlug` (no composite
index required).

**Deploy.**

```bash
cd functions && npm ci
npx firebase-tools@latest deploy --only functions,firestore:rules
```

Publish the rules (console → Firestore → Rules, or the command above). Run once
by hand if you do not want to wait for 21:00: Firebase console → Functions →
`exportHomeworkSheets` → **Run now** (or temporarily point the schedule at an
earlier minute). Without the rules publish the sheet simply renders without the
download — nothing breaks.

**Verify.** `npx vitest run src/tests/homeworkExport.test.ts`, then open a Kid 11
homework's **Scores** after the first run and download the archive. A
teacher-only GET of
`/v1/projects/creative-minds-cambodia/databases/(default)/documents/homework_exports/unit13hw__hw1`
returns 200; a signed-out request is denied.

## Step 2 — homework that cannot be cheated (design, not built)

Today every homework page carries its answers in the page source
(`data-answer`, `data-correct`, `data-solution`, the hint in the ordering
task, the model answers), and the score sent to `drill_attempts` is
whatever the browser says it is. Both have to change:

1. The answers leave the page. They are sealed with the public key the
   bi-weekly tests already use (`docs/answer-seal.md`), so the repository
   stays public and no new secret is needed.
2. The student hands in answers, not a score (`hw_sheets`, one per student,
   page and assignment; the rules refuse any score field).
3. The mark is written by something the student does not control
   (`hw_marks`). Two ways, to be chosen by the owner:
   - on a teacher's device, when a teacher opens the scores (works without
     a deploy; the mark appears when a teacher next looks), or
   - by a Cloud Function (the mark appears in seconds; the owner has to
     deploy `functions/`).
4. After a mark, the student sees the score and which items were wrong, not
   the right answers.

Known limits of any version: the answers of the current six pages stay in
the public Git history, and the page builders under `scripts/` contain
them, so those questions need new answers or a private repository to be
safe from a determined student.
