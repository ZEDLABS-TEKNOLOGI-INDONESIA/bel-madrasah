import { Volume2 } from "lucide-react";
import toast from "react-hot-toast";
import { useServiceStatus, useServiceToggle } from "../../hooks/useConfig";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import { Skeleton } from "../ui/Skeleton";
import { Toggle } from "../ui/Toggle";

export function StatusCard() {
  const { data, isLoading } = useServiceStatus();
  const toggle = useServiceToggle();

  async function handleToggle() {
    try {
      await toggle.mutateAsync();
      toast.success(data?.running ? "Scheduler dihentikan" : "Scheduler dijalankan");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  if (isLoading) return <Skeleton height={120} radius="var(--radius-lg)" />;

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Status Scheduler
        </span>
        <Toggle
          checked={data?.running ?? false}
          onChange={handleToggle}
          disabled={toggle.isPending}
        />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Status</span>
          <Badge variant={data?.running ? "success" : "danger"} dot>
            {data?.running ? "Berjalan" : "Dihentikan"}
          </Badge>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Mode Aktif</span>
          <Badge variant="accent">{data?.active_mode ?? "-"}</Badge>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Hari Libur</span>
          <Badge variant={data?.is_libur ? "warning" : "default"}>
            {data?.is_libur ? "Libur" : "Aktif"}
          </Badge>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Volume2 size={13} /> Volume
          </span>
          <span style={{ fontSize: 13, fontWeight: 500 }}>
            {data?.volume != null ? `${Math.round(data.volume * 100)}%` : "-"}
          </span>
        </div>
      </div>
    </Card>
  );
}
