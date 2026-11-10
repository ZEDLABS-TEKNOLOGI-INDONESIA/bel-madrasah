import { Moon, Sun } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { useIsMobile } from "../../hooks/useMediaQuery";
import { APP } from "../../lib/app.config";
import { BAR_H } from "../../lib/layout";
import { LANDING, NAV_LINKS } from "../../lib/landing";
import { getTheme, toggleTheme } from "../../lib/theme";
import { LinkButton } from "../ui/LinkButton";
import { container } from "./landingStyle";

const iconButton: CSSProperties = {
  background: "var(--bg-tertiary)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  cursor: "pointer",
  color: "var(--text-muted)",
  display: "flex",
  alignItems: "center",
  padding: "6px 8px",
};

const anchor: CSSProperties = {
  padding: "6px 10px",
  borderRadius: "var(--radius)",
  fontSize: 13,
  color: "var(--text-muted)",
  textDecoration: "none",
};

export function LandingNav() {
  const isMobile = useIsMobile();
  const [theme, setThemeState] = useState<"light" | "dark">("dark");

  useEffect(() => {
    setThemeState(getTheme());
  }, []);

  function handleToggle() {
    toggleTheme();
    setThemeState(getTheme());
  }

  const label = theme === "dark" ? "Tema terang" : "Tema gelap";

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        height: BAR_H,
        boxSizing: "border-box",
        background: "var(--panel)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <nav
        aria-label="Utama"
        style={{
          ...container,
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <a
          href="/landing"
          style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}
        >
          <img src={APP.logo} alt="" width={28} height={28} />
          <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{APP.name}</span>
        </a>

        {!isMobile && (
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="row-hover" style={anchor}>
                {l.label}
              </a>
            ))}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={handleToggle}
            className="btn"
            title={label}
            aria-label={label}
            style={iconButton}
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <LinkButton href="/login" variant="primary" size="sm">
            {LANDING.navCta}
          </LinkButton>
        </div>
      </nav>
    </header>
  );
}
