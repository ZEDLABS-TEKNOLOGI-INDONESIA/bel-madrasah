const pageCache = new Map<string, string>();

const PAGE_MAP: Record<string, string> = {
  "/": "dashboard",
  "/jadwal": "jadwal",
  "/audio": "audio",
  "/libur": "libur",
  "/log": "log",
  "/settings": "settings",
};

async function fetchPage(url: string): Promise<string | null> {
  if (pageCache.has(url)) return pageCache.get(url)!;
  try {
    const res = await fetch(url, { credentials: "include" });
    if (res.status === 401) {
      window.location.href = "/login";
      return null;
    }
    if (!res.ok) return null;
    const html = await res.text();
    pageCache.set(url, html);
    return html;
  } catch {
    return null;
  }
}

function extractTitle(html: string): string {
  const match = html.match(/<title>([^<]*)<\/title>/i);
  return match ? match[1] : "Bel Madrasah";
}

let isNavigating = false;

async function navigate(path: string, pushState = true) {
  if (isNavigating || window.location.pathname === path) return;
  isNavigating = true;
  try {
    const html = await fetchPage(path);
    if (!html) {
      window.location.href = path;
      return;
    }
    if (pushState) {
      window.history.pushState({}, "", path);
    }
    document.title = extractTitle(html);
    window.dispatchEvent(new CustomEvent("spa-navigate", { detail: { path } }));
    requestAnimationFrame(() => attachListeners());
  } finally {
    isNavigating = false;
  }
}

function prefetch(path: string) {
  if (!pageCache.has(path) && PAGE_MAP[path]) {
    fetchPage(path);
  }
}

export function attachListeners() {
  document.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((a) => {
    const href = a.getAttribute("href") ?? "";
    if (!PAGE_MAP[href]) return;
    if (a.dataset.spa === "1") return;
    a.dataset.spa = "1";
    a.addEventListener("mouseenter", () => prefetch(href), { once: true });
    a.addEventListener("touchstart", () => prefetch(href), { once: true, passive: true });
    a.addEventListener("click", (e) => {
      e.preventDefault();
      navigate(href);
    });
  });
}

export function initRouter() {
  window.addEventListener("popstate", () => {
    navigate(window.location.pathname, false);
  });

  window.addEventListener("spa-do-navigate", (e: Event) => {
    const path = (e as CustomEvent<{ path: string }>).detail.path;
    navigate(path);
  });

  if ("requestIdleCallback" in window) {
    requestIdleCallback(() => Object.keys(PAGE_MAP).forEach(prefetch));
  } else {
    setTimeout(() => Object.keys(PAGE_MAP).forEach(prefetch), 500);
  }

  attachListeners();
}
