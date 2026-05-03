const CACHE_NAME = "smarty-cache-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(["/", "/feed"]))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const badgeCount = Number(data.badge || data.unreadCount || 1);

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title || "Smarty", {
        body: data.body || "You have a new update.",
        icon: "/icon-192.png",
        data,
      }),
      self.navigator && "setAppBadge" in self.navigator
        ? self.navigator.setAppBadge(badgeCount).catch(() => {})
        : Promise.resolve(),
    ])
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  let targetUrl = data.url || "/feed";

  if (data.chatId) {
    targetUrl = `/chat?chatId=${encodeURIComponent(data.chatId)}`;
  } else if (data.postId) {
    targetUrl = `/feed?postId=${encodeURIComponent(data.postId)}`;
  }

  event.waitUntil(clients.openWindow(targetUrl));
});