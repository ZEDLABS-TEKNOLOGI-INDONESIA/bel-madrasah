import { useEffect, useState } from "react";
import { useTones } from "../../hooks/useTones";
import { baseName } from "../../lib/format";
import type { JadwalEntry } from "../../lib/types";
import { Button } from "../ui/Button";
import { Chip } from "../ui/Chip";
import { Field } from "../ui/Field";
import { Modal } from "../ui/Modal";

interface EntryModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (entry: JadwalEntry, days: string[]) => void;
  initial?: JadwalEntry | null;
  initialDays?: string[];
  hariList: string[];
  loading?: boolean;
}

export function EntryModal({
  open,
  onClose,
  onSave,
  initial,
  initialDays,
  hariList,
  loading,
}: EntryModalProps) {
  const [waktu, setWaktu] = useState("");
  const [selectedFilename, setSelectedFilename] = useState("");
  const [days, setDays] = useState<string[]>([]);
  const { data: tonesData } = useTones(1, 500);

  useEffect(() => {
    if (!open) return;
    setWaktu(initial?.waktu ?? "");
    setSelectedFilename(initial?.audio ? baseName(initial.audio) : "");
    setDays(initialDays && initialDays.length > 0 ? initialDays : hariList.slice(0, 5));
  }, [open, initial, initialDays, hariList]);

  function toggleDay(h: string) {
    setDays((prev) => (prev.includes(h) ? prev.filter((d) => d !== h) : [...prev, h]));
  }

  const canSave = Boolean(waktu) && Boolean(selectedFilename) && days.length > 0;

  function handleSave() {
    if (!canSave) return;
    onSave(
      { waktu, audio: selectedFilename },
      hariList.filter((h) => days.includes(h)),
    );
  }

  const tones = tonesData?.tones ?? [];

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit bel" : "Tambah bel"} width={460}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label="Waktu" htmlFor="entry-waktu">
          <input
            id="entry-waktu"
            type="time"
            value={waktu}
            onChange={(e) => setWaktu(e.target.value)}
          />
        </Field>

        <Field label="Audio" htmlFor="entry-audio">
          <select
            id="entry-audio"
            value={selectedFilename}
            onChange={(e) => setSelectedFilename(e.target.value)}
          >
            <option value="">Pilih audio</option>
            {tones.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 4,
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
              Berlaku pada hari
            </span>
            <div style={{ display: "flex", gap: 4 }}>
              <Button variant="ghost" size="sm" onClick={() => setDays(hariList.slice(0, 5))}>
                Senin-Jumat
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setDays([...hariList])}>
                Semua
              </Button>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {hariList.map((h) => (
              <Chip key={h} active={days.includes(h)} onClick={() => toggleDay(h)}>
                {h}
              </Chip>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button variant="primary" loading={loading} disabled={!canSave} onClick={handleSave}>
            Simpan
          </Button>
        </div>
      </div>
    </Modal>
  );
}
