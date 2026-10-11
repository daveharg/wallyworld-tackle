// FishMB service worker — minimal and safe.
// Exists to satisfy the PWA installability criterion. Deliberately caches
// NOTHING: every request goes straight to the network so Next.js chunks and
// pages can never go stale.
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
