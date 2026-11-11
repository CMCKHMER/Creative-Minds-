/*
 * CMC service worker — offline support for students on flaky mobile data.
 *
 * Strategies (same-origin GET only):
 *   - HTML navigations ......... network-first, cache fallback (fresh pages
 *                                when online; a finished test page still
 *                                renders when the connection drops)
 *   - JSON feeds (headlines) ... network-first, cache fallback
 *   - audio / images / fonts ... stale-while-revalidate (instant playback on
 *                                repeat listens; refreshed in background)
 *   - everything else static ... stale-while-revalidate
 *
 * Firebase APIs and analytics are never cached or intercepted.
 *
 * Deploying an update: bump CACHE_VERSION, old caches are purged on activate.
 */

const CACHE_VERSION = 'cmc-v45';  // v45: Assessment area bug check + AI Tutor agent (owner: "Assessment area needs a bug check and we need to get the Ai function working like a tutor agent which handles keyed in stats and can maintain the records"). BUGS FOUND AND FIXED by the new end-to-end harness scripts/verify_assessment.mjs (42 checks — an in-memory Firestore REST fake driving the real built workspace): (1) "newest activity first" class ordering silently never worked — the REST layer writes updatedAt as an ISO string but the reader only accepted Firestore timestampValue (reader now accepts both shapes for classes and students); (2) after Add student the new row took up to one 6s poll cycle to appear — add + duplicate now insert optimistically, matching delete/transfer; (3) the week selector kept displaying "Initial record" after picking a fresh week — it now lists the selected week before its first score exists; (4) a two-letter student name ("Ly") lit up inside "falling" — assistant name matching is word-boundary now; (5) the agent thread (and its per-card Undo) died when the teacher peeked at another tab — the AI Tutor tab stays mounted (hidden, not unmounted). AI TUTOR AGENT: type stats in plain language — "Dara listening 4 speaking 3", "hw 80 85 90 part 70", "term 2 quiz 3 70", "pbl presentation 85", "add student Sreyleap", "note for Dara: much better participation", "clear the week for Bora" — new src/lib/tutorAgent.ts parses them deterministically ON-DEVICE (span-reserved alias rules so "term 2 quiz 3" never double-files Term 1, word-boundary student resolution, 0-5/0-100 clamping, week targeting with an "initial" override, sequential daily fill), shows a confirmation card listing every parsed value ("nothing is saved until you apply"), and applies through the SAME Firestore data layer the tables use (same per-field masks, same updatedAt/updatedBy stamps, teacher-only rules — NO rules change) with optimistic roster merge and a per-card Undo that writes the previous values back; everything else still routes to the trend Q&A; tab renamed AI Insights → AI Tutor. tutorAgent.test.ts pins 17 parser rules; suite 219/219; verify_assessment 42/42; vq_and_hero 30/30, command_center 27/27, announcement_fold 13/13, holo_float 17/17, clear_glass 32/32. // v44: Kid 11 card fold — owner: "add a more button so the card does not get too long" (a dedicated homework page was weighed and passed on: the fold keeps students one tap from the assigned homework with zero duplicated gate logic). The online-homework list on every grade card starts folded to two rows behind a More homeworks · N more / Show less toggle (aria-expanded, chevron); the fold ALWAYS carries every currently-open homework even beyond the two-row base, so homework the teacher assigns is never hidden behind More, and students count only viewer-visible rows — unshared homework stays completely invisible, the fold is never a peek. verify_unit13_homework extended 145/145 (fold default + label count, More→Show less round trip, folded teacher switches, open-homework-beyond-fold pinned for teacher AND student, student no-fold-control case); suite green (doctor_fish 109, clear_glass 32, holo_float 17, announcement_fold 13, vq_and_hero 30, command_center 27). // v43: Unit 13 'New Homes for Animals' homework joins the Kid 11 card as a 3-homework file (public/rfc3/unit13hw.html, the teacher's Homeworks 1-3 transcribed 1:1: Field Notebook 30 pts, Relocation Mission 25 pts, Campaign Studio 16 pts = 58 graded keys) with ONE share switch per homework: each homework is gated by its own Firestore doc (biweekly_tests/hw-kid11-u13-hw1|2|3, public read + teacher-only write, no rules change) so when the teacher assigns ONE homework only that one can be completed - unshared homeworks stay completely invisible to students (card row hidden via hideUntilShared, page tab hidden, deep links like #hw-b fall back to the first shared homework, no-homework state shows a full-page locked overlay that auto-lifts when a homework is shared, and an open homework that gets closed re-locks live with auto-switch to the next shared one). The worksheet carries the site homework furniture: back-to-CMC pill, teacher preview banner, Submit-to-Teacher button that posts the ACTIVE homework's score to drill_attempts (guest branch validated, name gate, name/date mirrored across all three heroes, payload titles Homework 1/2/3), Share menu, and the Doctor Fish name/date readability fix mirrored onto the white hero boxes. Kid 11 card: 3 new homework rows with per-row switches + PATCH per share doc; teacher caption explains per-homework sharing. verify_unit13_homework.mjs new (58-key 1:1 pin, gate states, deep-link fallback, auto unlock/relock/switch, 0/30+8/30+HW2/HW3 payloads, card rows); suite green. // v42: homework access fix — owner report "i cant access the homework. telling me to sign in when i am already", three root causes eliminated: (1) the Kid 11 card now re-syncs its teacher detection on every cmc-auth-changed event (sign-in/out/refresh/SDK-recovery), so a teacher who signs in after the page loaded sees the Share-with-students key immediately instead of a permanently locked row; (2) the share switch classifies its own failures instead of blanket-asking an already-signed-in teacher to sign in — getValidIdToken gained a live-SDK fallback (stale/expired localStorage mirror recovers from the signed-in Firebase SDK session and re-mirrors itself) and a keepSessionOnUnverified option, and the card shows precise recoverable states: signed-out (Sign-in button wired to the auth modal), expired session (Sign in + Try again), unverified email (verify-your-inbox copy with the account address), Firebase 403, or plain network — plus a Try again button; (3) the share state is now LIVE: the card re-reads the doc every 20s and on tab focus, the homework page gate re-checks every 15s + on focus/visibility/pageshow + a Check-again button and re-reads the teacher heuristic on every check, so homework shared (or a teacher sign-in completed) in another tab/device lifts the lock and the overlay WITHOUT a reload — no more 'ask your teacher' dead-end for a signed-in teacher. verify_doctor_fish extended (auth-changed switch appearance without reload, classified failure states via intercepted PATCH, gate auto-unlock on visibility flip, Check-again affordance). // v41: Kid 11 homework iteration on owner feedback — (1) the purple online-homework hero's Name/Date inputs are READABLE again: the worksheet's generic input[type=text] rule landed after .meta input in the cascade and left white text on a white box; the rebuilt .hw-meta hero pins translucent purple backdrop + white text/caret/autofill with !important; (2) the teacher's newest worksheet file (drfish.html — Home Assignments 1 & 2: Newsroom writing & media + Clinic critical thinking & speaking, 22+21 auto-graded points, sort trays, ordering, live writing checklists) is attached 1:1 to the first online homework (Doctor Fish) replacing the old 30-question transcription — every graded key verified equal to the teacher's file; hero name/date sync into both assignment sheets; Submit-to-Teacher posts the ACTIVE assignment's score (Newsroom / Clinic titles) through the same drill_attempts guest branch; (3) the homework can only be done if the teacher shares it: share state lives in biweekly_tests/hw-kid11-doctor-fish (public read, teacher-only write — no rules change) — students get a locked overlay on the page and a locked Kid 11 card row until the teacher flips the new Share-with-students key switch on the card (PATCH share doc under their own verified-teacher token; flip again to close), teachers keep preview access with an on-page banner. verify_doctor_fish rewritten 90/90 (gate states, teacher bypass, 22/22 + 0/21 payloads, card switch round-trip). // v40: Kid 11 online homework — the Unit 14 “Doctor Fish” live worksheet (public/rfc3/doctor-fish.html, faithful 30-question auto-graded transcription) joins the Kid Program Kid 11 card as its own Online Homework section: every homework row has a Share button (native share sheet on phones, clipboard fallback on desktop) and the page itself carries a Share menu (Copy Link / WhatsApp / Telegram / Email) plus a Submit to Teacher completion button that POSTs the student's name + score to the drill_attempts pipeline — signed-in students under their own localStorage session token, visitors through the validated guest branch (empty studentUid, 1–40 char name, classId null) — so completions land in the teacher dashboard feed and the homepage ticker with no rules change; back-to-CMC button matches the other Reading Future worksheets. // v38: compact announcement feed + circuit texture restored on the bi-weekly planner. News & Announcements posts taller than the 600px original-content window now fold with a soft bottom fade and a Read more/Show less toggle (ResizeObserver re-measures on image load and edits; posts inside the window render exactly as before, admin Edit/Pin/Delete row moved below the fold region so it stays reachable); bi-weekly TOEFL planner: the circuit-board texture under the week-card glass is BACK (owner: only the scanlines were to be removed) — clear glass, neon 4-layer text glow, projector light and the whole 3D floating stage unchanged, scanlines stay gone (verify_clear_glass 32/32, verify_holo_float 17/17, new verify_announcement_fold 13/13). // v37: bi-weekly TOEFL planner card panels stripped of every line — the 4px scanlines and the circuit-board SVG texture under the glass are gone, so the week cards read as spotless clear hologram glass (shared .glass 0.055 fill kept, backdrop blur 16→18px + saturate 1.45, brighter ice-blue edge light + 1px inner rim); text on every panel now emits a NEON blue light — 4-layer text-shadow (ice-white core 2px + three expanding blue halos to 44px) on headings, paragraphs, drill labels, chips and counts, retuned per theme (light theme gets the 4-layer sky-blue emission); HUD console chrome (runway floor, corner brackets, eyebrows, hazard advisory) untouched, 3D floating stage untouched (verifier scanline assertions inverted to REMOVED + new circuit/neon checks — verify_clear_glass 31/31, verify_holo_float 17/17). // v36: bi-weekly TOEFL planner reskinned as a sci-fi HUD hologram console (reference board style) — electric-blue deep-space wash, animated perspective runway grid floor with red runway lights, fixed HUD corner brackets + edge rulers, rainbow-ring scanner with radar core + POS readout, dotted globe hologram, circuit traces, MODULE 01-03 headers with dotted leaders, MDL-Wxx tech strips with ONLINE LEDs on every week card, corner brackets + notch cut line on every panel, angular cut-corner filter pills, hazard-striped field advisory, warning footer tag; light theme retuned as daytime HUD; mobile keeps every function with compact decorations; holographic 3D stage, glass stops, text glow and scanlines untouched (verifiers 17/17 + 29/29). // v35: Creative Minds Studio made mobile-friendly — compact phone/tablet layout at ≤900px with every function kept: menubar becomes a horizontal scroll strip with on-screen dropdowns (keyboard hints hidden), quick toolbar scrolls with bigger tap targets, right panel becomes a floating drawer over the stage (View ▸ Show Side Panel + ‹ › toggle still drive it, drawer starts hidden), canvas rail slims to 48px and collapses to zero in Docs/Excel/Code, rulers auto-hide on phones, 100dvh fixes the iOS viewport so the status bar stays reachable, Excel page box drops the desktop landscape forcing on mobile so the grid fills the stage, canvas refits on every mode change, the floating Back-to-CMC pill is replaced by File ▸ Back to CMC Home on small screens, welcome screen grid tightens, and touch painting/tap-select verified end-to-end (49 automated checks across phone 393×852, tablet 768×1024 and desktop 1440×900 — desktop layout untouched). // v34: clear hologram glass pass — bi-weekly planner panels thinned to see-through glass with glowing blue text-light on every word (both themes); student area (Live Class Results command center) scanlines REMOVED, panels cleared to transparent holo glass with brighter edge light + floor light, glowing blue text on console bar/stats/panel heads (data tables + spreadsheet untouched, no text glow there). // v33: Talk to me expanded with Unit 5 'Master Class' — three advanced levels (13 Set the Table: on/next-to/between placement; 14 Animal Shelter: feed all four animals in one long chain; 15 The Master Key: colours, biggest/smallest, key+door tower and ball-on-table placement) — amber unit accent, hero copy 15 levels · 5 units, leaderboard slugs voice-quest-l13…l15, Word Book/list stats derive automatically; hero-page nav fixes: TOEFL iBT + Learning Games quick cards now reach the mock-test section / Play Lab, Explore teacher tools opens the Teacher Tools page, Quick Links TOEFL iBT / Bi-Weekly Planner / Printable packs / Prefix & Suffix land on their declared targets. // v32: Talk to me linked to the CMC stats pipeline — every finished level POSTs to drill_attempts (same collection as all other games), so players appear on the homepage ticker, the Learning Games leaderboard, the live sheet and the dashboard; one-time "Who's playing?" prompt in the game's own style (name remembered 90 days, Skip → Guest), signed-in students submit under their real account via the shared Firebase session, ticker confirmation line on the level-complete screen; fixed the name-modal input wiping typed text on every keystroke. // v31: Live Class Results section reskinned as a Teacher Command Center — holographic console bar with live status chips + clock, see-through glass stat readouts and roster/feed panels floating on a shared 3D stage, HUD corner brackets, keycap press glow; data tables and spreadsheet card untouched; reduced-motion and touch degrade gracefully.
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const AUDIO_CACHE = `${CACHE_VERSION}-media`;

const NEVER_INTERCEPT = [
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'accounts.google.com',
  'apis.google.com',
  'firebaseio.com',
  'googleapis.com/v1/',
  'googletagmanager.com',
  'google-analytics.com',
  'googleads.g.doubleclick.net',
];

self.addEventListener('install', (event) => {
  // Take over immediately instead of waiting for all tabs to close.
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      // Warm the shell so first offline load has something to show.
      cache.addAll(['./', './manifest.webmanifest']).catch(() => undefined),
    ),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => !key.startsWith(CACHE_VERSION)).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (NEVER_INTERCEPT.some((host) => url.href.includes(host))) return;

  // HTML pages (including the tool pages under /toefl-ibt/, /biweek-planner/…):
  // always prefer the freshest version when online.
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(networkFirst(request, STATIC_CACHE));
    return;
  }

  // News headlines and other feeds: fresh when possible.
  if (request.destination === '' && url.pathname.endsWith('.json')) {
    event.respondWith(networkFirst(request, STATIC_CACHE));
    return;
  }

  // Listening-test audio, images, fonts: instant from cache, refresh behind
  // the scenes. This is what lets a student finish a listening section when
  // the signal drops mid-test.
  if (request.destination === 'audio' || request.destination === 'video' || /\.(mp3|wav|ogg|m4a)$/i.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, AUDIO_CACHE));
    return;
  }

  if (request.destination === 'image' || request.destination === 'font' || /\.(png|jpe?g|gif|svg|webp|woff2?)$/i.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }

  // CSS/JS and hashed build assets: cached with background refresh.
  event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
});

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (offline) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    // Offline fallback for a never-visited page: the app shell.
    const shell = await cache.match('./');
    if (shell) return shell;
    return new Response('Offline — this page has not been cached yet.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreSearch: false });
  const refresh = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  return cached || (await refresh) || new Response('', { status: 504 });
}
