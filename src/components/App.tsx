import { QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Toaster } from "react-hot-toast";
import { queryClient } from "../lib/queryClient";
import { initRouter } from "../lib/router";
import { PATH_TO_KEY, type PageKey } from "../lib/routes";
import { Shell } from "./layout/Shell";
import { ConfirmHost } from "./ui/ConfirmHost";

const DashboardPage = lazy(() =>
  import("./dashboard/DashboardPage").then((m) => ({ default: m.DashboardPage })),
);
const JadwalPage = lazy(() =>
  import("./jadwal/JadwalPage").then((m) => ({ default: m.JadwalPage })),
);
const AudioPage = lazy(() => import("./audio/AudioPage").then((m) => ({ default: m.AudioPage })));
const LiburPage = lazy(() => import("./libur/LiburPage").then((m) => ({ default: m.LiburPage })));
const LogPage = lazy(() => import("./log/LogPage").then((m) => ({ default: m.LogPage })));
const PengaturanPage = lazy(() =>
  import("./pengaturan/PengaturanPage").then((m) => ({ default: m.PengaturanPage })),
);

const PAGES: Record<PageKey, ReactNode> = {
  dashboard: <DashboardPage />,
  jadwal: <JadwalPage />,
  audio: <AudioPage />,
  libur: <LiburPage />,
  log: <LogPage />,
  settings: <PengaturanPage />,
};

export default function App({ page: initialPage }: { page: PageKey }) {
  const [page, setPage] = useState<PageKey>(initialPage);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      if (import.meta.env.PROD) {
        navigator.serviceWorker.register("/sw.js").catch(() => undefined);
      } else {
        navigator.serviceWorker.getRegistrations().then((regs) => {
          regs.forEach((reg) => reg.unregister());
        });
      }
    }

    const stopRouter = initRouter();
    const onNavigate = (e: Event) => {
      const path = (e as CustomEvent<{ path: string }>).detail.path;
      const next = PATH_TO_KEY[path];
      if (next) setPage(next);
    };
    window.addEventListener("spa-navigate", onNavigate);

    return () => {
      stopRouter();
      window.removeEventListener("spa-navigate", onNavigate);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Shell>
        <Suspense
          fallback={
            <div style={{ padding: 24, color: "var(--text-muted)", fontSize: 13 }}>Memuat...</div>
          }
        >
          {PAGES[page]}
        </Suspense>
      </Shell>
      <ConfirmHost />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            fontFamily: "var(--font)",
            fontSize: 13,
            background: "var(--card-bg)",
            color: "var(--text)",
            border: "1px solid var(--border)",
          },
        }}
      />
    </QueryClientProvider>
  );
}
