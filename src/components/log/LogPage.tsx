import { Clock, RotateCcw } from "lucide-react";
import React, { useState } from "react";
import toast from "react-hot-toast";
import { useLog, useResetLog } from "../../hooks/useLog";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { PageHeader } from "../ui/PageHeader";
import { SkeletonCard } from "../ui/Skeleton";

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
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageHeader title="Log aktivitas" description="Riwayat bel yang sudah dibunyikan" />
      <Card
        title="Riwayat"
        action={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Badge>{logs.length}</Badge>
            <Button
              variant={confirmReset ? "danger" : "secondary"}
              size="sm"
              icon={<RotateCcw size={13} />}
              loading={reset.isPending}
              onClick={handleReset}
            >
              {confirmReset ? "Konfirmasi reset" : "Reset log"}
            </Button>
          </div>
        }
        bodyStyle={{ padding: 0 }}
      >
        {logs.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
              padding: 40,
              color: "var(--text-muted)",
            }}
          >
            <Clock size={28} />
            <span style={{ fontSize: 13 }}>Belum ada aktivitas</span>
          </div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 12,
                  minWidth: 520,
                }}
              >
                <thead>
                  <tr style={{ background: "var(--bg-tertiary)" }}>
                    {["Waktu", "Mode", "Hari", "Jam", "Audio"].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "8px 16px",
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
                      className="row-hover"
                      style={{
                        borderBottom: i < logs.length - 1 ? "1px solid var(--border)" : "none",
                      }}
                    >
                      <td
                        className="tabular"
                        style={{
                          padding: "8px 16px",
                          color: "var(--text-muted)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {log.time}
                      </td>
                      <td style={{ padding: "8px 16px" }}>
                        <Badge variant={MODE_VARIANT[log.mode] ?? "default"}>
                          {MODE_LABELS[log.mode] ?? log.mode}
                        </Badge>
                      </td>
                      <td style={{ padding: "8px 16px", color: "var(--text)" }}>{log.hari}</td>
                      <td
                        className="tabular"
                        style={{ padding: "8px 16px", fontWeight: 500, color: "var(--text)" }}
                      >
                        {log.waktu}
                      </td>
                      <td
                        style={{
                          padding: "8px 16px",
                          color: "var(--text-muted)",
                          maxWidth: 220,
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
            <div
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                textAlign: "right",
                padding: "10px 16px",
                borderTop: "1px solid var(--border)",
              }}
            >
              Menampilkan {logs.length} entri terbaru
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
