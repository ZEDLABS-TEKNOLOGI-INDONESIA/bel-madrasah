import { ChevronLeft, ChevronRight } from "lucide-react";
import React, { useState } from "react";
import toast from "react-hot-toast";
import { useAudio } from "../../hooks/useAudio";
import { useDeleteTone, useTones } from "../../hooks/useTones";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { SkeletonCard } from "../ui/Skeleton";
import { ToneRow } from "./ToneRow";

export function ToneList() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useTones(page, 20);
  const deleteTone = useDeleteTone();
  const { preview, stop, isPlaying } = useAudio();

  const tones: string[] = data?.tones ?? [];
  const totalPages: number = data?.pages ?? 1;
  const total: number = data?.total ?? 0;

  async function handlePlay(filename: string) {
    try {
      await preview(filename, "/api/tones/preview", { filename });
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleStop() {
    await stop("/api/tones/stop");
  }

  async function handleDelete(filename: string) {
    if (!confirm(`Hapus ${filename}?`)) return;
    try {
      await deleteTone.mutateAsync(filename);
      toast.success(`${filename} dihapus`);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  return (
    <Card title="Daftar audio" action={<Badge>{total} file</Badge>} bodyStyle={{ padding: 0 }}>
      {tones.length === 0 ? (
        <div style={{ textAlign: "center", padding: 32, fontSize: 13, color: "var(--text-muted)" }}>
          Belum ada file audio. Upload file di atas.
        </div>
      ) : (
        tones.map((filename) => (
          <ToneRow
            key={filename}
            filename={filename}
            isPlaying={isPlaying(filename)}
            onPlay={() => handlePlay(filename)}
            onStop={handleStop}
            onDelete={() => handleDelete(filename)}
            deleteLoading={deleteTone.isPending}
          />
        ))
      )}

      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: 12,
          }}
        >
          <Button
            variant="secondary"
            size="sm"
            icon={<ChevronLeft size={14} />}
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          />
          <span className="tabular" style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {page} / {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            icon={<ChevronRight size={14} />}
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          />
        </div>
      )}
    </Card>
  );
}
