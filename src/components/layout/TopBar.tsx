import React, { useEffect, useState } from "react";
import { Sun, Moon, Menu } from "lucide-react";
import { getTheme, toggleTheme } from "../../lib/theme";

interface TopBarProps {
  onMenuToggle: () => void;
  isMobile: boolean;
}

export function TopBar({ onMenuToggle, isMobile }: TopBarProps) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [title, setTitle] = useState("Dashboard");

  useEffect(() => {
    setTheme(getTheme());
    const path = window.location.pathname;
    const map: Record<string, string> = {
      "/": "Dashboard",
      "/jadwal": "Jadwal",
      "/audio": "Audio",
      "/libur": "Hari Libur",
      "/log": "Log Aktivitas",
      "/settings": "Pengaturan",
    };
    setTitle(map[path] ?? "Bel Madrasah");
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
          <button
            onClick={onMenuToggle}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              display: "flex",
              padding: 4,
            }}
          >
            <Menu size={20} />
          </button>
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
