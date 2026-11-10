import { useServiceStatus } from "../../hooks/useConfig";
import { useIsMobile } from "../../hooks/useMediaQuery";

export function StatusPill() {
  const { data } = useServiceStatus();
  const isMobile = useIsMobile();
  if (!data) return null;
  const running = Boolean(data.running);
  const full = running ? "Scheduler aktif" : "Scheduler berhenti";
  return (
    <div
      role="status"
      title={full}
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
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: running ? "var(--success)" : "var(--danger)",
          flexShrink: 0,
        }}
      />
      <span>{isMobile ? (running ? "Aktif" : "Berhenti") : full}</span>
    </div>
  );
}
