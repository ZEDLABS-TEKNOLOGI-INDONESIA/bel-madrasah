import React from "react";
import { Square } from "lucide-react";
import { useServiceStatus } from "../../hooks/useConfig";
import { api } from "../../lib/api";
import { Card } from "../ui/Card";
import { Skeleton } from "../ui/Skeleton";
import { Button } from "../ui/Button";
import toast from "react-hot-toast";

export function NowPlayingCard() {
  const { data, isLoading, refetch } = useServiceStatus();

  async function handleStop() {
    try {
      await api.post("/api/tones/stop", {});
      toast.success("Audio dihentikan");
      refetch();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  if (isLoading) return <Skeleton height={100} radius="var(--radius-lg)" />;

  const isPlaying = data?.is_playing;
  const nowPlaying = data?.now_playing;

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        Now Playing
      </span>
      {isPlaying ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <div
              style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 20, flexShrink: 0 }}
            >
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="wave-bar" style={{ height: `${8 + i * 2}px` }} />
              ))}
            </div>
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {nowPlaying || "Audio"}
            </span>
          </div>
          <Button variant="danger" size="sm" icon={<Square size={12} />} onClick={handleStop}>
            Stop
          </Button>
        </div>
      ) : (
        <div style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>
          Tidak ada audio yang diputar
        </div>
      )}
    </Card>
  );
}
