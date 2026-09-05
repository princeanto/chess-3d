/**
 * Offline service worker.
 *
 * The app is a static export with no binary assets, so "works offline" reduces
 * to caching the document and the JS/CSS chunks Next emits. Chunk filenames are
 * content-hashed and change every build, so precaching a hardcoded list would
 * rot immediately — instead the shell is precached and everything else is
 * cached the first time it is fetched.
 */

const VERSION = 'runner-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then(async (cache) => {
      // addAll rejects the whole batch if any single request 404s, which would
      // leave the app with no cache at all. Failures are tolerated per-item.
      await Promise.all(
        SHELL.map((url) => cache.add(url).catch(() => undefined)),
      );
      await self.skipWaiting();
    }),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: try the network so an update is picked up when online, and
  // fall back to the cached shell when it is not.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(VERSION);
          cache.put('/', fresh.clone());
          return fresh;
        } catch {
          const cache = await caches.open(VERSION);
          return (
            (await cache.match(request)) ||
            (await cache.match('/')) ||
            (await cache.match('/index.html')) ||
            Response.error()
          );
        }
      })(),
    );
    return;
  }

  // Everything else: serve from cache when present, and populate it otherwise.
  event.respondWith(
    (async () => {
      const cache = await caches.open(VERSION);
      const hit = await cache.match(request);
      if (hit) {
        // Refresh in the background so a returning player gets the new build
        // without waiting on the network for this request.
        void fetch(request)
          .then((res) => res.ok && cache.put(request, res.clone()))
          .catch(() => undefined);
        return hit;
      }
      try {
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      } catch {
        return Response.error();
      }
    })(),
  );
});
