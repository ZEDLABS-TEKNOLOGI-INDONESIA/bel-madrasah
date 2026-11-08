import type { CSSProperties, ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
  title?: string;
  action?: ReactNode;
  bodyStyle?: CSSProperties;
}

export function Card({
  children,
  className = "",
  hover = false,
  onClick,
  style,
  title,
  action,
  bodyStyle,
}: CardProps) {
  const hasHeader = Boolean(title || action);
  const cls = [className, hover ? "card-hover" : ""].filter(Boolean).join(" ");

  return (
    <div
      onClick={onClick}
      className={cls || undefined}
      style={{
        background: "var(--card-bg)",
        border: "1px solid var(--card-border)",
        borderRadius: "var(--radius-lg)",
        cursor: onClick ? "pointer" : undefined,
        ...(hasHeader
          ? { display: "flex", flexDirection: "column", overflow: "hidden" }
          : { padding: 16 }),
        ...style,
      }}
    >
      {hasHeader && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            minHeight: 48,
            padding: "8px 16px",
            borderBottom: "1px solid var(--border)",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{title}</span>
          {action}
        </div>
      )}
      {hasHeader ? <div style={{ padding: 16, flex: 1, ...bodyStyle }}>{children}</div> : children}
    </div>
  );
}
