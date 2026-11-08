import type { CSSProperties, ReactNode } from "react";

interface ListRowProps {
  children: ReactNode;
  last?: boolean;
  highlighted?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
}

export function ListRow({
  children,
  last = false,
  highlighted = false,
  dimmed = false,
  onClick,
  style,
}: ListRowProps) {
  return (
    <div
      className={highlighted ? undefined : "row-hover"}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 16px",
        borderBottom: last ? "none" : "1px solid var(--border)",
        background: highlighted ? "var(--accent-soft)" : undefined,
        opacity: dimmed ? 0.55 : 1,
        cursor: onClick ? "pointer" : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
