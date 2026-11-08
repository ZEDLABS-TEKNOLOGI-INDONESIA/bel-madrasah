export function logout() {
  if (typeof window === "undefined") return;
  if (!window.confirm("Keluar dari panel?")) return;
  window.location.href = "/logout";
}
