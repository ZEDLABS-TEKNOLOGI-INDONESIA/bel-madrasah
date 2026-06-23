const BASE = import.meta.env.PUBLIC_API_URL ?? "";

let redirectingToLogin = false;

async function request<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const isFormData = body instanceof FormData;
  const res = await fetch(BASE + path, {
    method,
    credentials: "include",
    headers: isFormData ? undefined : body ? { "Content-Type": "application/json" } : undefined,
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    if (!redirectingToLogin && window.location.pathname !== "/login") {
      redirectingToLogin = true;
      window.location.href = "/login";
    }
    return new Promise<T>(() => {});
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Terjadi kesalahan" }));
    throw new Error(err.error ?? "Terjadi kesalahan");
  }
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) return res.json();
  return res as unknown as T;
}

export const api = {
  get: <T = unknown>(path: string) => request<T>("GET", path),
  post: <T = unknown>(path: string, body: unknown) => request<T>("POST", path, body),
  upload: <T = unknown>(path: string, form: FormData) => request<T>("POST", path, form),
};
