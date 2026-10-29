const CACHE_NAME = "studyverse-shell-v1";
const APP_SHELL = ["/", "/offline.html"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then(response => {
      const copy = response.clone();
      void caches.open(CACHE_NAME).then(cache => cache.put("/", copy));
      return response;
    }).catch(() => caches.match("/").then(response => response || caches.match("/offline.html"))));
    return;
  }
  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
    if (response.ok && (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/manus-storage/"))) {
      const copy = response.clone();
      void caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
    }
    return response;
  })));
});

self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: "StudyVerse", body: event.data?.text() || "" }; }
  const title = data.title || "StudyVerse";
  const options = { body: data.body || "今日の単語を確認しましょう。", icon: "/favicon.ico", badge: "/favicon.ico", tag: data.tag || "studyverse-smart-notification", renotify: true, data, actions: [{ action: "show-answer", title: "答えを見る" }] };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  const data = event.notification.data || {};
  event.notification.close();
  if (event.action === "show-answer") {
    event.waitUntil(self.registration.showNotification("答え", { body: data.answer || "答えを確認できませんでした。", tag: `${data.tag || "smart"}-answer`, data }));
    return;
  }
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    const url = new URL("/", self.location.origin);
    url.searchParams.set("smartAnswer", data.answer || "");
    for (const client of list) if ("focus" in client) return client.focus();
    return clients.openWindow(url.toString());
  }));
});
