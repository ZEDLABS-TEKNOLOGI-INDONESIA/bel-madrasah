import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useEqualizer, useSaveEqualizer } from "../../hooks/useEqualizer";
import { audioManager } from "../../lib/audioManager";
import { EQ_PRESETS, matchPreset } from "../../lib/constants";
import { errorMessage } from "../../lib/errors";
import { formatFrequency, formatGain } from "../../lib/format";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Chip } from "../ui/Chip";
import { Skeleton } from "../ui/Skeleton";
import { Slider } from "../ui/Slider";
import { Toggle } from "../ui/Toggle";

const NO_GAINS: number[] = [];

function sameGains(a: readonly number[], b: readonly number[]) {
  return a.length === b.length && a.every((g, i) => g === b[i]);
}

export function EqualizerCard() {
  const { data, isLoading } = useEqualizer();
  const save = useSaveEqualizer();
  const [enabled, setEnabled] = useState(false);
  const [gains, setGains] = useState<number[]>(NO_GAINS);

  const savedGains = data?.gains ?? NO_GAINS;

  useEffect(() => {
    if (!data) return;
    setEnabled(data.enabled);
    setGains(data.gains);
  }, [data]);

  useEffect(() => {
    if (!data) return;
    audioManager.setEqualizer({ enabled, gains, frequencies: data.frequencies, q: data.peak_q });
  }, [enabled, gains, data]);

  useEffect(() => () => audioManager.setEqualizer(null), []);

  if (isLoading || !data) return <Skeleton height={340} radius="var(--radius-lg)" />;

  const dirty = enabled !== data.enabled || !sameGains(gains, savedGains);
  const preset = matchPreset(gains);

  function setBand(index: number, value: number) {
    setGains((prev) => prev.map((g, i) => (i === index ? value : g)));
  }

  async function handleSave() {
    try {
      await save.mutateAsync({ enabled, gains });
      toast.success("Equalizer disimpan");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <Card
      title="Equalizer"
      action={
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <span style={{ color: "var(--text-muted)" }}>{enabled ? "Aktif" : "Nonaktif"}</span>
          <Toggle checked={enabled} onChange={setEnabled} label="Aktifkan equalizer" />
        </label>
      }
      bodyStyle={{ display: "flex", flexDirection: "column", gap: 14 }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {EQ_PRESETS.map((p) => (
          <Chip key={p.key} active={preset === p.key} onClick={() => setGains([...p.gains])}>
            {p.label}
          </Chip>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          opacity: enabled ? 1 : 0.55,
          transition: "opacity 0.15s",
        }}
      >
        {data.frequencies.map((freq, i) => {
          const gain = gains[i] ?? 0;
          return (
            <div
              key={freq}
              style={{
                display: "grid",
                gridTemplateColumns: "56px 1fr 56px",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span className="tabular" style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {formatFrequency(freq)}
              </span>
              <Slider
                label={`Gain ${formatFrequency(freq)}`}
                valueText={formatGain(gain)}
                value={gain}
                min={data.min_gain}
                max={data.max_gain}
                step={0.5}
                origin={0}
                onChange={(v) => setBand(i, v)}
              />
              <span
                className="tabular"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  textAlign: "right",
                  color: gain === 0 ? "var(--text-muted)" : "var(--text)",
                }}
              >
                {formatGain(gain)}
              </span>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
        Pratinjau di browser langsung mengikuti slider. Speaker memakai pengaturan yang tersimpan
        mulai bel berikutnya.
      </p>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button
          variant="ghost"
          disabled={!dirty || save.isPending}
          onClick={() => {
            setEnabled(data.enabled);
            setGains(savedGains);
          }}
        >
          Batal
        </Button>
        <Button variant="primary" loading={save.isPending} disabled={!dirty} onClick={handleSave}>
          Simpan
        </Button>
      </div>
    </Card>
  );
}
