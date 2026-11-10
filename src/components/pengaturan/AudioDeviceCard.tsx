import { Speaker } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useAudioDevices, useSaveAudioDevice, useTestSpeaker } from "../../hooks/useAudioDevice";
import { ALSA_DEFAULT, AUDIO_SOURCE_LABEL } from "../../lib/constants";
import { errorMessage } from "../../lib/errors";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Field } from "../ui/Field";
import { Skeleton } from "../ui/Skeleton";

export function AudioDeviceCard() {
  const { data, isLoading } = useAudioDevices();
  const save = useSaveAudioDevice();
  const test = useTestSpeaker();
  const [choice, setChoice] = useState("");

  useEffect(() => {
    if (data) setChoice(data.selected);
  }, [data?.selected]);

  if (isLoading || !data) return <Skeleton height={220} radius="var(--radius-lg)" />;

  const known = data.devices.some((d) => d.id === data.selected);
  const missing = data.selected !== "" && data.selected !== ALSA_DEFAULT && !known;
  const dirty = choice !== data.selected;

  async function handleTest() {
    try {
      await test.mutateAsync(choice);
      toast.success("Bunyi tes diputar. Terdengar dari speaker?");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function handleSave() {
    try {
      await save.mutateAsync(choice);
      toast.success("Perangkat audio disimpan");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <Card
      title="Perangkat audio"
      action={<Badge>{AUDIO_SOURCE_LABEL[data.source] ?? data.source}</Badge>}
      bodyStyle={{ display: "flex", flexDirection: "column", gap: 14 }}
    >
      <Field
        label="Output speaker"
        htmlFor="audio-device"
        hint={
          data.devices.length === 0
            ? "Tidak ada perangkat ALSA terdeteksi. Pastikan speaker atau USB sound card terpasang."
            : "HDMI hanya berbunyi bila monitor atau TV dengan speaker tersambung."
        }
      >
        <select id="audio-device" value={choice} onChange={(e) => setChoice(e.target.value)}>
          <option value="">Otomatis ({data.auto_label})</option>
          {data.devices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
          {missing && <option value={data.selected}>{data.selected} (tidak terhubung)</option>}
          <option value={ALSA_DEFAULT}>Bawaan sistem (ALSA default)</option>
        </select>
      </Field>

      <div
        role="status"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 12,
          color: "var(--text-muted)",
          minWidth: 0,
        }}
      >
        <Speaker size={14} aria-hidden="true" style={{ flexShrink: 0 }} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          Dipakai sekarang: <strong style={{ color: "var(--text)" }}>{data.active_label}</strong>
        </span>
      </div>

      {missing && (
        <p style={{ fontSize: 12, color: "var(--warning)" }}>
          Perangkat yang dipilih tidak terdeteksi. Bel tidak akan berbunyi sampai perangkat
          tersambung kembali atau pilihan diganti.
        </p>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: 8 }}>
        <Button
          icon={<Speaker size={13} />}
          loading={test.isPending}
          disabled={save.isPending}
          onClick={handleTest}
        >
          Tes speaker
        </Button>
        <Button
          variant="primary"
          loading={save.isPending}
          disabled={!dirty || test.isPending}
          onClick={handleSave}
        >
          Simpan
        </Button>
      </div>
    </Card>
  );
}
