import { QueryClient, dehydrate, hydrate, type DehydratedState } from "@tanstack/react-query";

const STORAGE_KEY = "app-query-cache-v1";
const MAX_AGE = 24 * 60 * 60_000;
const PERSISTED = new Set([
  "config",
  "service-status",
  "jadwal",
  "libur",
  "libur-nasional",
  "tones",
  "log",
  "volume",
  "equalizer",
]);

interface PersistedCache {
  ts: number;
  state: DehydratedState;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: MAX_AGE,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

function isPersistedCache(value: unknown): value is PersistedCache {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<PersistedCache>;
  return typeof candidate.ts === "number" && typeof candidate.state === "object";
}

function removeStored() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    return;
  }
}

function restore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved: unknown = JSON.parse(raw);
    if (!isPersistedCache(saved) || Date.now() - saved.ts > MAX_AGE) {
      removeStored();
      return;
    }
    hydrate(queryClient, saved.state);
  } catch {
    removeStored();
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;

function schedulePersist() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      const state = dehydrate(queryClient, {
        shouldDehydrateQuery: (q) =>
          q.state.status === "success" && PERSISTED.has(String(q.queryKey[0])),
      });
      const payload: PersistedCache = { ts: Date.now(), state };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      return;
    }
  }, 1000);
}

export function clearPersistedCache() {
  if (timer) clearTimeout(timer);
  removeStored();
  queryClient.clear();
}

if (typeof window !== "undefined") {
  restore();
  queryClient.getQueryCache().subscribe(schedulePersist);
}
