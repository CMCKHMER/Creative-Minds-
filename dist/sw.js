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

const CACHE_VERSION = 'cmc-v20'; // v20: Week 2 Orientation Diagnostic updated to the new 23-question version (A:6 overview, B:5 structure, C:5 error ID, D:7 listening) in both teacher and private pages + studio keeps itself fresh (auto-update reload) and revives blob: images on restore; v19: Studio image-insert bug sweep — pasted screenshots now insert as data URLs (they used to vanish or die on reload), engine-proof insert with Range fallback when execCommand silently no-ops, drag-drop of a picture in Docs goes INTO the doc, Edit ▸ Paste inserts clipboard images, HEIC/AVIF/BMP/SVG pickable, clear error flash for undisplayable formats, big photos auto-shrunk to 1600px; v18: Studio Docs Page Setup (A4/A5/A3/Letter/Legal/Tabloid/Executive/Half-Letter/16:9 presets, portrait/landscape, margins — honored by Print/PDF and Word export) + Excel merge/unmerge cells (with row/col insert/delete shifting, sort guard, .xlsx merge import, .xls/print export), border styles (all/outside/none), wrap text, row height & column width dialogs, insert-function helper, sheet find & replace, more number formats (€, date, time, scientific…); v17: Studio opens real files — File ▸ Open + drag-drop route .docx/.odt/.rtf/.md to Docs, .xlsx (multi-tab)/.csv/.tsv to Excel, .js/.py/.css/.json etc. to Code, images to Canvas (zip parsing in-browser, no deps); v16: Studio Docs autosave with an on/off toggle (toolbar + File menu, fast doc snapshots, remembered per device); v15 Studio popup/MyBar/dark-mode; v14 Real-time Dashboard video hero + last-5 completed lists
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
