// Kingdom PWA service worker — cache-first for the immutable art library,
// network-first for the app shell (so deploys land immediately).
const SHELL = 'kingdom-shell-v1';
const ART = 'kingdom-art-v1';

self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // client art + core data are immutable per deploy: cache-first
  if (url.pathname.includes('/data/')) {
    e.respondWith(
      caches.open(ART).then(async (cache) => {
        const hit = await cache.match(e.request);
        if (hit) return hit;
        const res = await fetch(e.request);
        if (res.ok) cache.put(e.request, res.clone());
        return res;
      })
    );
    return;
  }
  // app shell: network-first with cache fallback (offline support)
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put(e.request, copy));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
  }
});
