import { useQuery } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import { useServiceStatus } from "../../hooks/useConfig";
import { api } from "../../lib/api";
import { go } from "../../lib/nav";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Skeleton } from "../ui/Skeleton";

const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

type Entry = { waktu: string; audio: string };

function nowHM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function baseName(p: string) {
  return p.split("/").pop() ?? p;
}

function Empty({ text }: { text: string }) {
  return (
    <div style={{ padding: 32, textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>
      {text}
    </div>
  );
}

export function TodaySchedule() {
  const status = useServiceStatus();
  const mode = status.data?.active_mode as string | undefined;
  const hari = HARI[new Date().getDay()];
  const [now, setNow] = useState(nowHM);

  useEffect(() => {
    const t = setInterval(() => setNow(nowHM()), 20_000);
    return () => clearInterval(t);
  }, []);

  const q = useQuery({
    queryKey: ["jadwal-today", mode],
    queryFn: () => api.get<any>(`/api/jadwal?mode=${mode}`),
    enabled: Boolean(mode),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const action = (
    <Button variant="ghost" size="sm" onClick={() => go("/jadwal")}>
      Kelola
    </Button>
  );

  if (status.isLoading || q.isLoading) return <Skeleton height={280} radius="var(--radius-lg)" />;

  const entries: Entry[] = q.data?.jadwal?.[hari] ?? [];
  const dayDisabled = Boolean(q.data?.disabled_days?.includes(hari));
  const noAuto = mode === "lainnya" || mode === "pesantren";
  const libur = Boolean(status.data?.is_libur);
  const nextIdx = entries.findIndex((e) => e.waktu > now);

  let body: React.ReactNode;
  if (libur) body = <Empty text="Hari ini libur. Bel tidak dijalankan." />;
  else if (noAuto) body = <Empty text={`Mode ${mode} tidak menjalankan bel otomatis.`} />;
  else if (dayDisabled) body = <Empty text={`Hari ${hari} dinonaktifkan pada mode ini.`} />;
  else if (entries.length === 0) body = <Empty text="Belum ada jadwal untuk hari ini." />;
  else
    body = (
      <div style={{ maxHeight: 340, overflowY: "auto" }}>
        {entries.map((e, i) => {
          const done = e.waktu <= now;
          const next = i === nextIdx;
          return (
            <div
              key={`${e.waktu}-${i}`}
              className={next ? undefined : "row-hover"}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "10px 16px",
                borderBottom: i === entries.length - 1 ? "none" : "1px solid var(--border)",
                background: next ? "var(--accent-soft)" : undefined,
                opacity: done ? 0.55 : 1,
              }}
            >
              <span
                className="tabular"
                style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", width: 48 }}
              >
                {e.waktu}
              </span>
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 13,
                  color: "var(--text)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {baseName(e.audio)}
              </span>
              {done ? (
                <Badge>Selesai</Badge>
              ) : next ? (
                <Badge variant="accent" dot>
                  Berikutnya
                </Badge>
              ) : (
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Menunggu</span>
              )}
            </div>
          );
        })}
      </div>
    );

  return (
    <Card title={`Jadwal ${hari}`} action={action} bodyStyle={{ padding: 0 }}>
      {body}
    </Card>
  );
}
