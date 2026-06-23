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
  danger: { background: "var(--danger)", color: "#fff", border: "1px solid transparent" },
  ghost: { background: "transparent", color: "var(--text-muted)", border: "1px solid transparent" },
};

const sizeStyle: Record<Size, React.CSSProperties> = {
  sm: { padding: "4px 10px", fontSize: "12px", height: "28px" },
  md: { padding: "6px 14px", fontSize: "13px", height: "34px" },
  lg: { padding: "10px 20px", fontSize: "14px", height: "42px" },
};

export function Button({
  variant = "secondary",
  size = "md",
  loading,
  icon,
  children,
  style,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "6px",
        borderRadius: "var(--radius)",
        fontFamily: "var(--font)",
        fontWeight: 500,
        cursor: loading || props.disabled ? "not-allowed" : "pointer",
        opacity: props.disabled ? 0.5 : 1,
        transition: "opacity 0.15s, transform 0.1s, box-shadow 0.15s",
        whiteSpace: "nowrap",
        ...variantStyle[variant],
        ...sizeStyle[size],
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!props.disabled && !loading) {
          (e.currentTarget as HTMLButtonElement).style.opacity = "0.85";
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.opacity = props.disabled ? "0.5" : "1";
      }}
      onMouseDown={(e) => {
        if (!props.disabled && !loading) {
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.97)";
        }
      }}
      onMouseUp={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
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
