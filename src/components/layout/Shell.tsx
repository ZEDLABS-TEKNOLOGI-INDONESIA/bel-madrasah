import React, { useEffect, useState } from "react";
import { initTheme } from "../../lib/theme";
import { Footer } from "./Footer";
import { InstallPrompt } from "./InstallPrompt";
import { BottomNav, Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

declare const __FOOTER_CONFIG__: {
  schoolName: string;
  schoolYear: string;
  poweredBy: string;
  poweredByUrl: string;
  instagramUrl: string;
  youtubeUrl: string;
  uploadUrl: string;
  githubUrl: string;
  developerName: string;
  developerUrl: string;
  developerInstagramUrl: string;
  developerLinkedinUrl: string;
};

export function Shell({ children }: { children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(() => {
    if (typeof localStorage === "undefined") return true;
    const stored = localStorage.getItem("sidebar-expanded");
    return stored === null ? true : stored === "true";
  });

  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 768px)").matches;
  });

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

  const footerCfg =
    typeof __FOOTER_CONFIG__ !== "undefined"
      ? __FOOTER_CONFIG__
      : {
          schoolName: "Bel Madrasah",
          schoolYear: new Date().getFullYear().toString(),
          poweredBy: "",
          poweredByUrl: "#",
          instagramUrl: "",
          youtubeUrl: "",
          uploadUrl: "",
          githubUrl: "",
          developerName: "",
          developerUrl: "",
          developerInstagramUrl: "",
          developerLinkedinUrl: "",
        };

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
            overflowX: "hidden",
            WebkitOverflowScrolling: "touch" as any,
          }}
        >
          {children}
        </main>
        {!isMobile && (
          <Footer
            schoolName={footerCfg.schoolName}
            schoolYear={footerCfg.schoolYear}
            poweredBy={footerCfg.poweredBy}
            poweredByUrl={footerCfg.poweredByUrl}
          />
        )}
      </div>
      {isMobile && <BottomNav />}
      <InstallPrompt />
    </div>
  );
}
