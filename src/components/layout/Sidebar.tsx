import {
  CalendarDays,
  CalendarOff,
  ChevronRight,
  LayoutDashboard,
  Music2,
  ScrollText,
  Settings2,
} from "lucide-react";
import React, { useEffect, useState } from "react";

type NavItem = { label: string; href: string; Icon: React.ElementType };

const ITEMS: NavItem[] = [
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

function isActive(href: string, cur: string) {
  return href === "/" ? cur === "/" : cur.startsWith(href);
}

function spaGo(href: string) {
  if (window.location.pathname === href) return;
  window.dispatchEvent(new CustomEvent("spa-do-navigate", { detail: { path: href } }));
}

function SidebarLink(props: { item: NavItem; cur: string; expanded: boolean }) {
  const label = props.item.label;
  const href = props.item.href;
  const Icon = props.item.Icon;
  const on = isActive(href, props.cur);
  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        spaGo(href);
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 16px",
        margin: "0 6px",
        borderRadius: "var(--radius)",
        color: on ? "var(--accent)" : "var(--text-muted)",
        background: on ? "rgba(9,105,218,0.08)" : "transparent",
        textDecoration: "none",
        fontWeight: on ? 600 : 400,
        fontSize: 13,
        transition: "background 0.15s, color 0.15s",
        whiteSpace: "nowrap",
        overflow: "hidden",
      }}
    >
      <Icon size={18} style={{ flexShrink: 0 }} />
      <span style={{ opacity: props.expanded ? 1 : 0, transition: "opacity 0.2s" }}>{label}</span>
    </a>
  );
}

function BottomLink(props: { item: NavItem; cur: string }) {
  const label = props.item.label;
  const href = props.item.href;
  const Icon = props.item.Icon;
  const on = isActive(href, props.cur);
  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        spaGo(href);
      }}
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "8px 0",
        gap: 3,
        textDecoration: "none",
        color: on ? "var(--accent)" : "var(--text-muted)",
        fontSize: 10,
        fontWeight: on ? 600 : 400,
        transition: "color 0.15s",
      }}
    >
      <Icon size={20} />
      {label}
    </a>
  );
}

export function Sidebar(props: { expanded: boolean; onToggle: () => void }) {
  const cur = useCurrentPath();
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 100,
        width: props.expanded ? 220 : 64,
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
            opacity: props.expanded ? 1 : 0,
            transition: "opacity 0.2s",
          }}
        >
          Bel Madrasah
        </span>
      </div>
      <nav style={{ flex: 1, padding: "8px 0", display: "flex", flexDirection: "column", gap: 2 }}>
        {ITEMS.map((item) => (
          <SidebarLink key={item.href} item={item} cur={cur} expanded={props.expanded} />
        ))}
      </nav>
      <button
        onClick={props.onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: props.expanded ? "flex-end" : "center",
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
          style={{
            transform: props.expanded ? "rotate(180deg)" : "none",
            transition: "transform 0.25s",
          }}
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
        transform: "translateZ(0)",
        willChange: "transform",
      }}
    >
      {ITEMS.map((item) => (
        <BottomLink key={item.href} item={item} cur={cur} />
      ))}
    </div>
  );
}
