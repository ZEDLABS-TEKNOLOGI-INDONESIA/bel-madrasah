import { Clock, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useLog, useResetLog } from "../../hooks/useLog";
import { MODE_VARIANT, modeLabel } from "../../lib/constants";
import { errorMessage } from "../../lib/errors";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { PageHeader } from "../ui/PageHeader";
import { SkeletonCard } from "../ui/Skeleton";

const HEADERS = ["Waktu", "Mode", "Hari", "Jam", "Audio"];
const CONFIRM_TIMEOUT = 3000;

export function LogPage() {
  const { data, isLoading } = useLog();
  const reset = useResetLog();
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (!confirmReset) return;
    const t = setTimeout(() => setConfirmReset(false), CONFIRM_TIMEOUT);
    return () => clearTimeout(t);
  }, [confirmReset]);

  const logs = data?.logs ?? [];

  async function handleReset() {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    try {
      await reset.mutateAsync(undefined);
      toast.success("Log berhasil direset");
      setConfirmReset(false);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageHeader title="Log aktivitas" description="Riwayat bel yang sudah dibunyikan" />
      {isLoading ? (
        <SkeletonCard />
      ) : (
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
            <EmptyState icon={Clock} text="Belum ada aktivitas" padding={40} />
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
                      {HEADERS.map((h) => (
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
                        key={`${log.time}-${i}`}
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
                            {modeLabel(log.mode)}
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
      )}
    </div>
  );
}
