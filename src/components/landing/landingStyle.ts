import type { CSSProperties } from "react";
import { BAR_H } from "../../lib/layout";

export const container: CSSProperties = {
  maxWidth: 1120,
  margin: "0 auto",
  padding: "0 16px",
};

export const section: CSSProperties = {
  ...container,
  padding: "56px 16px",
  scrollMarginTop: BAR_H,
};

export const band: CSSProperties = {
  background: "var(--panel)",
  borderTop: "1px solid var(--border)",
  borderBottom: "1px solid var(--border)",
};

export const eyebrow: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: 1.2,
  textTransform: "uppercase",
  color: "var(--accent)",
};

const linkBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "var(--radius)",
  fontFamily: "var(--font)",
  fontWeight: 500,
  textDecoration: "none",
  whiteSpace: "nowrap",
};

export const primaryLink: CSSProperties = {
  ...linkBase,
  height: 42,
  padding: "0 20px",
  fontSize: 14,
  background: "var(--accent)",
  color: "#fff",
  border: "1px solid transparent",
};

export const secondaryLink: CSSProperties = {
  ...linkBase,
  height: 42,
  padding: "0 20px",
  fontSize: 14,
  background: "var(--bg-tertiary)",
  color: "var(--text)",
  border: "1px solid var(--border)",
};

export const navLink: CSSProperties = {
  ...linkBase,
  height: 28,
  padding: "0 12px",
  fontSize: 12,
  background: "var(--accent)",
  color: "#fff",
  border: "1px solid transparent",
};
