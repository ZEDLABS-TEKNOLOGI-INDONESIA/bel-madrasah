import { QueryClientProvider } from "@tanstack/react-query";
import React, { lazy, Suspense, useEffect, useState } from "react";
import { Toaster } from "react-hot-toast";
import { queryClient } from "../lib/queryClient";
import { attachListeners, initRouter } from "../lib/router";
import { Shell } from "./layout/Shell";

const DashboardPage = lazy(() =>
  import("./dashboard/DashboardPage").then((m) => ({ default: m.DashboardPage }))
);
const JadwalPage = lazy(() =>
  import("./jadwal/JadwalPage").then((m) => ({ default: m.JadwalPage }))
);
const AudioPage = lazy(() => import("./audio/AudioPage").then((m) => ({ default: m.AudioPage })));
const LiburPage = lazy(() => import("./libur/LiburPage").then((m) => ({ default: m.LiburPage })));
const LogPage = lazy(() => import("./log/LogPage").then((m) => ({ default: m.LogPage })));
const PengaturanPage = lazy(() =>
  import("./pengaturan/PengaturanPage").then((m) => ({ default: m.PengaturanPage }))
);

type Page = "dashboard" | "jadwal" | "audio" | "libur" | "log" | "settings";

const PATH_TO_PAGE: Record<string, Page> = {
  "/": "dashboard",
  "/jadwal": "jadwal",
  "/audio": "audio",
  "/libur": "libur",
  "/log": "log",
  "/settings": "settings",
};

const PAGE_MAP: Record<Page, React.ReactNode> = {
  dashboard: <DashboardPage />,
  jadwal: <JadwalPage />,
  audio: <AudioPage />,
  libur: <LiburPage />,
  log: <LogPage />,
  settings: <PengaturanPage />,
};

export default function App({ page: initialPage }: { page: Page }) {
  const [page, setPage] = useState<Page>(initialPage);

  useEffect(() => {
    if (import.meta.env.PROD && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js");
    } else if (import.meta.env.DEV && "serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister());
      });
    }

    initRouter();

    const handler = (e: Event) => {
      const path = (e as CustomEvent<{ path: string }>).detail.path;
      const nextPage = PATH_TO_PAGE[path];
      if (nextPage) setPage(nextPage);
    };
    window.addEventListener("spa-navigate", handler);
    return () => window.removeEventListener("spa-navigate", handler);
  }, []);

  useEffect(() => {
    attachListeners();
  });

  return (
    <QueryClientProvider client={queryClient}>
      <Shell>
        <Suspense
          fallback={
            <div style={{ padding: 24, color: "var(--text-muted)", fontSize: 13 }}>Memuat...</div>
          }
        >
          {PAGE_MAP[page]}
        </Suspense>
      </Shell>
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
