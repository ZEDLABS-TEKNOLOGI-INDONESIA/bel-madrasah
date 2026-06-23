import React from "react";
import { Play, Square, CalendarDays, Upload } from "lucide-react";
import { useServiceStatus, useServiceToggle } from "../../hooks/useConfig";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Skeleton } from "../ui/Skeleton";
import toast from "react-hot-toast";

export function QuickActions() {
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

  if (isLoading) return <Skeleton height={80} radius="var(--radius-lg)" />;

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        Quick Actions
      </span>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
        <Button
          variant={data?.running ? "danger" : "primary"}
          icon={data?.running ? <Square size={14} /> : <Play size={14} />}
          loading={toggle.isPending}
          onClick={handleToggle}
        >
          {data?.running ? "Stop Scheduler" : "Start Scheduler"}
        </Button>
        <Button
          variant="secondary"
          icon={<CalendarDays size={14} />}
          onClick={() => (window.location.href = "/jadwal")}
        >
          Buka Jadwal
        </Button>
        <Button
          variant="secondary"
          icon={<Upload size={14} />}
          onClick={() => (window.location.href = "/audio")}
        >
          Upload Audio
        </Button>
      </div>
    </Card>
  );
}
