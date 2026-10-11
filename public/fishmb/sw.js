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

// Push notifications for new messages.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {}
  const title = data.title || "FishMB";
  const options = {
    body: data.body || "You have a new message.",
    icon: "/fishmb/icon-192.png",
    badge: "/fishmb/icon-192.png",
    data: { url: data.url || "/fishmb/messages" },
    tag: data.tag || "fishmb-message",
  };
  event.waitUntil(
    (async () => {
      // Don't notify if the user is already looking at messages.
      try {
        const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const client of clients) {
          if (client.url.includes("/fishmb/messages") && client.focused) {
            // Update the badge silently, skip the visible notification.
            if (typeof self.navigator.setAppBadge === "function" && typeof data.unread === "number" && data.unread > 0) {
              await self.navigator.setAppBadge(data.unread);
            }
            return;
          }
        }
      } catch (e) {}
      // Update the app icon badge if the payload carries a count.
      try {
        if (typeof self.navigator.setAppBadge === "function" && typeof data.unread === "number" && data.unread > 0) {
          await self.navigator.setAppBadge(data.unread);
        }
      } catch (e) {}
      await self.registration.showNotification(title, options);
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/fishmb/messages";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes("/fishmb/messages") && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});
