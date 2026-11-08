import { useEffect, useState } from "react";
import { useTones } from "../../hooks/useTones";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

interface Entry {
  waktu: string;
  audio: string;
}

interface EntryModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (entry: Entry, days: string[]) => void;
  initial?: Entry | null;
  initialDays?: string[];
  hariList: string[];
  loading?: boolean;
  toneDir?: string;
}

export function EntryModal({
  open,
  onClose,
  onSave,
  initial,
  initialDays,
  hariList,
  loading,
  toneDir = "/opt/bel-madrasah/tone",
}: EntryModalProps) {
  const [waktu, setWaktu] = useState("");
  const [selectedFilename, setSelectedFilename] = useState("");
  const [days, setDays] = useState<string[]>([]);
  const { data: tonesData } = useTones(1, 500);

  useEffect(() => {
    if (!open) return;
    setWaktu(initial?.waktu ?? "");
    setSelectedFilename(initial?.audio ? (initial.audio.split("/").pop() ?? "") : "");
    setDays(initialDays && initialDays.length > 0 ? initialDays : hariList.slice(0, 5));
  }, [open, initial, initialDays, hariList]);

  function toggleDay(h: string) {
    setDays((prev) => (prev.includes(h) ? prev.filter((d) => d !== h) : [...prev, h]));
  }

  function handleSave() {
    if (!waktu || !selectedFilename || days.length === 0) return;
    onSave(
      { waktu, audio: `${toneDir}/${selectedFilename}` },
      hariList.filter((h) => days.includes(h))
    );
  }

  const tones: string[] = tonesData?.tones ?? [];

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit bel" : "Tambah bel"} width={460}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Waktu</label>
          <input type="time" value={waktu} onChange={(e) => setWaktu(e.target.value)} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Audio</label>
          <select value={selectedFilename} onChange={(e) => setSelectedFilename(e.target.value)}>
            <option value="">Pilih audio</option>
            {tones.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
              Berlaku pada hari
            </label>
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
            {hariList.map((h) => {
              const on = days.includes(h);
              return (
                <button
                  key={h}
                  type="button"
                  onClick={() => toggleDay(h)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 99,
                    border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`,
                    background: on ? "var(--accent-soft)" : "transparent",
                    color: on ? "var(--accent)" : "var(--text-muted)",
                    fontFamily: "var(--font)",
                    fontSize: 12,
                    fontWeight: on ? 600 : 400,
                    cursor: "pointer",
                  }}
                >
                  {h}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button
            variant="primary"
            loading={loading}
            disabled={!waktu || !selectedFilename || days.length === 0}
            onClick={handleSave}
          >
            Simpan
          </Button>
        </div>
      </div>
    </Modal>
  );
}
