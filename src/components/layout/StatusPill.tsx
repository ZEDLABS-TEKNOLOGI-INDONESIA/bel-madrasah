import { useServiceStatus } from "../../hooks/useConfig";

export function StatusPill() {
  const { data } = useServiceStatus();
  if (!data) return null;
  const running = Boolean(data.running);
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        height: 28,
        padding: "0 10px",
        border: "1px solid var(--border)",
        borderRadius: 99,
        fontSize: 12,
        color: "var(--text-muted)",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: running ? "var(--success)" : "var(--danger)",
          flexShrink: 0,
        }}
      />
      <span>{running ? "Scheduler aktif" : "Scheduler berhenti"}</span>
    </div>
  );
}
