import type { AnchorHTMLAttributes, ReactNode } from "react";
import { buttonStyle, type ButtonSize, type ButtonVariant } from "./buttonStyle";

interface LinkButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
}

export function LinkButton({
  variant = "secondary",
  size = "md",
  icon,
  children,
  style,
  className,
  ...props
}: LinkButtonProps) {
  return (
    <a
      {...props}
      className={["btn", className].filter(Boolean).join(" ")}
      style={{ ...buttonStyle(variant, size), ...style }}
    >
      {icon}
      {children}
    </a>
  );
}
