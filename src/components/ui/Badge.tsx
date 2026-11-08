import React from "react";

type BadgeVariant = "default" | "success" | "danger" | "warning" | "accent";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
}

const variantStyle: Record<BadgeVariant, React.CSSProperties> = {
  default: { background: "var(--bg-tertiary)", color: "var(--text-muted)" },
  success: { background: "var(--success-soft)", color: "var(--success)" },
  danger: { background: "var(--danger-soft)", color: "var(--danger)" },
  warning: { background: "var(--warning-soft)", color: "var(--warning)" },
  accent: { background: "var(--accent-soft)", color: "var(--accent)" },
};

export function Badge({ children, variant = "default", dot }: BadgeProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "2px 10px",
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 500,
        whiteSpace: "nowrap",
        ...variantStyle[variant],
      }}
    >
      {dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "currentColor",
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
}
