import React, { useState, useEffect } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";

interface LiburModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (date: string, keterangan: string) => void;
  loading?: boolean;
}

export function LiburModal({ open, onClose, onSave, loading }: LiburModalProps) {
  const [date, setDate] = useState("");
  const [keterangan, setKeterangan] = useState("");

  useEffect(() => {
    if (open) {
      setDate("");
      setKeterangan("");
    }
  }, [open]);

  function handleSave() {
    if (!date) return;
    onSave(date, keterangan);
  }

  return (
    <Modal open={open} onClose={onClose} title="Tambah Hari Libur" width={400}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
            Tanggal
          </label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
            Keterangan
          </label>
          <input
            type="text"
            placeholder="contoh: HUT RI, Libur Semester..."
            value={keterangan}
            onChange={(e) => setKeterangan(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button variant="primary" loading={loading} disabled={!date} onClick={handleSave}>
            Simpan
          </Button>
        </div>
      </div>
    </Modal>
  );
}
