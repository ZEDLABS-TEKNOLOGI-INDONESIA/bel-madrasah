export function go(path: string) {
  if (typeof window === "undefined") return;
  if (window.location.pathname === path) return;
  window.dispatchEvent(new CustomEvent("spa-do-navigate", { detail: { path } }));
}
