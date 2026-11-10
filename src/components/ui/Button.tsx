import type { ButtonHTMLAttributes, ReactNode } from "react";
import { buttonStyle, type ButtonSize, type ButtonVariant } from "./buttonStyle";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

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
        ...buttonStyle(variant, size),
        cursor: blocked ? "not-allowed" : "pointer",
        opacity: props.disabled ? 0.5 : 1,
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
