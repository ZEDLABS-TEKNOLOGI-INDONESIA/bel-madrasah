import {
  CalendarDays,
  CalendarOff,
  ChevronRight,
  LayoutDashboard,
  Music2,
  ScrollText,
  Settings2,
} from "lucide-react";
import { useEffect, useState } from "react";

const ITEMS = [
  { label: "Dashboard", href: "/", Icon: LayoutDashboard },
  { label: "Jadwal", href: "/jadwal", Icon: CalendarDays },
  { label: "Audio", href: "/audio", Icon: Music2 },
  { label: "Libur", href: "/libur", Icon: CalendarOff },
  { label: "Log", href: "/log", Icon: ScrollText },
  { label: "Pengaturan", href: "/settings", Icon: Settings2 },
];

function useCurrentPath() {
  const [path, setPath] = useState(typeof window !== "undefined" ? window.location.pathname : "/");
  useEffect(() => {
    const h = (e: Event) => setPath((e as CustomEvent<{ path: string }>).detail.path);
    window.addEventListener("spa-navigate", h);
    return () => window.removeEventListener("spa-navigate", h);
  }, []);
  return path;
}

function active(href: string, cur: string) {
  return href === "/" ? cur === "/" : cur.startsWith(href);
}

export function Sidebar({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const cur = useCurrentPath();
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 100,
        width: expanded ? 220 : 64,
        background: "var(--card-gloss), var(--card-bg)",
        backdropFilter: "var(--glass-blur)",
        WebkitBackdropFilter: "var(--glass-blur)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        transition: "width 0.25s",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: 56,
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: 10,
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            flexShrink: 0,
            background: "var(--accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Music2 size={16} color="#fff" />
        </div>
        <span
          style={{
            fontWeight: 700,
            fontSize: 14,
            whiteSpace: "nowrap",
            color: "var(--text)",
            opacity: expanded ? 1 : 0,
            transition: "opacity 0.2s",
          }}
        >
          Bel Madrasah
        </span>
      </div>
      <nav style={{ flex: 1, padding: "8px 0", display: "flex", flexDirection: "column", gap: 2 }}>
        {ITEMS.map(({ label, href, Icon }) => {
          const isActive = active(href, cur);
          return (
            <a
              key={href}
              href={href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 16px",
                margin: "0 6px",
                borderRadius: "var(--radius)",
                color: isActive ? "var(--accent)" : "var(--text-muted)",
                background: isActive ? "rgba(9,105,218,0.08)" : "transparent",
                textDecoration: "none",
                fontWeight: isActive ? 600 : 400,
                fontSize: 13,
                transition: "background 0.15s, color 0.15s",
                whiteSpace: "nowrap",
                overflow: "hidden",
              }}
            >
              <Icon size={18} style={{ flexShrink: 0 }} />
              <span style={{ opacity: expanded ? 1 : 0, transition: "opacity 0.2s" }}>{label}</span>
            </a>
          );
        })}
      </nav>
      <button
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: expanded ? "flex-end" : "center",
          padding: "12px 16px",
          background: "none",
          border: "none",
          borderTop: "1px solid var(--border)",
          cursor: "pointer",
          color: "var(--text-muted)",
          transition: "justify-content 0.25s",
        }}
      >
        <ChevronRight
          size={16}
          style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.25s" }}
        />
      </button>
    </div>
  );
}

export function BottomNav() {
  const cur = useCurrentPath();
  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: "var(--card-gloss), var(--card-bg)",
        backdropFilter: "var(--glass-blur)",
        WebkitBackdropFilter: "var(--glass-blur)",
        borderTop: "1px solid var(--border)",
        display: "flex",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {ITEMS.map(({ label, href, Icon }) => {
        const isActive = active(href, cur);
        return (
          <a
            key={href}
            href={href}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "8px 0",
              gap: 3,
              textDecoration: "none",
              color: isActive ? "var(--accent)" : "var(--text-muted)",
              fontSize: 10,
              fontWeight: isActive ? 600 : 400,
              transition: "color 0.15s",
            }}
          >
            <Icon size={20} />
            {label}
          </a>
        );
      })}
    </div>
  );
}
