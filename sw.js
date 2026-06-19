/* ArgantaLab service worker — offline cache.
   Optional: index.html falls back to an inline blob SW if this file is absent,
   but this page-scoped version is what enables full offline install. */
const CACHE = 'argantalab-v1';
const ASSETS = [
  './',
  './index.html',
  './AppGame_Strike_Zone_3D.html',
  './AppGame_Strike_Zone_Critter_Keys.html',
  './AppGame_Strike_Zone_Kincatch.html',
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {})));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// stale-while-revalidate
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.open(CACHE).then(c =>
      c.match(e.request).then(cached => {
        const net = fetch(e.request).then(res => {
          if (res && res.ok) c.put(e.request, res.clone());
          return res;
        }).catch(() => cached);
        return cached || net;
      })
    )
  );
});
