const CACHE_NAME = "afterhours-offline-v1";
const OFFLINE_PAGE = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_PAGE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("afterhours-offline-") && key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.mode !== "navigate") return;
  event.respondWith(fetch(request).catch(async () => (await caches.match(OFFLINE_PAGE)) || Response.error()));
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  if (!payload || typeof payload !== "object") payload = {};

  const title = typeof payload.title === "string" ? payload.title : "Afterhours";
  const options = {
    body: typeof payload.body === "string" ? payload.body : "A shared roll is ready to open.",
    icon: "/icons/afterhours-192.png",
    badge: "/icons/afterhours-192.png",
    tag: typeof payload.tag === "string" ? payload.tag : undefined,
    data: { url: typeof payload.url === "string" ? payload.url : "/dashboard" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/dashboard", self.location.origin);
  if (url.origin !== self.location.origin) return;

  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
    const existing = clients.find((client) => "focus" in client);
    if (existing) {
      await existing.navigate(url.href);
      return existing.focus();
    }
    return self.clients.openWindow(url.href);
  }));
});
