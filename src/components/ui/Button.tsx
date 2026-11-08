import React from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
}

const variantStyle: Record<Variant, React.CSSProperties> = {
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

const sizeStyle: Record<Size, React.CSSProperties> = {
  sm: { padding: "0 10px", fontSize: 12, height: 28 },
  md: { padding: "0 14px", fontSize: 13, height: 34 },
  lg: { padding: "0 20px", fontSize: 14, height: 42 },
};

export function Button({
  variant = "secondary",
  size = "md",
  loading,
  icon,
  children,
  style,
  className,
  ...props
}: ButtonProps) {
  const blocked = loading || props.disabled;
  return (
    <button
      {...props}
      className={["btn", className].filter(Boolean).join(" ")}
      disabled={blocked}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        borderRadius: "var(--radius)",
        fontFamily: "var(--font)",
        fontWeight: 500,
        cursor: blocked ? "not-allowed" : "pointer",
        opacity: props.disabled ? 0.5 : 1,
        whiteSpace: "nowrap",
        ...variantStyle[variant],
        ...sizeStyle[size],
        ...style,
      }}
    >
      {loading ? (
        <span
          style={{
            width: 14,
            height: 14,
            border: "2px solid currentColor",
            borderTopColor: "transparent",
            borderRadius: "50%",
            display: "inline-block",
            animation: "spin 0.6s linear infinite",
            flexShrink: 0,
          }}
        />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}
