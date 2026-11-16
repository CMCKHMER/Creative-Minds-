# School backend on Firebase

The site stays on Firebase (Auth + Firestore, Blaze plan). This file tracks
the build order and what each step stores.

| Step | What | State |
| --- | --- | --- |
| 1 | Roster-verified registration, classes Kid 5 to Kid 11 (morning and afternoon) | built, Nov 2026 |
| 2 | Server-side grading for anything that counts (`docs/server-side-hardening-plan.md`) | not started |
| 3 | One profile page per student (homework, tests, games, history) | not started |
| 4 | Attendance (present / absent / late per class per day) | not started |
| 5 | Audit log, grade weights, report exports | not started |

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
