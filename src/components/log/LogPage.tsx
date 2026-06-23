import React, { useState } from "react";
import { RotateCcw, Clock } from "lucide-react";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { SkeletonCard } from "../ui/Skeleton";
import { useLog, useResetLog } from "../../hooks/useLog";
import toast from "react-hot-toast";

interface LogEntry {
  time: string;
  mode: string;
  hari: string;
  waktu: string;
  audio: string;
}

const MODE_VARIANT: Record<string, "accent" | "success" | "warning" | "danger" | "default"> = {
  reguler: "accent",
  ramadhan: "success",
  pts: "warning",
  pas: "warning",
  pesantren: "default",
  lainnya: "default",
};

const MODE_LABELS: Record<string, string> = {
  reguler: "Reguler",
  ramadhan: "Ramadhan",
  pts: "PTS",
  pas: "PAS",
  pesantren: "Pesantren",
  lainnya: "Lainnya",
};

export function LogPage() {
  const { data, isLoading } = useLog();
  const reset = useResetLog();
  const [confirmReset, setConfirmReset] = useState(false);

  const logs: LogEntry[] = data?.logs ?? [];

  async function handleReset() {
    if (!confirmReset) {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 3000);
      return;
    }
    try {
      await reset.mutateAsync();
      toast.success("Log berhasil direset");
      setConfirmReset(false);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  if (isLoading) return <SkeletonCard />;

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Log Aktivitas
          </span>
          <Badge variant="default">{logs.length}</Badge>
        </div>
        <Button
          variant={confirmReset ? "danger" : "ghost"}
          size="sm"
          icon={<RotateCcw size={13} />}
          loading={reset.isPending}
          onClick={handleReset}
        >
          {confirmReset ? "Konfirmasi Reset" : "Reset Log"}
        </Button>
      </div>

      {logs.length === 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
            padding: "32px 0",
            color: "var(--text-muted)",
          }}
        >
          <Clock size={28} />
          <span style={{ fontSize: 13, fontStyle: "italic" }}>Belum ada aktivitas</span>
        </div>
      ) : (
        <>
          <div
            style={{
              overflowX: "auto",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 12,
                minWidth: 520,
              }}
            >
              <thead>
                <tr style={{ background: "var(--bg-secondary)" }}>
                  {["Waktu", "Mode", "Hari", "Jam", "Audio"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "8px 12px",
                        textAlign: "left",
                        fontWeight: 600,
                        color: "var(--text-muted)",
                        borderBottom: "1px solid var(--border)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr
                    key={i}
                    style={{
                      borderBottom: i < logs.length - 1 ? "1px solid var(--border)" : "none",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.background =
                        "var(--bg-secondary)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.background = "transparent";
                    }}
                  >
                    <td
                      style={{
                        padding: "8px 12px",
                        color: "var(--text-muted)",
                        whiteSpace: "nowrap",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {log.time}
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      <Badge variant={MODE_VARIANT[log.mode] ?? "default"}>
                        {MODE_LABELS[log.mode] ?? log.mode}
                      </Badge>
                    </td>
                    <td style={{ padding: "8px 12px", color: "var(--text)" }}>{log.hari}</td>
                    <td
                      style={{
                        padding: "8px 12px",
                        fontVariantNumeric: "tabular-nums",
                        fontWeight: 500,
                        color: "var(--text)",
                      }}
                    >
                      {log.waktu}
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        color: "var(--text-muted)",
                        maxWidth: 200,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {log.audio}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "right" }}>
            Menampilkan {logs.length} entri terbaru
          </div>
        </>
      )}
    </Card>
  );
}
