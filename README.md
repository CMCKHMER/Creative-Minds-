# Creative Minds Network — CMC Network Hub

Teacher-resource landing page and assessment studio for **Creative Minds Network (CMC)**, built with React, Vite and Tailwind CSS v4.

## Run locally

```bash
npm install
npm run dev      # dev server with hot reload
npx vitest run --config vitest.config.ts # content/scoring checks
npm run build    # production build -> dist/
npm run preview  # preview the production build
```

## Deploy to GitHub Pages

The build uses `vite-plugin-singlefile` to inline JavaScript and CSS into
`index.html`. Images remain in `dist/images/` and use relative URLs, so the
site works from a project path like `https://<user>.github.io/<repo>/`.

### Option A — Automatic (recommended)

A GitHub Actions workflow is included at `.github/workflows/deploy.yml`.

1. Push this project to a GitHub repository (branch `main`).
2. In the repo: **Settings → Pages → Build and deployment → Source** and choose
   **GitHub Actions**.
3. Every push to `main` now builds and publishes the site automatically.
4. Your site will be live at `https://<user>.github.io/<repo>/`.

### Option B — Manual, no Actions

1. Run `npm run build`.
2. Copy the entire contents of `dist/`, including `index.html` and `images/`,
   to your repo root (or to a `docs/` folder) and commit them.
3. **Settings → Pages → Deploy from a branch** → pick `main` and the folder
   (`/` root or `/docs`).

## Ready-to-use assignments

The resource library contains six general classroom assignments, defined in
`src/data/assignments.ts`. Each includes student-facing activities and a
separate teacher key; several include a scoring rubric and teacher notes.

- Preview an assignment and switch between **Student copy** and **Teacher key**.
- **Download student copy** saves a self-contained, printable HTML file.
- **Print / save PDF** opens the selected version in a print-ready tab. Use the
  browser's print dialog and choose **Save as PDF** if you need a PDF.

## Kid Program · Grades 5–12

The **Kid Program** hub (`src/components/KidGradeHub.tsx`) reserves a clearly
labeled resource card for every grade from 5 through 12. **Kid 6** links to the
existing [Reading Future Connect 2 Word Review](https://cmckhmer.github.io/Word-Review-RFConnect-2/)
vocabulary list and [Reading Future Connect 2 Dictation Worksheet](https://cmckhmer.github.io/Reading-Future-Connect-2/).
**Kid 11** links to [Reading Future Create 3 Dictation](https://cmckhmer.github.io/RFC3/).
The linked pages identify these materials as 16-unit resources. The other grades
are marked as planned until their materials are created; they do not offer
placeholder downloads.

The Kid 5–12 hub is linked from the hero shortcut strip, desktop and mobile
navigation, Quick Links, the feature overview, and the footer. Kid 6 opens in a
new tab so the main CMC site stays available.

## TOEFL Junior-Style Assessments

`src/data/toeflJuniorAssessments.ts` contains **15 original practice packs**:
five speaking, five listening, and five writing assessments. Each pack has
student prompts, teacher notes, suggested responses, and a skill-specific rubric.
All five listening sets ship with a full audio player (`src/components/ListeningAudioPlayer.tsx`):
play / stop / replay, English voice choice, 0.85×–1.05× speed, elapsed-time progress,
live sentence tracking, and a hidden-until-needed accessible transcript.
The member mini-mock enforces the exam-style 2-play limit per listening question;
classroom assignments and the Listening Scout game allow unlimited replays.
Downloaded student HTML copies include the same device-voice playback (hidden from
print); listening transcripts appear only in the teacher key. The voice is
synthesized on-device speech, not a professional audio recording. The items are classroom
practice, not official TOEFL questions or an ETS product.

The 15 packs cover five speaking tasks, five listening scripts, and five writing
tasks. Use the **Speaking / Listening / Writing** filters to find each set; every
assessment has at least three prompts, a student edition, a teacher key, and a
skill rubric.

## Learning Games

The **Learning Games** card opens a separate in-app `#games` hero page. Students
can browse six mini-games, filter by skill, read the challenge brief, play each
round, and review immediate feedback. These games run in the browser and do not
save student responses.

## Daily Student Assessment Records

The **Daily Student Assessment** entry on the hero shortcut strip and in the
navbar scrolls to a hero-styled linked card for the separate
[Student Assessment Records workspace](https://cmckhmer.github.io/Student-Assesment-Records/).
I inspected the linked page's text: it includes daily reading, listening/speaking,
PBL, quiz, homework, participation, overall-score, teacher-comment, and report
areas. Its source code and data controls belong to that separate site and are not
deployed or modified by this CMC repository. Verify its access, storage, backups,
and privacy settings with that site's administrator before entering identifiable
student information.

## Member TOEFL mini mock

The timed mini mock verifies an email-confirmed Supabase account and an active
server-side entitlement **before fetching questions**. The question bank and
answer key are intentionally absent from the public client bundle. Answer
selections and scores remain in the current browser tab; they are not submitted
or persisted.

### Connect a Supabase project

1. Create a Supabase project and configure Auth email verification, redirect
   URLs for local development and your GitHub Pages URL, and your SMTP provider.
2. Copy `.env.example` to `.env.local`. Set `VITE_SUPABASE_URL` and the
   browser-safe publishable key. Never put a Supabase secret/service-role key in
   a `VITE_` variable or any browser file.
3. Link the local Supabase CLI project and apply
   `supabase/migrations/202606010001_secure_members_and_contact_leads.sql`.
   The migration enables RLS, creates verified-email member profiles/free
   entitlements, rate-limited contact-lead storage, a 90-day lead cleanup job,
   and the account-deletion schema.
4. Copy `supabase/functions/.env.example` to `supabase/functions/.env` for local
   function development. Fill `MINI_MOCK_QUESTIONS_JSON` with the private JSON
   assessment bank and set `APP_ALLOWED_ORIGINS` to your exact development and
   production origins. Function secrets belong in the Supabase dashboard or
   local function environment, never in the client `.env`.
5. Deploy `capture-lead`, `member-mini-mock`, and `delete-account` to Supabase.
   Keep JWT verification enabled for member-only functions. The lead endpoint
   uses explicit consent, origin checks, a honeypot, hashed-address rate limits,
   and service-side validation. Set `LEAD_RATE_LIMIT_SALT` to a private random
   value of at least 32 characters in function secrets (and local function
   environment); do not leave the example placeholder in production.
   The private question bank is in the local, git-ignored
   `private-data/mini-mock-bank.json`. Push it as an Edge Function secret with
   `supabase secrets set MINI_MOCK_QUESTIONS_JSON="$(jq -c . private-data/mini-mock-bank.json)" APP_ALLOWED_ORIGINS="https://<user>.github.io,http://localhost:5173"`.
   For local function development, put the compact JSON in the ignored
   `supabase/functions/.env`; do not commit either private file.
6. For local development, run the Supabase stack and Vite together. For GitHub
   Pages, add only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to the
   GitHub Actions environment/repository variables, then rebuild and deploy.
   Never store the private mini-mock question bank in GitHub Pages variables or
   a `VITE_` variable; keep it in Supabase Edge Function secrets.

7. Run the database policy tests against the linked/local database with
   `supabase test db`. They are in `supabase/tests/member_data_rls.test.sql`.

The configured Supabase project, SMTP delivery, and deployment secrets were
not available in this workspace. The UI and server code are in place, but live
sign-up, mail delivery, database policies, Edge Function deployment, and
account deletion must be enabled and tested against your project before launch.

## Notes

- The hero artwork ships locally in `dist/images/`. Display fonts load from
  Google Fonts, so an internet connection is needed for those fonts. JS and CSS
  are inlined in `index.html`.
- The feedback, worksheet, and roster panes in the interactive playground are
  clearly labeled sample simulations. They are not connected to AI or an LMS.
- Newsletter email delivery is not configured; newsletter consent is captured
  separately from account/service-contact consent.
- The privacy disclosure is an implementation summary, not legal advice or a
  FERPA/COPPA/GDPR certification. Add operator contact information, actual
  subprocessors/data regions, and a reviewed privacy policy before public launch.
- Automated unit/content checks are in the GitHub Pages workflow and can be run
  locally with `npx vitest run --config vitest.config.ts`.
