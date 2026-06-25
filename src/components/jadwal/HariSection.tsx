import { ChevronDown, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useDayToggle, useJadwalEntry } from "../../hooks/useJadwal";
import { useIsMobile } from "../../hooks/useMediaQuery";
import { api } from "../../lib/api";
import { audioManager } from "../../lib/audioManager";
import { queryClient } from "../../lib/queryClient";
import { Button } from "../ui/Button";
import { Toggle } from "../ui/Toggle";
import { EntryModal } from "./EntryModal";
import { EntryRow } from "./EntryRow";

interface Entry {
  waktu: string;
  audio: string;
}

interface HariSectionProps {
  mode: string;
  hari: string;
  entries: Entry[];
  disabled: boolean;
  toneDir: string;
}

function safeAudioUrl(url: string): string {
  return url
    .split("/")
    .map((segment, i) => (i === 0 ? segment : encodeURIComponent(decodeURIComponent(segment))))
    .join("/");
}

export function HariSection({ mode, hari, entries, disabled, toneDir }: HariSectionProps) {
  const isMobile = useIsMobile();
  const initializedRef = useRef(false);

  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return !window.matchMedia("(max-width: 768px)").matches;
  });

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      return;
    }
    setOpen(!isMobile);
  }, [isMobile]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<{ entry: Entry; index: number } | null>(null);
  const [playingFile, setPlayingFile] = useState<string | null>(audioManager.playing);

  const entryMutation = useJadwalEntry();
  const dayToggle = useDayToggle();

  useEffect(() => {
    return audioManager.subscribe(() => setPlayingFile(audioManager.playing));
  }, []);

  async function handleSave(entry: Entry) {
    try {
      if (editEntry !== null) {
        await entryMutation.mutateAsync({
          action: "edit",
          mode,
          hari,
          index: editEntry.index,
          entry,
        });
        toast.success("Entry diperbarui");
      } else {
        await entryMutation.mutateAsync({ action: "add", mode, hari, entry });
        toast.success("Entry ditambahkan");
      }
      setModalOpen(false);
      setEditEntry(null);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleDelete(index: number) {
    try {
      await entryMutation.mutateAsync({ action: "delete", mode, hari, index });
      toast.success("Entry dihapus");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handlePlay(index: number) {
    try {
      const res: any = await api.post("/api/jadwal/entry", {
        action: "preview",
        mode,
        hari,
        index,
      });
      await audioManager.play(res.filename, safeAudioUrl(res.url));
      queryClient.invalidateQueries({ queryKey: ["service-status"] });
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleStop() {
    try {
      await api.post("/api/tones/stop", {});
    } finally {
      audioManager.stopBrowser();
      queryClient.invalidateQueries({ queryKey: ["service-status"] });
    }
  }

  async function handleToggleDay(val: boolean) {
    try {
      await dayToggle.mutateAsync({ mode, hari, disable: !val });
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          cursor: isMobile ? "pointer" : "default",
          borderBottom: open ? "1px solid var(--border)" : "none",
        }}
        onClick={() => isMobile && setOpen((v) => !v)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{hari}</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{entries.length} entry</span>
        </div>
        <div
          style={{ display: "flex", alignItems: "center", gap: 10 }}
          onClick={(e) => e.stopPropagation()}
        >
          <Toggle checked={!disabled} onChange={handleToggleDay} disabled={dayToggle.isPending} />
          {isMobile && (
            <ChevronDown
              size={16}
              color="var(--text-muted)"
              style={{
                transform: open ? "rotate(180deg)" : "none",
                transition: "transform 0.2s",
              }}
            />
          )}
        </div>
      </div>

      {open && (
        <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          {entries.length === 0 ? (
            <div
              style={{
                fontSize: 13,
                color: "var(--text-muted)",
                fontStyle: "italic",
                textAlign: "center",
                padding: "8px 0",
              }}
            >
              Belum ada entry
            </div>
          ) : (
            entries.map((entry, i) => {
              const filename = entry.audio.split("/").pop() ?? "";
              return (
                <EntryRow
                  key={i}
                  entry={entry}
                  index={i}
                  disabled={disabled}
                  isPlaying={playingFile === filename}
                  onEdit={() => {
                    setEditEntry({ entry, index: i });
                    setModalOpen(true);
                  }}
                  onDelete={() => handleDelete(i)}
                  onPlay={() => handlePlay(i)}
                  onStop={handleStop}
                />
              );
            })
          )}
          <Button
            variant="ghost"
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => {
              setEditEntry(null);
              setModalOpen(true);
            }}
            style={{ alignSelf: "flex-start", marginTop: 4 }}
          >
            Tambah Entry
          </Button>
        </div>
      )}

      <EntryModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditEntry(null);
        }}
        onSave={handleSave}
        initial={editEntry?.entry ?? null}
        loading={entryMutation.isPending}
        toneDir={toneDir}
      />
    </div>
  );
}
