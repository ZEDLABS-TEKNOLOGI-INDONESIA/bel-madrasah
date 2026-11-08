import React from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: "var(--text)" }}>{title}</h1>
        {description && (
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
            {description}
          </div>
        )}
      </div>
      {action}
    </div>
  );
}
