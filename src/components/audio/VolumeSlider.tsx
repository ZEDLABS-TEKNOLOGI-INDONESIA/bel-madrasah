import { Volume1, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useUpdateVolume, useVolume } from "../../hooks/useConfig";
import { errorMessage } from "../../lib/errors";
import { Card } from "../ui/Card";
import { Skeleton } from "../ui/Skeleton";
import { Slider } from "../ui/Slider";

function VolumeIcon({ level }: { level: number }) {
  if (level === 0) return <VolumeX size={16} color="var(--text-muted)" />;
  if (level < 0.5) return <Volume1 size={16} color="var(--text-muted)" />;
  return <Volume2 size={16} color="var(--text-muted)" />;
}

export function VolumeSlider() {
  const { data, isLoading } = useVolume();
  const update = useUpdateVolume();
  const [local, setLocal] = useState<number>(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (data?.volume != null) setLocal(data.volume);
  }, [data?.volume]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleChange(val: number) {
    setLocal(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        await update.mutateAsync(val);
        toast.success("Volume disimpan");
      } catch (e) {
        toast.error(errorMessage(e));
      }
    }, 300);
  }

  if (isLoading) return <Skeleton height={150} radius="var(--radius-lg)" />;

  return (
    <Card
      title="Volume output"
      action={
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <VolumeIcon level={local} />
          <span className="tabular" style={{ fontSize: 16, fontWeight: 600 }}>
            {Math.round(local * 100)}%
          </span>
        </div>
      }
      bodyStyle={{ display: "flex", flexDirection: "column", gap: 16 }}
    >
      <Slider
        label="Volume output"
        valueText={`${Math.round(local * 100)}%`}
        value={local}
        min={0}
        max={2}
        step={0.01}
        onChange={handleChange}
        disabled={update.isPending}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          color: "var(--text-muted)",
        }}
      >
        <span>0%</span>
        <span style={{ color: local > 1 ? "var(--warning)" : "var(--text-muted)" }}>
          {local > 1 ? "Amplifikasi aktif" : "100% = volume normal"}
        </span>
        <span>200%</span>
      </div>
    </Card>
  );
}
