import { Square } from "lucide-react";
import toast from "react-hot-toast";
import { useServiceStatus } from "../../hooks/useConfig";
import { useAudio } from "../../hooks/useAudio";
import { errorMessage } from "../../lib/errors";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Skeleton } from "../ui/Skeleton";

export function NowPlayingCard() {
  const { data, isLoading } = useServiceStatus();
  const { playing: browserPlaying, stop } = useAudio();

  async function handleStop() {
    try {
      await stop();
      toast.success("Audio dihentikan");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  if (isLoading) return <Skeleton height={100} radius="var(--radius-lg)" />;

  const serverPlaying = Boolean(data?.is_playing);
  const isPlaying = serverPlaying || Boolean(browserPlaying);
  const nowPlaying = serverPlaying ? data?.now_playing : browserPlaying;
  const source = serverPlaying ? "Speaker server" : browserPlaying ? "Preview browser" : null;

  return (
    <Card title="Sedang diputar">
      {isPlaying ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <div
              style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 20, flexShrink: 0 }}
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
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Tidak ada audio yang diputar</div>
      )}
    </Card>
  );
}
