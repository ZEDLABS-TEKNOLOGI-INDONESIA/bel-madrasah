// src/components/dashboard/NowPlayingCard.tsx
import { useQuery } from "@tanstack/react-query";
import { Square } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../../lib/api";
import { audioManager } from "../../lib/audioManager";
import { queryClient } from "../../lib/queryClient";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Skeleton } from "../ui/Skeleton";

export function NowPlayingCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["service-status"],
    queryFn: () => api.get("/api/service/status"),
    staleTime: 10_000,
    refetchInterval: 3_000,
  });

  // State audio dari browser (audioManager)
  const [browserPlaying, setBrowserPlaying] = useState<string | null>(audioManager.playing);
  useEffect(() => {
    return audioManager.subscribe(() => setBrowserPlaying(audioManager.playing));
  }, []);

  async function handleStop() {
    try {
      await api.post("/api/tones/stop", {});
      toast.success("Audio dihentikan");
      audioManager.stopBrowser();
      queryClient.invalidateQueries({ queryKey: ["service-status"] });
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  if (isLoading) return <Skeleton height={100} radius="var(--radius-lg)" />;

  // Gabungkan: server state ATAU browser state
  const serverPlaying = data?.is_playing as boolean;
  const serverFile = data?.now_playing as string;
  const isPlaying = serverPlaying || !!browserPlaying;
  const nowPlaying = serverPlaying ? serverFile : browserPlaying;

  // Label sumber audio agar user tahu
  const source = serverPlaying ? null : browserPlaying ? "(preview browser)" : null;

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
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 2,
                height: 20,
                flexShrink: 0,
              }}
            >
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="wave-bar" style={{ height: `${8 + i * 2}px` }} />
              ))}
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {nowPlaying || "Audio"}
              </div>
              {source && (
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  {source}
                </div>
              )}
            </div>
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
