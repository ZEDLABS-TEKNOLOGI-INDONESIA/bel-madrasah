import { useLog } from "../../hooks/useLog";
import { go } from "../../lib/nav";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { ListRow } from "../ui/ListRow";
import { Skeleton } from "../ui/Skeleton";

export function RecentActivity() {
  const { data, isLoading } = useLog();

  if (isLoading) return <Skeleton height={240} radius="var(--radius-lg)" />;

  const logs = (data?.logs ?? []).slice(0, 6);

  return (
    <Card
      title="Aktivitas terakhir"
      action={
        <Button variant="ghost" size="sm" onClick={() => go("/log")}>
          Lihat semua
        </Button>
      }
      bodyStyle={{ padding: 0 }}
    >
      {logs.length === 0 ? (
        <EmptyState text="Belum ada aktivitas." />
      ) : (
        logs.map((l, i) => (
          <ListRow key={`${l.time}-${i}`} last={i === logs.length - 1}>
            <span
              className="tabular"
              style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}
            >
              {l.time}
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
              {l.audio}
            </span>
            <Badge variant="accent">{l.mode}</Badge>
          </ListRow>
        ))
      )}
    </Card>
  );
}
