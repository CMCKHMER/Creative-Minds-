# Google Drive & "share to Google Classroom" — how to wire it up

Four levels, cheapest first. **Level 0 already ships.** Levels 1–2 are coded:
`public/assets/js/cmc-google.js` (+ typed facade `src/lib/google.ts`) does the
OAuth, the Drive upload and the Classroom calls — it just needs a Google Cloud
project and one env value to switch on.

| Level | What the teacher/student sees | Google setup | State |
|---|---|---|---|
| **0 — Share dialog** | “Share → Google Classroom” opens Classroom's own dialog; pick a class, post as announcement/assignment/material | **none** | shipped in every game's share sheet |
| **1 — Classroom API** | “Post as assignment” with due date + points, and grades pushed back to Classroom | Cloud project, Classroom API, OAuth consent, sensitive-scope review *(skipped if Internal)* | code ready, needs client id |
| **2 — Drive** | “Save results to Drive” (CSV → Google Sheet), attach a file to the assignment | Cloud project, Drive API; `drive.file` needs **no** review | code ready, needs client id |
| **3 — Classroom add-on** | CMC runs *inside* Classroom with a student-work review pane | Marketplace review + Education Plus / Teaching & Learning licences | not started (licence decision) |

---

## Turn it on — the 10-minute runbook

Do this once, in the Google Cloud project that already owns the Firebase app
(`creative-minds-…`), so billing/quota stay in one place.

1. **Create or pick a project** — <https://console.cloud.google.com/project>.
   *If CMC has Google Workspace for Education:* create the project **inside that
   organisation**. It is the difference between “no review” and “up to 10
   business days”.
2. **Enable the two APIs** — *APIs & Services → Library*:
   - **Google Classroom API**
   - **Google Drive API**
3. **Consent screen** — *APIs & Services → OAuth consent screen*:
   - User type: **Internal** (Workspace org) or **External** (personal Gmail).
   - App name `Creative Minds`, support email, developer email.
   - **Authorised domains:** `cmckhmer.github.io`.
   - **Privacy policy:** a page on the same domain (e.g. the site's privacy
     section). Google requires it before any review.
   - **Scopes** — add exactly these four and nothing else:
     ```
     https://www.googleapis.com/auth/drive.file
     https://www.googleapis.com/auth/classroom.courses.readonly
     https://www.googleapis.com/auth/classroom.coursework.students
     https://www.googleapis.com/auth/classroom.announcements
     ```
4. **OAuth client** — *APIs & Services → Credentials → Create credentials →
   OAuth client ID → Web application*:
   - **Authorised JavaScript origins:**
     ```
     https://cmckhmer.github.io
     http://localhost:5173
     ```
   - No redirect URI is needed: this flow is a browser token, not a redirect.
5. **Copy the client id** (`…apps.googleusercontent.com`) into `.env.local`:
   ```
   VITE_GOOGLE_CLIENT_ID=1234567890-abc123.apps.googleusercontent.com
   ```
   With the variable set, the React app loads the client by itself on the next
   build. Any static page (a worksheet, a game) includes it directly:
   ```html
   <script>window.CMC_GOOGLE_APP = { clientId: '1234567890-abc123.apps.googleusercontent.com' };</script>
   <script src="../../assets/js/cmc-google.js"></script>
   ```
   The id is a **public** value; it ships in the bundle either way. Protect the
   project with API-key referrer restrictions, not by hiding this.
6. **Rebuild** (`npm run build`) and deploy. On GitHub Pages the build runs in
   Actions, so add the same value under *Settings → Secrets and variables →
   Actions → Variables* as `VITE_GOOGLE_CLIENT_ID` (the workflow already passes
   it to `npm run build`; unset means every Google feature stays off). Until step 5 the script is inert:
   it loads nothing from Google and every call rejects with
   `code: 'not-configured'`.

> **Publishing:** with User type **Internal** you are done — no verification, no
> test-user cap. With **External**, the app stays in *Testing* (100 users) until
> Google approves the sensitive scopes: home page, privacy policy, per-scope
> justification and a short demo video.

## Use it

The script exposes one global, `CMCG` (alias `CMC_GOOGLE`). Nothing loads from
Google until `connect()` runs, so it costs nothing on page load.

```js
// 0 · share dialog — always works, no credentials, no scopes
CMCG.shareToClassroom(location.href, 'Word Creator');

// 2 · Drive: a class's scores as a real Google Sheet (drive.file)
const sheet = await CMCG.drive.saveCsvAsSheet({
  name: 'CMC Week 8 — 7A',
  csv: 'name,score\nRy,9\nDara,8\n',
});
console.log(sheet.webViewLink);      // https://docs.google.com/spreadsheets/…

// 1 · Classroom: an assignment with the game link, a due date and points
const courses = await CMCG.classroom.listCourses();
await CMCG.classroom.postAssignment({
  courseId: courses[0].id,
  title: 'Brain Lounge · Word Creator',
  description: 'Play one match, post your score to the lounge board.',
  url: location.href,
  dueDate: '2026-11-20',             // YYYY-MM-DD (UTC)
  maxPoints: 10,
});

// 1 · grade passback
await CMCG.classroom.setGrade({
  courseId, courseWorkId: work.id, submissionId: sub.id, grade: 9,
});
```

Errors are structured — show `err.message` to the teacher:

| `err.code` | Meaning |
|---|---|
| `not-configured` | no client id — fall back to `shareToClassroom()` |
| `consent` | the teacher closed / refused the Google prompt |
| `http` | Google answered 4xx/5xx; `err.status`, `err.body`. 403 usually means “not a teacher of that class”, or the API/scope is not enabled on the project |
| `network` | Google could not be reached |

## Use it from React

`src/main.tsx` calls `loadGoogleClient()`, which injects the script **only when
`VITE_GOOGLE_CLIENT_ID` is set**, and `src/lib/google.ts` gives it types:

```tsx
import { googleClient } from '../lib/google';

async function postGameAsAssignment(gameUrl: string, title: string) {
  const g = googleClient();
  if (!g) throw new Error('Google client not loaded');
  if (!g.configured) {
    // no Google Cloud project yet — the zero-setup path
    g.shareToClassroom(gameUrl, title);
    return;
  }
  const [course] = await g.classroom.listCourses();
  if (!course) throw new Error('No active Classroom classes on this account.');
  return g.classroom.postAssignment({
    courseId: course.id, title, url: gameUrl, maxPoints: 10,
  });
}
```

Put the button behind a teacher check (`useSignedInSession` + role) — students
must never see it, and Google would refuse the call anyway.

Suggested first homes for the buttons:

| Surface | Button | Call |
|---|---|---|
| `BiWeeklyTestsPanel` / results sheet | “Save results to Drive” | `drive.saveCsvAsSheet` |
| Assignment preview / `ResourceLibrary` | “Post as Classroom assignment” | `classroom.postAssignment` |
| Brain Lounge game pages | “Share to class” (already there) | `shareToClassroom` |

## Design for grade passback

The browser token lasts ~1 hour, so **push grades from the browser only while
the teacher is on the page**. For overnight sync, move the calls into
`functions/` and store a refresh token server-side:

```
Firestore
  teacher_google_tokens/{teacherUid}     server-only (rules: read/write false, admin SDK only)
  classroom_links/{teacherUid}_{drill}   { courseId, courseWorkId, courseName, createdAt }
  drill_attempts/{id}                    existing rows; add classroomSync: { courseId, courseWorkId, pushedAt }
```

Flow: teacher posts the assignment → the mapping is saved → a scheduled function
reads unsynced attempts, matches the CMC student to a Classroom `userId` (only
possible if we imported rosters — otherwise let the teacher paste the email or
let students submit through Classroom's own link), then calls
`studentSubmissions.patch`. Anything that needs the student's Google identity
should stay inside Classroom's own submission flow rather than us matching
emails.

## What this refuses to do — on purpose

| Want | Scope | Tier |
|---|---|---|
| Create CMC files, edit files the app made | `drive.file` | non-sensitive — **what we use** |
| List/search the teacher's whole Drive | `drive.readonly` / `drive` | **restricted** → verification **+ annual CASA security assessment** |
| Read class rosters, students' emails | `classroom.rosters.*`, `profile.emails` | sensitive + a real privacy decision |
| Act as the student | `classroom.coursework.me` | not needed; students submit in Classroom |

If someone asks for “pick any file from my Drive”, the answer is the **Google
Picker** with `drive.file` — the teacher hands one file over, we never see the
rest.

## Testing without Google

- **Inert mode** (no client id): `CMCG.configured === false`, no script tag is
  added to the page, no request leaves the browser. `src/lib/cmcGoogle.test.ts`
  pins this plus the Drive multipart body, the assignment payload, the grade
  patch and the 403 message, against a fake `google.accounts.oauth2` and a fake
  `fetch`.
- **Real smoke test** (after step 5): open the site → console →
  `await CMCG.connect()` → `await CMCG.classroom.listCourses()`. A 403 here means
  the Classroom API or the scope is missing from the project; `access_denied`
  means the account is outside an **Internal** app.
- Classroom has no test sandbox: use a real class you teach, and prefer
  `draft: true` when trying assignment creation.
