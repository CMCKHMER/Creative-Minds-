# Google Drive & "share to Google Classroom" — what we can do, in order

Short answer: **yes, all of it is possible**, and part of it already ships.
The work splits into four levels that are very different in cost, so this file
puts the cheapest, highest-value one first.

| Level | What the student/teacher sees | Google setup needed | Effort |
|---|---|---|---|
| **0 — Share link (shipped)** | “Share → Google Classroom” opens Classroom's own dialog; the game/worksheet is posted as an announcement or assignment | none | done |
| **1 — Classroom API** | Teacher signs in with Google once, then CMC can create the assignment *and* receive grades back | Cloud project + Classroom API + OAuth consent + sensitive-scope verification (or Internal) | ~1–2 weeks |
| **2 — Drive** | “Save to Drive”: results CSV, worksheets, certificates; teacher picks a Drive file to attach | Cloud project + Drive API; `drive.file` needs no review | ~3–5 days |
| **3 — Classroom add-on** | CMC opens *inside* Classroom, with a studentWork review pane and grades | Workspace Marketplace review + Education Plus / Teaching & Learning licences | ~4–8 weeks |

---

## Level 0 — what is live in the repo now

`public/assets/js/cmc-game-chrome.js` and Mafia Noir's own share kit both offer:

```
https://classroom.google.com/share?url=<page>&title=<title>
```

That endpoint is Google's own documented Classroom share flow — the teacher (or
student) picks a class and posts the link as an announcement, assignment or
material. **No API key, no OAuth client, no scopes, no verification.** It is
deliberately the lowest-risk win, and it is what “share to Google Classroom”
means for most classroom tools.

What it cannot do: it cannot pre-pick a class, attach a file, or return grades.
That is where an API starts.

## Level 1 — Classroom API (assignments + grades)

### What it buys

- Teacher signs in with Google → CMC lists **their** classes (`courses.list`).
- One click creates a real assignment (`courses.courseWork.create`) with the
  game link or worksheet attached, a due date, max points and a rubric.
- `studentSubmissions.list` brings the student's score/state back, and
  `studentSubmissions.patch` (or `return`) pushes the graded score Classroom
  shows — this is the “grade passback” teachers actually ask for.
- Optionally mirror CMC's own class lists to Classroom rosters.

### Scopes (Classroom)

| Scope | Why |
|---|---|
| `classroom.courses.readonly` | list the teacher's classes |
| `classroom.coursework.students` | create/modify assignments and grades in classes they teach |
| `classroom.coursework.students.readonly` | read submissions (or `student-submissions.students.readonly`) |
| `classroom.rosters.readonly` | only if we import rosters |

Classroom scopes are **sensitive**, not restricted: Google review, no CASA audit.
Review is quoted at up to ~10 business days once the consent screen, homepage,
privacy policy and a demo video are in place.

### The shortcut worth checking first

If CMC's teachers use **Google Workspace for Education** and the Google Cloud
project is created *inside that organisation*, set the OAuth consent screen user
type to **Internal**. Google's own policy: internal apps "do not require further
review" — no verification queue, no CASA, no 100-user test cap. That is the
single decision that changes the schedule, so confirm it before writing code.
The catch: only accounts inside that Workspace can authorise the app.

### Flow in this repo

```
Teacher (CMC teacher account)
  → "Connect Google Classroom" in the dashboard
  → GIS token client: https://www.googleapis.com/auth/classroom.coursework.students …
  → CMC POSTs { classId, title, description, link, points, dueDate } to
    https://classroom.googleapis.com/v1/courses/{id}/courseWork  (Bearer token)
  → Classroom shows the assignment to the class
  → student finishes the game / worksheet in CMC, run lands in drill_attempts
  → Cloud Function maps attempt → courseWorkId + student email and PATCHes
    studentSubmissions/{id}  { assignedGrade, draftGrade, state: 'TURNED_IN' }
```

Two ways to hold the token:

1. **Browser-only (fastest).** Google Identity Services returns an access token
   for ~1 hour, no refresh token, so the teacher reauthorises per session. Fine
   for “create assignment now”; bad for overnight grade sync.
2. **Cloud Functions (recommended).** Existing `functions/` project exchanges
   the code for a refresh token and stores it encrypted per teacher
   (`teacher_google_tokens/{uid}`, teacher-only rules, never readable by the
   client). All Classroom calls happen server-side, so scopes never touch a
   student browser and grade passback runs from a scheduled function.

## Level 2 — Drive

| Job | Scope | Tier |
|---|---|---|
| Create CMC files (results CSV, worksheet PDF, certificate), then read/write only those | `drive.file` | **non-sensitive — no review, no CASA** |
| Attach a file the teacher picked in the Google Picker | `drive.file` (+ Picker) | non-sensitive |
| Browse or search the teacher's whole Drive | `drive.readonly` / `drive` | **restricted → verification + CASA audit, repeated every 12 months** |

So: build the Drive features on `drive.file` only. “Save results to Drive”,
“export this class's scores as a Sheet”, “attach this worksheet to the
assignment” all fit; “search Mr. Ry's Drive” does not, and is not worth an
annual security audit.

Practical details:

- Create files with `files.create` (multipart or resumable upload); a Google
  Sheet can be created directly with `mimeType: application/vnd.google-apps.spreadsheet`.
- Share with `permissions.create` (`type: 'user' | 'anyone'`) — that is how a
  teacher gets a link they can post in Classroom.
- Drive and Classroom pair naturally: upload the CSV with `drive.file`, then set
  it as `materials.driveFile` on the courseWork in the same request.

## Level 3 — Classroom add-on (only if CMC wants to live inside Classroom)

An add-on embeds CMC in an iframe inside Classroom (assignment creation,
student view, teacher review) and needs `classroom.addons.teacher` /
`classroom.addons.student`, a Marketplace listing, and the add-on requirements
checklist. Teachers need **Education Plus** or the **Teaching & Learning
upgrade** — so this is a school-licence decision, not a coding one. Park it
until levels 1–2 are in daily use.

---

## Privacy, consent and policy (do not skip)

- Publish a **privacy policy on the same domain** as the app before submitting
  any scope for verification, describing exactly what is read and stored.
- Store the minimum: class id, courseWork id, the student's CMC uid and the
  score. Never store Classroom rosters wholesale.
- Under-13 students: parental/school consent for the Google data flow, and the
  Workspace-for-Education data terms, apply on top of CMC's own consent.
- Students never authorise Google scopes in the recommended design — only
  teachers do, and only for their own classes.
- Use `include_granted_scopes` and narrow, incremental authorisation: ask for
  Drive when the teacher exports, not when they sign in.

## Suggested build order

1. ✅ Level 0 — shipped, in every share sheet.
2. Confirm the Google Cloud project can be **Internal** to a CMC Workspace org.
   If yes, level 1 loses its review queue and becomes a one-week job.
3. Level 1 read-only first: “Connect Classroom” → list classes → create an
   assignment with a link (`coursework.students`). Ship it, let teachers use it.
4. Level 1 write: grade passback from `drill_attempts` through Cloud Functions.
5. Level 2 with `drive.file`: export results CSV / attach worksheets.
6. Only then consider level 3 (add-on) if the school holds the licences.

## Files this touches when we build it

| Area | File |
|---|---|
| Connect / list / create UI | `src/components/TeacherTools.tsx`, `src/components/AdminUsersPanel.tsx` |
| OAuth + tokens | `functions/src/` (new `classroom.ts`), Firestore `teacher_google_tokens/{uid}` |
| Scopes + client id | `.env.example`, Google Cloud console |
| Server-side Classroom calls | `functions/src/classroom.ts` |
| Score source | `src/lib/submitScore.ts` → `drill_attempts` |
| Rules | `firestore.rules` (teacher-only token doc) |

Scopes are quoted from Google's Classroom auth guide
(`developers.google.com/workspace/classroom/guides/auth`); the verification
tiers and the Internal-user-type exemption come from Google's sensitive-scope
verification policy page, and the `drive.file` vs `drive` split from the Drive
scope docs.
