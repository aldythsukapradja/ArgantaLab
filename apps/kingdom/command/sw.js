// Kingdom Command Center service worker.
//
// Deliberately minimal: it exists so the console is installable as a PWA, but
// it NEVER caches the app shell (HTML/JS/CSS). Caching content-hashed or
// frequently-edited ops files is how you get the "stale blank dashboard" bug,
// so every request goes straight to the network. Offline is not a goal here —
// this is an admin tool that needs live data.
self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      // Purge anything a previous version may have cached.
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});
self.addEventListener('fetch', () => {
  // pass-through — do not intercept, do not cache
});
