import { useEffect, useState, type ReactNode } from "react";
import { SIDEBAR_W, SIDEBAR_W_COLLAPSED } from "../../lib/layout";
import { initTheme } from "../../lib/theme";
import { Footer } from "./Footer";
import { InstallPrompt } from "./InstallPrompt";
import { BottomNav, Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

interface FooterConfig {
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
}

declare const __FOOTER_CONFIG__: FooterConfig;

const SIDEBAR_KEY = "sidebar-expanded";
const MOBILE_QUERY = "(max-width: 768px)";

const DEFAULT_FOOTER: FooterConfig = {
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

function readExpanded(): boolean {
  try {
    const stored = localStorage.getItem(SIDEBAR_KEY);
    return stored === null ? true : stored === "true";
  } catch {
    return true;
  }
}

function writeExpanded(value: boolean) {
  try {
    localStorage.setItem(SIDEBAR_KEY, String(value));
  } catch {
    return;
  }
}

export function Shell({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(() =>
    typeof localStorage === "undefined" ? true : readExpanded(),
  );

  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(MOBILE_QUERY).matches;
  });

  useEffect(() => {
    initTheme();
    const mq = window.matchMedia(MOBILE_QUERY);
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  function handleToggle() {
    const next = !expanded;
    setExpanded(next);
    writeExpanded(next);
  }

  const footerCfg = typeof __FOOTER_CONFIG__ !== "undefined" ? __FOOTER_CONFIG__ : DEFAULT_FOOTER;

  return (
    <div style={{ display: "flex", height: "100dvh", overflow: "hidden", background: "var(--bg)" }}>
      {!isMobile && <Sidebar expanded={expanded} onToggle={handleToggle} />}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          minHeight: 0,
          marginLeft: isMobile ? 0 : expanded ? SIDEBAR_W : SIDEBAR_W_COLLAPSED,
          transition: "margin-left 0.25s",
        }}
      >
        <TopBar isMobile={isMobile} />
        <main
          style={{
            flex: 1,
            minHeight: 0,
            padding: isMobile ? "16px 12px 88px" : "24px 32px",
            overflowY: "auto",
            overflowX: "hidden",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <div style={{ maxWidth: 1280, margin: "0 auto" }}>{children}</div>
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
