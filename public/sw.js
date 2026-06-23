const CACHE = "bel-v1";
const STATIC = ["/", "/login", "/jadwal", "/audio", "/libur", "/log", "/settings"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(STATIC)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(
      fetch(e.request).catch(
        () =>
          new Response('{"error":"offline"}', { headers: { "Content-Type": "application/json" } })
      )
    );
    return;
  }
  e.respondWith(caches.match(e.request).then((cached) => cached ?? fetch(e.request)));
});
