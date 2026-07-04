// Kingdom PWA service worker.
//
// IMPORTANT: this SW deliberately does NOT cache the app shell (index.html,
// JS/CSS chunks). Vite content-hashes those, and caching them behind a SW
// caused blank pages on redeploys: a stale cached index.html referencing a
// deleted `index-XXXX.js` chunk -> 404 -> React never mounts -> white screen.
// The app shell always goes straight to the network (Vercel's CDN is fast).
//
// The SW ONLY caches /data/ — the large, immutable, content-addressed art +
// game-data library, where caching is a real win and never goes stale within
// a deploy.
const ART = 'kingdom-art-v2';
// caches from older SW versions that must be purged from stuck clients:
const STALE = ['kingdom-shell-v1', 'kingdom-art-v1'];

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    // remove the poison shell cache (and old art cache) that could be
    // serving a broken app shell in browsers stuck on an earlier version
    const names = await caches.keys();
    await Promise.all(
      names.filter((n) => STALE.includes(n)).map((n) => caches.delete(n))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // ONLY /data/ is cached (immutable art). Everything else — the app shell,
  // JS, CSS, Supabase, etc. — is left to the browser's normal network fetch.
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
  }
  // no respondWith for anything else => default network fetch, always fresh
});
