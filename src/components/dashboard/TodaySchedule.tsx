import { useEffect, useState, type ReactNode } from "react";
import { useServiceStatus } from "../../hooks/useConfig";
import { useJadwal } from "../../hooks/useJadwal";
import { HARI } from "../../lib/constants";
import { baseName } from "../../lib/format";
import { go } from "../../lib/nav";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { ListRow } from "../ui/ListRow";
import { Skeleton } from "../ui/Skeleton";

function nowHM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function TodaySchedule() {
  const status = useServiceStatus();
  const mode = status.data?.active_mode;
  const hari = HARI[new Date().getDay()];
  const [now, setNow] = useState(nowHM);

  useEffect(() => {
    const t = setInterval(() => setNow(nowHM()), 20_000);
    return () => clearInterval(t);
  }, []);

  const q = useJadwal(mode ?? "reguler", Boolean(mode));

  const action = (
    <Button variant="ghost" size="sm" onClick={() => go("/jadwal")}>
      Kelola
    </Button>
  );

  if (status.isLoading || q.isLoading) return <Skeleton height={280} radius="var(--radius-lg)" />;

  const entries = q.data?.jadwal[hari] ?? [];
  const dayDisabled = Boolean(q.data?.disabled_days.includes(hari));
  const noAuto = mode === "lainnya" || mode === "pesantren";
  const libur = Boolean(status.data?.is_libur);
  const nextIdx = entries.findIndex((e) => e.waktu > now);

  let body: ReactNode;
  if (libur) body = <EmptyState text="Hari ini libur. Bel tidak dijalankan." />;
  else if (noAuto) body = <EmptyState text={`Mode ${mode} tidak menjalankan bel otomatis.`} />;
  else if (dayDisabled) body = <EmptyState text={`Hari ${hari} dinonaktifkan pada mode ini.`} />;
  else if (entries.length === 0) body = <EmptyState text="Belum ada jadwal untuk hari ini." />;
  else
    body = (
      <div style={{ maxHeight: 340, overflowY: "auto" }}>
        {entries.map((e, i) => {
          const done = e.waktu <= now;
          const next = i === nextIdx;
          return (
            <ListRow
              key={`${e.waktu}-${i}`}
              highlighted={next}
              dimmed={done}
              last={i === entries.length - 1}
              style={{ gap: 16 }}
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
            </ListRow>
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
