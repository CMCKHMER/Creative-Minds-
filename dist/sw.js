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

const CACHE_VERSION = 'cmc-v39'; // v38: compact announcement feed + circuit texture restored on the bi-weekly planner. News & Announcements posts taller than the 600px original-content window now fold with a soft bottom fade and a Read more/Show less toggle (ResizeObserver re-measures on image load and edits; posts inside the window render exactly as before, admin Edit/Pin/Delete row moved below the fold region so it stays reachable); bi-weekly TOEFL planner: the circuit-board texture under the week-card glass is BACK (owner: only the scanlines were to be removed) — clear glass, neon 4-layer text glow, projector light and the whole 3D floating stage unchanged, scanlines stay gone (verify_clear_glass 32/32, verify_holo_float 17/17, new verify_announcement_fold 13/13). // v37: bi-weekly TOEFL planner card panels stripped of every line — the 4px scanlines and the circuit-board SVG texture under the glass are gone, so the week cards read as spotless clear hologram glass (shared .glass 0.055 fill kept, backdrop blur 16→18px + saturate 1.45, brighter ice-blue edge light + 1px inner rim); text on every panel now emits a NEON blue light — 4-layer text-shadow (ice-white core 2px + three expanding blue halos to 44px) on headings, paragraphs, drill labels, chips and counts, retuned per theme (light theme gets the 4-layer sky-blue emission); HUD console chrome (runway floor, corner brackets, eyebrows, hazard advisory) untouched, 3D floating stage untouched (verifier scanline assertions inverted to REMOVED + new circuit/neon checks — verify_clear_glass 31/31, verify_holo_float 17/17). // v36: bi-weekly TOEFL planner reskinned as a sci-fi HUD hologram console (reference board style) — electric-blue deep-space wash, animated perspective runway grid floor with red runway lights, fixed HUD corner brackets + edge rulers, rainbow-ring scanner with radar core + POS readout, dotted globe hologram, circuit traces, MODULE 01-03 headers with dotted leaders, MDL-Wxx tech strips with ONLINE LEDs on every week card, corner brackets + notch cut line on every panel, angular cut-corner filter pills, hazard-striped field advisory, warning footer tag; light theme retuned as daytime HUD; mobile keeps every function with compact decorations; holographic 3D stage, glass stops, text glow and scanlines untouched (verifiers 17/17 + 29/29). // v35: Creative Minds Studio made mobile-friendly — compact phone/tablet layout at ≤900px with every function kept: menubar becomes a horizontal scroll strip with on-screen dropdowns (keyboard hints hidden), quick toolbar scrolls with bigger tap targets, right panel becomes a floating drawer over the stage (View ▸ Show Side Panel + ‹ › toggle still drive it, drawer starts hidden), canvas rail slims to 48px and collapses to zero in Docs/Excel/Code, rulers auto-hide on phones, 100dvh fixes the iOS viewport so the status bar stays reachable, Excel page box drops the desktop landscape forcing on mobile so the grid fills the stage, canvas refits on every mode change, the floating Back-to-CMC pill is replaced by File ▸ Back to CMC Home on small screens, welcome screen grid tightens, and touch painting/tap-select verified end-to-end (49 automated checks across phone 393×852, tablet 768×1024 and desktop 1440×900 — desktop layout untouched). // v34: clear hologram glass pass — bi-weekly planner panels thinned to see-through glass with glowing blue text-light on every word (both themes); student area (Live Class Results command center) scanlines REMOVED, panels cleared to transparent holo glass with brighter edge light + floor light, glowing blue text on console bar/stats/panel heads (data tables + spreadsheet untouched, no text glow there). // v33: Talk to me expanded with Unit 5 'Master Class' — three advanced levels (13 Set the Table: on/next-to/between placement; 14 Animal Shelter: feed all four animals in one long chain; 15 The Master Key: colours, biggest/smallest, key+door tower and ball-on-table placement) — amber unit accent, hero copy 15 levels · 5 units, leaderboard slugs voice-quest-l13…l15, Word Book/list stats derive automatically; hero-page nav fixes: TOEFL iBT + Learning Games quick cards now reach the mock-test section / Play Lab, Explore teacher tools opens the Teacher Tools page, Quick Links TOEFL iBT / Bi-Weekly Planner / Printable packs / Prefix & Suffix land on their declared targets. // v32: Talk to me linked to the CMC stats pipeline — every finished level POSTs to drill_attempts (same collection as all other games), so players appear on the homepage ticker, the Learning Games leaderboard, the live sheet and the dashboard; one-time "Who's playing?" prompt in the game's own style (name remembered 90 days, Skip → Guest), signed-in students submit under their real account via the shared Firebase session, ticker confirmation line on the level-complete screen; fixed the name-modal input wiping typed text on every keystroke. // v31: Live Class Results section reskinned as a Teacher Command Center — holographic console bar with live status chips + clock, see-through glass stat readouts and roster/feed panels floating on a shared 3D stage, HUD corner brackets, keycap press glow; data tables and spreadsheet card untouched; reduced-motion and touch degrade gracefully.
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
