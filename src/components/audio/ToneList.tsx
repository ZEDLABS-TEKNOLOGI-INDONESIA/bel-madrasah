import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ToneRow } from "./ToneRow";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { SkeletonCard } from "../ui/Skeleton";
import { useTones, useDeleteTone } from "../../hooks/useTones";
import { useAudio } from "../../hooks/useAudio";
import toast from "react-hot-toast";

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
    <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Daftar Audio
        </span>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{total} file</span>
      </div>

      {tones.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "32px 0",
            fontSize: 13,
            color: "var(--text-muted)",
            fontStyle: "italic",
          }}
        >
          Belum ada file audio. Upload file di atas.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {tones.map((filename) => (
            <ToneRow
              key={filename}
              filename={filename}
              isPlaying={isPlaying(filename)}
              onPlay={() => handlePlay(filename)}
              onStop={handleStop}
              onDelete={() => handleDelete(filename)}
              deleteLoading={deleteTone.isPending}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Button
            variant="ghost"
            size="sm"
            icon={<ChevronLeft size={14} />}
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          />
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {page} / {totalPages}
          </span>
          <Button
            variant="ghost"
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
