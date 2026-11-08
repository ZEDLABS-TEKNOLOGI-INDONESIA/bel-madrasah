import { confirmAction } from "./confirm";
import { clearPersistedCache } from "./queryClient";

export async function logout() {
  if (typeof window === "undefined") return;
  const ok = await confirmAction({
    title: "Keluar",
    message: "Keluar dari panel?",
    confirmLabel: "Keluar",
    danger: true,
  });
  if (!ok) return;
  clearPersistedCache();
  window.location.href = "/logout";
}
