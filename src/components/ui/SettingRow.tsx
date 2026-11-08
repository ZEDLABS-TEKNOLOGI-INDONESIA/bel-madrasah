import type { ReactNode } from "react";

interface SettingRowProps {
  title: string;
  desc?: string;
  children: ReactNode;
  last?: boolean;
}

export function SettingRow({ title, desc, children, last = false }: SettingRowProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "12px 16px",
        borderBottom: last ? "none" : "1px solid var(--border)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{title}</div>
        {desc && (
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{desc}</div>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}
