import { ChevronLeft, LogOut, type LucideIcon } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { APP } from "../../lib/app.config";
import { logout } from "../../lib/auth";
import { BAR_H, FOOT_H, SIDEBAR_W, SIDEBAR_W_COLLAPSED } from "../../lib/layout";
import { prefetch } from "../../lib/router";
import { ROUTES } from "../../lib/routes";

type NavItem = { label: string; short: string; href: string; Icon: LucideIcon };

const ITEMS: NavItem[] = ROUTES.map((r) => ({
  label: r.label,
  short: r.short ?? r.label,
  href: r.path,
  Icon: r.icon,
}));

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
  const { label, href, Icon } = props.item;
  const on = isActive(href, props.cur);
  return (
    <a
      href={href}
      title={label}
      aria-label={props.expanded ? undefined : label}
      aria-current={on ? "page" : undefined}
      className={on ? undefined : "row-hover"}
      onMouseEnter={() => prefetch(href)}
      onClick={(e) => {
        e.preventDefault();
        spaGo(href);
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "9px 20px",
        borderLeft: `3px solid ${on ? "var(--accent)" : "transparent"}`,
        color: on ? "var(--text)" : "var(--text-muted)",
        background: on ? "var(--accent-soft)" : "transparent",
        textDecoration: "none",
        fontWeight: on ? 600 : 400,
        fontSize: 13,
        whiteSpace: "nowrap",
        overflow: "hidden",
      }}
    >
      <Icon size={18} style={{ flexShrink: 0, color: on ? "var(--accent)" : "currentColor" }} />
      {props.expanded && <span>{label}</span>}
    </a>
  );
}

function BottomLink(props: { item: NavItem; cur: string }) {
  const { label, short, href, Icon } = props.item;
  const on = isActive(href, props.cur);
  return (
    <a
      href={href}
      aria-label={label}
      aria-current={on ? "page" : undefined}
      onTouchStart={() => prefetch(href)}
      onClick={(e) => {
        e.preventDefault();
        spaGo(href);
      }}
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "8px 2px",
        gap: 3,
        textDecoration: "none",
        color: on ? "var(--accent)" : "var(--text-muted)",
        borderTop: `2px solid ${on ? "var(--accent)" : "transparent"}`,
        fontSize: 10,
        fontWeight: on ? 600 : 400,
      }}
    >
      <Icon size={20} aria-hidden="true" />
      <span
        style={{
          maxWidth: "100%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {short}
      </span>
    </a>
  );
}

const footButton: CSSProperties = {
  width: "100%",
  height: FOOT_H,
  boxSizing: "border-box",
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "0 24px",
  background: "none",
  border: "none",
  borderTop: "1px solid var(--border)",
  cursor: "pointer",
  color: "var(--text-muted)",
  fontFamily: "var(--font)",
  fontSize: 13,
  whiteSpace: "nowrap",
  overflow: "hidden",
};

export function Sidebar(props: { expanded: boolean; onToggle: () => void }) {
  const cur = useCurrentPath();
  const { expanded } = props;
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 100,
        width: expanded ? SIDEBAR_W : SIDEBAR_W_COLLAPSED,
        background: "var(--panel)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        transition: "width 0.25s",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: BAR_H,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 18px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        <img
          src={APP.logo}
          alt={APP.name}
          width={28}
          height={28}
          style={{ flexShrink: 0, display: "block" }}
        />
        {expanded && (
          <span
            style={{
              fontWeight: 700,
              fontSize: 14,
              whiteSpace: "nowrap",
              color: "var(--text)",
            }}
          >
            {APP.name}
          </span>
        )}
      </div>

      <nav style={{ flex: 1, padding: "8px 0", display: "flex", flexDirection: "column", gap: 2 }}>
        {ITEMS.map((item) => (
          <SidebarLink key={item.href} item={item} cur={cur} expanded={expanded} />
        ))}
      </nav>

      <button
        onClick={logout}
        className="row-hover"
        title="Keluar"
        aria-label="Keluar"
        style={footButton}
      >
        <LogOut size={16} style={{ flexShrink: 0 }} />
        {expanded && <span>Keluar</span>}
      </button>

      <button
        onClick={props.onToggle}
        className="row-hover"
        title={expanded ? "Ciutkan" : "Perluas"}
        aria-label={expanded ? "Ciutkan sidebar" : "Perluas sidebar"}
        aria-expanded={expanded}
        style={footButton}
      >
        <ChevronLeft
          size={16}
          style={{
            flexShrink: 0,
            transform: expanded ? "none" : "rotate(180deg)",
            transition: "transform 0.25s",
          }}
        />
        {expanded && <span>Ciutkan</span>}
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
        background: "var(--panel)",
        borderTop: "1px solid var(--border)",
        display: "flex",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {ITEMS.map((item) => (
        <BottomLink key={item.href} item={item} cur={cur} />
      ))}
    </div>
  );
}
