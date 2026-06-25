import React, { useEffect, useState } from "react";
import { initTheme } from "../../lib/theme";
import { InstallPrompt } from "./InstallPrompt";
import { BottomNav, Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function Shell({ children }: { children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(() => {
    if (typeof localStorage === "undefined") return true;
    const stored = localStorage.getItem("sidebar-expanded");
    return stored === null ? true : stored === "true";
  });
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    initTheme();
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  function handleToggle() {
    const next = !expanded;
    setExpanded(next);
    localStorage.setItem("sidebar-expanded", String(next));
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      {!isMobile && <Sidebar expanded={expanded} onToggle={handleToggle} />}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          marginLeft: isMobile ? 0 : expanded ? 220 : 64,
          transition: "margin-left 0.25s",
        }}
      >
        <TopBar isMobile={isMobile} />
        <main
          style={{
            flex: 1,
            padding: isMobile ? "12px 12px 80px" : "20px 24px",
            overflowY: "auto",
            WebkitOverflowScrolling: "touch" as any,
          }}
        >
          {children}
        </main>
      </div>
      {isMobile && <BottomNav />}
      <InstallPrompt />
    </div>
  );
}
