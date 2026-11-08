import { clearPersistedCache } from "./queryClient";

export function logout() {
  if (typeof window === "undefined") return;
  if (!window.confirm("Keluar dari panel?")) return;
  clearPersistedCache();
  window.location.href = "/logout";
}
