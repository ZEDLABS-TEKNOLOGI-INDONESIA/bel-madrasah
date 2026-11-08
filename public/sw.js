const PAGES = "app-pages-v2";
const ASSETS = "app-assets-v2";
const SHELL_CACHE = "app-shell-v2";
const KEEP = [PAGES, ASSETS, SHELL_CACHE];
const SHELL = ["/icon.svg", "/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png"];
const SKIP = ["/api/", "/login", "/logout", "/healthz", "/sw.js"];
const MAX_ASSETS = 100;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

async function trim(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length > max) {
    await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) {
    await cache.put(request, res.clone());
    trim(ASSETS, MAX_ASSETS);
  }
  return res;
}

async function staleWhileRevalidate(request, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(request);
  const update = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);
  return hit || (await update) || Response.error();
}

async function networkFirst(request) {
  const cache = await caches.open(PAGES);
  try {
    const res = await fetch(request);
    if (res.ok && !res.redirected) cache.put(request, res.clone());
    return res;
  } catch {
    const hit = await cache.match(request, { ignoreSearch: true });
    return hit || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (SKIP.some((p) => url.pathname.startsWith(p))) return;

  if (url.pathname.startsWith("/_astro/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (SHELL.includes(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
    return;
  }

  const accept = request.headers.get("accept") || "";
  if (request.mode === "navigate" || accept.includes("text/html")) {
    event.respondWith(networkFirst(request));
  }
});
