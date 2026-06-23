import React, { useState, useEffect } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { useTones } from "../../hooks/useTones";

interface Entry {
  waktu: string;
  audio: string;
}

interface EntryModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (entry: Entry) => void;
  initial?: Entry | null;
  loading?: boolean;
  toneDir?: string;
}

export function EntryModal({
  open,
  onClose,
  onSave,
  initial,
  loading,
  toneDir = "/opt/bel-madrasah/tone",
}: EntryModalProps) {
  const [waktu, setWaktu] = useState("");
  const [selectedFilename, setSelectedFilename] = useState("");
  const { data: tonesData } = useTones(1, 100);

  useEffect(() => {
    if (!open) return;
    setWaktu(initial?.waktu ?? "");
    if (initial?.audio) {
      const filename = initial.audio.split("/").pop() ?? "";
      setSelectedFilename(filename);
    } else {
      setSelectedFilename("");
    }
  }, [open, initial]);

  function buildFullPath(filename: string) {
    if (!filename) return "";
    return `${toneDir}/${filename}`;
  }

  function handleSave() {
    if (!waktu || !selectedFilename) return;
    onSave({ waktu, audio: buildFullPath(selectedFilename) });
  }

  const tones: string[] = tonesData?.tones ?? [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Edit Entry Jadwal" : "Tambah Entry Jadwal"}
      width={420}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
            Waktu (HH:MM)
          </label>
          <input type="time" value={waktu} onChange={(e) => setWaktu(e.target.value)} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Audio</label>
          <select value={selectedFilename} onChange={(e) => setSelectedFilename(e.target.value)}>
            <option value="">-- Pilih audio --</option>
            {tones.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          {selectedFilename && (
            <span
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                padding: "4px 8px",
                background: "var(--bg-tertiary)",
                borderRadius: "var(--radius)",
                fontFamily: "monospace",
                wordBreak: "break-all",
              }}
            >
              {buildFullPath(selectedFilename)}
            </span>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button
            variant="primary"
            loading={loading}
            disabled={!waktu || !selectedFilename}
            onClick={handleSave}
          >
            Simpan
          </Button>
        </div>
      </div>
    </Modal>
  );
}
