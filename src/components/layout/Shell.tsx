import { useEffect, useState, type ReactNode } from "react";
import { useIsMobile } from "../../hooks/useMediaQuery";
import { FOOTER } from "../../lib/footer";
import { SIDEBAR_W, SIDEBAR_W_COLLAPSED } from "../../lib/layout";
import { initTheme } from "../../lib/theme";
import { Footer } from "./Footer";
import { InstallPrompt } from "./InstallPrompt";
import { BottomNav, Sidebar } from "./Sidebar";
import { StatusPill } from "./StatusPill";
import { TopBar } from "./TopBar";

const SIDEBAR_KEY = "sidebar-expanded";

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
  const isMobile = useIsMobile();
  const [expanded, setExpanded] = useState(() =>
    typeof localStorage === "undefined" ? true : readExpanded(),
  );

  useEffect(() => {
    initTheme();
  }, []);

  function handleToggle() {
    const next = !expanded;
    setExpanded(next);
    writeExpanded(next);
  }

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
        <TopBar isMobile={isMobile} status={<StatusPill />} />
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
            schoolName={FOOTER.schoolName}
            schoolYear={FOOTER.schoolYear}
            poweredBy={FOOTER.poweredBy}
            poweredByUrl={FOOTER.poweredByUrl}
          />
        )}
      </div>
      {isMobile && <BottomNav />}
      <InstallPrompt />
    </div>
  );
}
