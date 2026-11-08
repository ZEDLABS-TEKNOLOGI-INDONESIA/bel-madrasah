import { Activity, Layers, Music2, Volume2 } from "lucide-react";
import React from "react";
import toast from "react-hot-toast";
import { useServiceStatus, useServiceToggle } from "../../hooks/useConfig";
import { Card } from "../ui/Card";
import { Skeleton } from "../ui/Skeleton";
import { Toggle } from "../ui/Toggle";

const MODE_LABELS: Record<string, string> = {
  reguler: "Reguler",
  ramadhan: "Ramadhan",
  pts: "PTS",
  pas: "PAS",
  pesantren: "Pesantren",
  lainnya: "Lainnya",
};

function Stat(props: {
  label: string;
  icon: React.ReactNode;
  value: React.ReactNode;
  footer?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "var(--text-muted)",
          }}
        >
          {props.icon}
          {props.label}
        </span>
        {props.right}
      </div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 600,
          color: "var(--text)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {props.value}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", minHeight: 14 }}>{props.footer}</div>
    </Card>
  );
}

export function StatsRow() {
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

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={104} radius="var(--radius-lg)" />
        ))}
      </div>
    );
  }

  const running = Boolean(data?.running);
  const playing = Boolean(data?.is_playing);
  const volume = typeof data?.volume === "number" ? Math.round(data.volume * 100) : null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Stat
        label="Scheduler"
        icon={<Activity size={13} />}
        right={<Toggle checked={running} onChange={handleToggle} disabled={toggle.isPending} />}
        value={
          <span style={{ color: running ? "var(--success)" : "var(--danger)" }}>
            {running ? "Berjalan" : "Dihentikan"}
          </span>
        }
        footer={data?.is_libur ? "Hari ini libur, bel dilewati" : "Hari ini aktif"}
      />
      <Stat
        label="Mode aktif"
        icon={<Layers size={13} />}
        value={MODE_LABELS[data?.active_mode as string] ?? data?.active_mode ?? "-"}
        footer="Ditentukan oleh jadwal atau override"
      />
      <Stat
        label="Sedang diputar"
        icon={<Music2 size={13} />}
        value={playing ? (data?.now_playing as string) || "Audio" : "Idle"}
        footer={playing ? "Diputar di speaker server" : "Tidak ada audio"}
      />
      <Stat
        label="Volume"
        icon={<Volume2 size={13} />}
        value={volume != null ? `${volume}%` : "-"}
        footer={
          <div
            style={{
              height: 4,
              borderRadius: 99,
              background: "var(--bg-tertiary)",
              overflow: "hidden",
              marginTop: 4,
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.min(100, ((volume ?? 0) / 200) * 100)}%`,
                background: "var(--accent)",
              }}
            />
          </div>
        }
      />
    </div>
  );
}
