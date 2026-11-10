import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useAudio } from "../../hooks/useAudio";
import { useIsMobile } from "../../hooks/useMediaQuery";
import { useDeleteTone, useTones } from "../../hooks/useTones";
import { audioManager } from "../../lib/audioManager";
import { confirmAction } from "../../lib/confirm";
import { errorMessage } from "../../lib/errors";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { SkeletonCard } from "../ui/Skeleton";
import { RenameModal } from "./RenameModal";
import { ToneRow } from "./ToneRow";

const PER_PAGE = 20;

export function ToneList() {
  const [page, setPage] = useState(1);
  const [renaming, setRenaming] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const { data, isLoading } = useTones(page, PER_PAGE);
  const deleteTone = useDeleteTone();
  const { preview, stop, isPlaying } = useAudio();

  const tones = data?.tones ?? [];
  const usage = data?.usage ?? {};
  const totalPages = data?.pages ?? 1;
  const total = data?.total ?? 0;

  async function handlePlay(filename: string) {
    try {
      await preview(filename, "/api/tones/preview", { filename });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function handleStop() {
    try {
      await stop("/api/tones/stop");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function handleDelete(filename: string) {
    const used = usage[filename] ?? 0;
    const ok = await confirmAction({
      title: "Hapus audio",
      message:
        used > 0
          ? `${filename} dipakai ${used} jadwal. File dan jadwal tersebut akan dihapus permanen.`
          : `Hapus ${filename}?`,
      confirmLabel: "Hapus",
      danger: true,
    });
    if (!ok) return;
    try {
      if (audioManager.isPlaying(filename)) audioManager.stopBrowser();
      const res = await deleteTone.mutateAsync(filename);
      const scheduled = res.removed > 0 ? `, ${res.removed} jadwal ikut dihapus` : "";
      toast.success(`${filename} dihapus${scheduled}`);
    } catch (e) {
      toast.error(errorMessage(e));
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
    <>
      <Card title="Daftar audio" action={<Badge>{total} file</Badge>} bodyStyle={{ padding: 0 }}>
        {tones.length === 0 ? (
          <EmptyState text="Belum ada file audio. Upload file di atas." />
        ) : (
          tones.map((filename, i) => (
            <ToneRow
              key={filename}
              filename={filename}
              isPlaying={isPlaying(filename)}
              onPlay={() => handlePlay(filename)}
              onStop={handleStop}
              usage={usage[filename] ?? 0}
              onRename={() => setRenaming(filename)}
              onDelete={() => handleDelete(filename)}
              deleteLoading={deleteTone.isPending && deleteTone.variables === filename}
              compact={isMobile}
              last={i === tones.length - 1 && totalPages <= 1}
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
              borderTop: "1px solid var(--border)",
            }}
          >
            <Button
              variant="secondary"
              size="sm"
              icon={<ChevronLeft size={14} />}
              aria-label="Halaman sebelumnya"
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
              aria-label="Halaman berikutnya"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            />
          </div>
        )}
      </Card>
      <RenameModal filename={renaming} onClose={() => setRenaming(null)} />
    </>
  );
}
