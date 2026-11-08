import { useState } from "react";
import toast from "react-hot-toast";
import { useConfig, useUpdateConfig } from "../../hooks/useConfig";
import { ALL_MODES, MODE_LABELS, RANGE_MODES, modeLabel } from "../../lib/constants";
import { errorMessage } from "../../lib/errors";
import { rangeKey, type Config } from "../../lib/types";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Field } from "../ui/Field";
import { Modal } from "../ui/Modal";
import { Skeleton } from "../ui/Skeleton";

export function ModeCard() {
  const { data, isLoading } = useConfig();
  const update = useUpdateConfig();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Config | null>(null);

  function openModal() {
    if (!data?.config) return;
    setForm({ ...data.config });
    setOpen(true);
  }

  async function handleSave() {
    if (!form) return;
    try {
      await update.mutateAsync(form);
      toast.success("Config berhasil disimpan");
      setOpen(false);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  if (isLoading) return <Skeleton height={120} radius="var(--radius-lg)" />;

  const cfg = data?.config;
  const hasRange = RANGE_MODES.some(
    (m) => cfg?.[rangeKey(m, "start")] || cfg?.[rangeKey(m, "end")],
  );

  return (
    <>
      <Card
        title="Mode bel"
        action={
          <Button variant="secondary" size="sm" onClick={openModal}>
            Ubah
          </Button>
        }
        bodyStyle={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        <div>
          <Badge variant="accent" dot>
            {modeLabel(data?.active_mode)}
          </Badge>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {RANGE_MODES.map((m) => {
            const start = cfg?.[rangeKey(m, "start")];
            const end = cfg?.[rangeKey(m, "end")];
            if (!start && !end) return null;
            return (
              <div
                key={m}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  color: "var(--text-muted)",
                }}
              >
                <span style={{ fontWeight: 500, color: "var(--text)" }}>{MODE_LABELS[m]}</span>
                <span className="tabular">
                  {start} - {end}
                </span>
              </div>
            );
          })}
          {!hasRange && (
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Belum ada rentang tanggal mode.
            </span>
          )}
        </div>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Konfigurasi Mode Bel" width={520}>
        {form && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Field label="Mode" htmlFor="mode-select">
              <select
                id="mode-select"
                value={form.mode}
                onChange={(e) => setForm({ ...form, mode: e.target.value })}
              >
                {ALL_MODES.map((m) => (
                  <option key={m} value={m}>
                    {MODE_LABELS[m]}
                  </option>
                ))}
              </select>
            </Field>

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

            {RANGE_MODES.map((m) => {
              const startKey = rangeKey(m, "start");
              const endKey = rangeKey(m, "end");
              return (
                <div key={m}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      marginBottom: 8,
                    }}
                  >
                    {MODE_LABELS[m]}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <Field label="Mulai" htmlFor={startKey}>
                      <input
                        id={startKey}
                        type="date"
                        value={form[startKey] ?? ""}
                        onChange={(e) => setForm({ ...form, [startKey]: e.target.value })}
                      />
                    </Field>
                    <Field label="Selesai" htmlFor={endKey}>
                      <input
                        id={endKey}
                        type="date"
                        value={form[endKey] ?? ""}
                        onChange={(e) => setForm({ ...form, [endKey]: e.target.value })}
                      />
                    </Field>
                  </div>
                </div>
              );
            })}

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
