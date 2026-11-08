import { LogOut, Moon, Sun, Upload } from "lucide-react";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { APP } from "../../lib/app.config";
import { logout } from "../../lib/auth";
import { FOOTER } from "../../lib/footer";
import { BAR_H } from "../../lib/layout";
import { titleOf } from "../../lib/routes";
import { getTheme, toggleTheme } from "../../lib/theme";
import { GithubIcon, InstagramIcon, LinkedinIcon, YoutubeIcon } from "./SocialIcons";

interface IconLinkProps {
  href: string;
  title: string;
  children: ReactNode;
}

function IconLink({ href, title, children }: IconLinkProps) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={title}
      aria-label={title}
      className="row-hover"
      style={{
        color: "var(--text-muted)",
        display: "flex",
        alignItems: "center",
        padding: 7,
        borderRadius: "var(--radius)",
      }}
    >
      {children}
    </a>
  );
}

function Divider() {
  return <div style={{ width: 1, height: 18, background: "var(--border)", margin: "0 8px" }} />;
}

const squareButton: CSSProperties = {
  background: "var(--bg-tertiary)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  cursor: "pointer",
  color: "var(--text-muted)",
  display: "flex",
  alignItems: "center",
  padding: "6px 8px",
  marginLeft: 4,
};

interface TopBarProps {
  isMobile: boolean;
  status?: ReactNode;
}

export function TopBar({ isMobile, status }: TopBarProps) {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [title, setTitle] = useState(() => {
    if (typeof window === "undefined") return titleOf("/");
    return titleOf(window.location.pathname);
  });

  useEffect(() => {
    setTheme(getTheme());
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const path = (e as CustomEvent<{ path: string }>).detail.path;
      setTitle(titleOf(path));
    };
    window.addEventListener("spa-navigate", handler);
    return () => window.removeEventListener("spa-navigate", handler);
  }, []);

  function handleToggle() {
    toggleTheme();
    setTheme(getTheme());
  }

  const developerSuffix = FOOTER.developerName ? ` - ${FOOTER.developerName}` : "";

  return (
    <div
      style={{
        height: BAR_H,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: isMobile ? "0 12px" : "0 24px",
        borderBottom: "1px solid var(--border)",
        background: "var(--panel)",
        position: "sticky",
        top: 0,
        zIndex: 50,
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        {isMobile && (
          <img
            src={APP.logo}
            alt={APP.name}
            width={28}
            height={28}
            style={{ flexShrink: 0, display: "block" }}
          />
        )}
        {!isMobile && (
          <>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{APP.name}</span>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>/</span>
          </>
        )}
        <span
          style={{
            fontWeight: 600,
            fontSize: 14,
            color: "var(--text)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {status}
        {!isMobile && (
          <>
            <Divider />
            <IconLink href={FOOTER.instagramUrl} title="Instagram">
              <InstagramIcon />
            </IconLink>
            <IconLink href={FOOTER.youtubeUrl} title="YouTube">
              <YoutubeIcon />
            </IconLink>
            <IconLink href={FOOTER.uploadUrl} title="Upload Dokumentasi">
              <Upload size={16} />
            </IconLink>
            <IconLink href={FOOTER.githubUrl} title={`GitHub${developerSuffix}`}>
              <GithubIcon />
            </IconLink>
            <IconLink href={FOOTER.developerLinkedinUrl} title={`LinkedIn${developerSuffix}`}>
              <LinkedinIcon />
            </IconLink>
            <Divider />
          </>
        )}
        <button
          onClick={handleToggle}
          className="btn"
          title={theme === "dark" ? "Tema terang" : "Tema gelap"}
          aria-label={theme === "dark" ? "Tema terang" : "Tema gelap"}
          style={squareButton}
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        {isMobile && (
          <button
            onClick={logout}
            className="btn"
            title="Keluar"
            aria-label="Keluar"
            style={squareButton}
          >
            <LogOut size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
