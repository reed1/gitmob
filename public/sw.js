// Passthrough only. GitMob shows live git/process state, so nothing is cached —
// a stale response here would be indistinguishable from current truth.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {});
