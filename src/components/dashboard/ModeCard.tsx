import React, { useState } from "react";
import { Settings2, ChevronRight } from "lucide-react";
import { useConfig, useUpdateConfig } from "../../hooks/useConfig";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import { Skeleton } from "../ui/Skeleton";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import toast from "react-hot-toast";

const MODE_LABELS: Record<string, string> = {
  reguler: "Reguler",
  ramadhan: "Ramadhan",
  pts: "PTS",
  pas: "PAS",
  pesantren: "Pesantren",
  lainnya: "Lainnya",
};

const ALL_MODES = ["reguler", "ramadhan", "pts", "pas", "pesantren", "lainnya"];

export function ModeCard() {
  const { data, isLoading } = useConfig();
  const update = useUpdateConfig();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(null);

  function openModal() {
    if (!data?.config) return;
    setForm({ ...data.config });
    setOpen(true);
  }

  async function handleSave() {
    try {
      await update.mutateAsync(form);
      toast.success("Config berhasil disimpan");
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  if (isLoading) return <Skeleton height={120} radius="var(--radius-lg)" />;

  const cfg = data?.config;
  const activeMode = data?.active_mode ?? "-";

  return (
    <>
      <Card
        hover
        onClick={openModal}
        style={{ display: "flex", flexDirection: "column", gap: 14, cursor: "pointer" }}
      >
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
            Mode Bel
          </span>
          <ChevronRight size={14} color="var(--text-muted)" />
        </div>
        <div>
          <Badge variant="accent" dot>
            {MODE_LABELS[activeMode] ?? activeMode}
          </Badge>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {["ramadhan", "pts", "pas", "pesantren"].map((m) => {
            const start = cfg?.[`${m}_start`];
            const end = cfg?.[`${m}_end`];
            if (!start && !end) return null;
            return (
              <div
                key={m}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 11,
                  color: "var(--text-muted)",
                }}
              >
                <span style={{ fontWeight: 500 }}>{MODE_LABELS[m]}</span>
                <span>
                  {start} – {end}
                </span>
              </div>
            );
          })}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Settings2 size={11} /> Klik untuk ubah config
        </div>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Konfigurasi Mode Bel" width={520}>
        {form && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
                Mode
              </label>
              <select
                value={form.mode}
                onChange={(e) => setForm({ ...form, mode: e.target.value })}
              >
                {ALL_MODES.map((m) => (
                  <option key={m} value={m}>
                    {MODE_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="checkbox"
                id="manual-override"
                checked={form.manual_override ?? false}
                onChange={(e) => setForm({ ...form, manual_override: e.target.checked })}
                style={{ width: "auto" }}
              />
              <label htmlFor="manual-override" style={{ fontSize: 13, cursor: "pointer" }}>
                Manual Override (paksa gunakan mode di atas)
              </label>
            </div>

            {[
              { key: "ramadhan", label: "Ramadhan" },
              { key: "pts", label: "PTS" },
              { key: "pas", label: "PAS" },
              { key: "pesantren", label: "Pesantren" },
            ].map(({ key, label }) => (
              <div key={key}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    marginBottom: 8,
                  }}
                >
                  {label}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--text-muted)" }}>Mulai</label>
                    <input
                      type="date"
                      value={form[`${key}_start`] ?? ""}
                      onChange={(e) => setForm({ ...form, [`${key}_start`]: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--text-muted)" }}>Selesai</label>
                    <input
                      type="date"
                      value={form[`${key}_end`] ?? ""}
                      onChange={(e) => setForm({ ...form, [`${key}_end`]: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            ))}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <Button variant="primary" loading={update.isPending} onClick={handleSave}>
                Simpan
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
