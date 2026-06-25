import { Moon, Music2, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { getTheme, toggleTheme } from "../../lib/theme";

const PATH_TITLE: Record<string, string> = {
  "/": "Dashboard",
  "/jadwal": "Jadwal",
  "/audio": "Audio",
  "/libur": "Hari Libur",
  "/log": "Log Aktivitas",
  "/settings": "Pengaturan",
};

interface TopBarProps {
  isMobile: boolean;
}

export function TopBar({ isMobile }: TopBarProps) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [title, setTitle] = useState(() => {
    if (typeof window === "undefined") return "Dashboard";
    return PATH_TITLE[window.location.pathname] ?? "Bel Madrasah";
  });

  useEffect(() => {
    setTheme(getTheme());
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const path = (e as CustomEvent<{ path: string }>).detail.path;
      setTitle(PATH_TITLE[path] ?? "Bel Madrasah");
    };
    window.addEventListener("spa-navigate", handler);
    return () => window.removeEventListener("spa-navigate", handler);
  }, []);

  function handleToggle() {
    toggleTheme();
    setTheme(getTheme());
  }

  return (
    <div
      style={{
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        borderBottom: "1px solid var(--border)",
        background: "var(--card-gloss), var(--card-bg)",
        backdropFilter: "var(--glass-blur)",
        WebkitBackdropFilter: "var(--glass-blur)",
        position: "sticky",
        top: 0,
        zIndex: 50,
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {isMobile && (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Music2 size={16} color="#fff" />
          </div>
        )}
        <span style={{ fontWeight: 600, fontSize: 15 }}>{title}</span>
      </div>

      <button
        onClick={handleToggle}
        style={{
          background: "var(--bg-tertiary)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          cursor: "pointer",
          color: "var(--text-muted)",
          display: "flex",
          alignItems: "center",
          padding: "6px 8px",
        }}
      >
        {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
      </button>
    </div>
  );
}
