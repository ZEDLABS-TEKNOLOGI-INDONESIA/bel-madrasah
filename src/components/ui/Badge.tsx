import React from "react";

type BadgeVariant = "default" | "success" | "danger" | "warning" | "accent";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
}

const variantStyle: Record<BadgeVariant, React.CSSProperties> = {
  default: { background: "var(--bg-tertiary)", color: "var(--text-muted)" },
  success: { background: "rgba(26,127,55,0.12)", color: "var(--success)" },
  danger: { background: "rgba(207,34,46,0.12)", color: "var(--danger)" },
  warning: { background: "rgba(154,103,0,0.12)", color: "var(--warning)" },
  accent: { background: "rgba(9,105,218,0.12)", color: "var(--accent)" },
};

export function Badge({ children, variant = "default", dot }: BadgeProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "2px 8px",
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 500,
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
