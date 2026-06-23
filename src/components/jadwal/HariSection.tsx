import { ChevronDown, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useDayToggle, useJadwalEntry } from "../../hooks/useJadwal";
import { useIsMobile } from "../../hooks/useMediaQuery";
import { api } from "../../lib/api";
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

export function HariSection({ mode, hari, entries, disabled, toneDir }: HariSectionProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<{ entry: Entry; index: number } | null>(null);
  const [playingFile, setPlayingFile] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const entryMutation = useJadwalEntry();
  const dayToggle = useDayToggle();

  useEffect(() => {
    setOpen(!isMobile);
  }, [isMobile]);

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
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      const a = new Audio(res.url);
      audioRef.current = a;
      setPlayingFile(res.filename);
      a.onended = () => setPlayingFile(null);
      a.onerror = () => setPlayingFile(null);
      await a.play();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleStop() {
    try {
      await api.post("/api/tones/stop", {});
    } finally {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingFile(null);
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
        background: "var(--card-gloss), var(--card-bg)",
        border: "1px solid var(--card-border)",
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
