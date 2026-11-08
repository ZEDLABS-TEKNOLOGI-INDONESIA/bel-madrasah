import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  text: string;
  icon?: LucideIcon;
  padding?: number;
}

export function EmptyState({ text, icon: Icon, padding = 32 }: EmptyStateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        padding,
        textAlign: "center",
        fontSize: 13,
        color: "var(--text-muted)",
      }}
    >
      {Icon && <Icon size={28} aria-hidden="true" />}
      <span>{text}</span>
    </div>
  );
}
