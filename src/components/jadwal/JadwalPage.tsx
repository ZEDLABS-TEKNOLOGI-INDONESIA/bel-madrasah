import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ModeTabs } from "./ModeTabs";
import { HariSection } from "./HariSection";
import { useJadwal } from "../../hooks/useJadwal";
import { useConfig } from "../../hooks/useConfig";
import { SkeletonCard } from "../ui/Skeleton";

const ALL_MODES = ["reguler", "ramadhan", "pts", "pas", "pesantren", "lainnya"];
const DEFAULT_TONE_DIR = "/opt/bel-madrasah/tone";

function extractToneDirFromCache(qc: ReturnType<typeof useQueryClient>): string {
  for (const mode of ALL_MODES) {
    const cached: any = qc.getQueryData(["jadwal", mode]);
    if (!cached?.jadwal) continue;
    for (const entries of Object.values(cached.jadwal) as any[]) {
      for (const e of entries) {
        const idx = (e.audio as string).lastIndexOf("/");
        if (idx > 0) return (e.audio as string).substring(0, idx);
      }
    }
  }
  return DEFAULT_TONE_DIR;
}

export function JadwalPage() {
  const [mode, setMode] = useState("reguler");
  const qc = useQueryClient();
  const { data, isLoading } = useJadwal(mode);
  const { data: configData } = useConfig();

  const activeMode = configData?.active_mode ?? "reguler";
  const jadwal = data?.jadwal ?? {};
  const hariList: string[] = data?.hari ?? [];
  const disabledDays: string[] = data?.disabled_days ?? [];
  const toneDir = extractToneDirFromCache(qc);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <ModeTabs modes={ALL_MODES} active={mode} activeMode={activeMode} onChange={setMode} />

      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {hariList.map((hari) => (
            <HariSection
              key={hari}
              mode={mode}
              hari={hari}
              entries={jadwal[hari] ?? []}
              disabled={disabledDays.includes(hari)}
              toneDir={toneDir}
            />
          ))}
        </div>
      )}
    </div>
  );
}
