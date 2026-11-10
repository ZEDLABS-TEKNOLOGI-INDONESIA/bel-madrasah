import type { ReactNode } from "react";

interface ChipProps {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  count?: number;
  dot?: string;
  disabled?: boolean;
  title?: string;
}

export function Chip({ active, onClick, children, count, dot, disabled, title }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      disabled={disabled}
      title={title}
      className="btn"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        minHeight: 30,
        padding: "0 12px",
        borderRadius: 99,
        border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
        background: active ? "var(--accent-soft)" : "transparent",
        color: active ? "var(--accent)" : "var(--text-muted)",
        fontFamily: "var(--font)",
        fontSize: 12,
        fontWeight: active ? 600 : 500,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        whiteSpace: "nowrap",
      }}
    >
      {dot && (
        <span
          aria-hidden="true"
          style={{ width: 7, height: 7, borderRadius: "50%", background: dot, flexShrink: 0 }}
        />
      )}
      {children}
      {count !== undefined && (
        <span
          className="tabular"
          style={{
            background: active ? "var(--accent)" : "var(--bg-tertiary)",
            color: active ? "#fff" : "var(--text-muted)",
            borderRadius: 99,
            fontSize: 10,
            fontWeight: 600,
            padding: "1px 6px",
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}
