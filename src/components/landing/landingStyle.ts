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
