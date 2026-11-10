import type { CSSProperties } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const variantStyle: Record<ButtonVariant, CSSProperties> = {
  primary: { background: "var(--accent)", color: "#fff", border: "1px solid transparent" },
  secondary: {
    background: "var(--bg-tertiary)",
    color: "var(--text)",
    border: "1px solid var(--border)",
  },
  danger: {
    background: "var(--danger-soft)",
    color: "var(--danger)",
    border: "1px solid var(--danger-border)",
  },
  ghost: { background: "transparent", color: "var(--text-muted)", border: "1px solid transparent" },
};

const sizeStyle: Record<ButtonSize, CSSProperties> = {
  sm: { padding: "0 10px", fontSize: 12, height: 28 },
  md: { padding: "0 14px", fontSize: 13, height: 34 },
  lg: { padding: "0 20px", fontSize: 14, height: 42 },
};

export function buttonStyle(variant: ButtonVariant, size: ButtonSize): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: "var(--radius)",
    fontFamily: "var(--font)",
    fontWeight: 500,
    whiteSpace: "nowrap",
    textDecoration: "none",
    ...variantStyle[variant],
    ...sizeStyle[size],
  };
}
