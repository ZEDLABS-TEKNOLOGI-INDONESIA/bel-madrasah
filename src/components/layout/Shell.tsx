import React, { useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { BottomNav } from "./Sidebar";
import { InstallPrompt } from "./InstallPrompt";
import { initTheme } from "../../lib/theme";

export function Shell({ children }: { children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    initTheme();
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      {!isMobile && <Sidebar expanded={expanded} onToggle={() => setExpanded((v) => !v)} />}
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
        <TopBar onMenuToggle={() => setExpanded((v) => !v)} isMobile={isMobile} />
        <main
          style={{
            flex: 1,
            padding: isMobile ? "12px 12px 80px" : "20px 24px",
            overflowY: "auto",
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
