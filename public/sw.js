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

const CACHE_VERSION = 'cmc-v1';
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
