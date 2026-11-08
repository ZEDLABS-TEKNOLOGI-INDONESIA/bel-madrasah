import { useQuery } from "@tanstack/react-query";
import React from "react";
import { api } from "../../lib/api";
import { go } from "../../lib/nav";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Skeleton } from "../ui/Skeleton";

type Log = { time: string; mode: string; hari: string; waktu: string; audio: string };

export function RecentActivity() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-log"],
    queryFn: () => api.get<any>("/api/log"),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  if (isLoading) return <Skeleton height={240} radius="var(--radius-lg)" />;

  const logs: Log[] = (data?.logs ?? []).slice(0, 6);

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
        <div style={{ padding: 32, textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>
          Belum ada aktivitas.
        </div>
      ) : (
        logs.map((l, i) => (
          <div
            key={`${l.time}-${i}`}
            className="row-hover"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 16px",
              borderBottom: i === logs.length - 1 ? "none" : "1px solid var(--border)",
            }}
          >
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
          </div>
        ))
      )}
    </Card>
  );
}
