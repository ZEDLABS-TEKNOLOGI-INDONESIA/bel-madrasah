import { APP } from "./app.config";
import { GUEST_PATHS, PATHS } from "./routes";

const TTL = 5 * 60_000;
const known = new Set(PATHS);
const pageCache = new Map<string, { html: string; at: number }>();

function isGuestRedirect(res: Response): boolean {
  return res.redirected && GUEST_PATHS.includes(new URL(res.url).pathname);
}

async function fetchPage(url: string): Promise<string | null> {
  const hit = pageCache.get(url);
  if (hit && Date.now() - hit.at < TTL) return hit.html;
  try {
    const res = await fetch(url, { credentials: "include" });
    if (res.status === 401 || isGuestRedirect(res)) {
      window.location.href = "/login";
      return null;
    }
    if (!res.ok) return null;
    const html = await res.text();
    pageCache.set(url, { html, at: Date.now() });
    return html;
  } catch {
    return null;
  }
}

function extractTitle(html: string): string {
  const match = html.match(/<title>([^<]*)<\/title>/i);
  return match ? match[1] : APP.name;
}

let isNavigating = false;
let pending: { path: string; push: boolean } | null = null;

async function navigate(path: string, push = true) {
  if (isNavigating) {
    pending = { path, push };
    return;
  }
  if (push && window.location.pathname === path) return;
  isNavigating = true;
  try {
    const html = await fetchPage(path);
    if (!html) {
      window.location.href = path;
      return;
    }
    if (push) window.history.pushState({}, "", path);
    document.title = extractTitle(html);
    window.dispatchEvent(new CustomEvent("spa-navigate", { detail: { path } }));
  } finally {
    isNavigating = false;
    if (pending) {
      const next = pending;
      pending = null;
      void navigate(next.path, next.push);
    }
  }
}

export function prefetch(path: string) {
  if (known.has(path)) void fetchPage(path);
}

export function initRouter() {
  const onPop = () => {
    void navigate(window.location.pathname, false);
  };
  const onGo = (e: Event) => {
    void navigate((e as CustomEvent<{ path: string }>).detail.path);
  };

  window.addEventListener("popstate", onPop);
  window.addEventListener("spa-do-navigate", onGo);

  const warm = () => PATHS.forEach(prefetch);
  if ("requestIdleCallback" in window) {
    requestIdleCallback(warm);
  } else {
    setTimeout(warm, 500);
  }

  return () => {
    window.removeEventListener("popstate", onPop);
    window.removeEventListener("spa-do-navigate", onGo);
  };
}
