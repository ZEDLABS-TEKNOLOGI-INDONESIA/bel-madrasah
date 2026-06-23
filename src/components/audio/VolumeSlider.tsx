import React, { useState, useEffect, useRef } from "react";
import { Volume1, Volume2, VolumeX } from "lucide-react";
import { Card } from "../ui/Card";
import { Slider } from "../ui/Slider";
import { useVolume, useUpdateVolume } from "../../hooks/useConfig";
import { Skeleton } from "../ui/Skeleton";
import toast from "react-hot-toast";

export function VolumeSlider() {
  const { data, isLoading } = useVolume();
  const update = useUpdateVolume();
  const [local, setLocal] = useState<number>(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (data?.volume != null) setLocal(data.volume);
  }, [data?.volume]);

  function handleChange(val: number) {
    setLocal(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        await update.mutateAsync(val);
        toast.success("Volume disimpan");
      } catch (e: any) {
        toast.error(e.message);
      }
    }, 300);
  }

  function VolumeIcon() {
    if (local === 0) return <VolumeX size={16} color="var(--text-muted)" />;
    if (local < 0.5) return <Volume1 size={16} color="var(--text-muted)" />;
    return <Volume2 size={16} color="var(--text-muted)" />;
  }

  if (isLoading) return <Skeleton height={100} radius="var(--radius-lg)" />;

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
          Volume Output
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <VolumeIcon />
          <span style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
            {Math.round(local * 100)}%
          </span>
        </div>
      </div>

      <Slider
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
