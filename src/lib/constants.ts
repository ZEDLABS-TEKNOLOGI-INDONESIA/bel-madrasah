export type Tone = "accent" | "success" | "warning" | "danger" | "default";

export const ALL_MODES: string[] = ["reguler", "ramadhan", "pts", "pas", "pesantren", "lainnya"];

export const RANGE_MODES = ["ramadhan", "pts", "pas", "pesantren"] as const;

export type RangeMode = (typeof RANGE_MODES)[number];

export const MODE_LABELS: Record<string, string> = {
  reguler: "Reguler",
  ramadhan: "Ramadhan",
  pts: "PTS",
  pas: "PAS",
  pesantren: "Pesantren",
  lainnya: "Lainnya",
};

export const MODE_VARIANT: Record<string, Tone> = {
  reguler: "accent",
  ramadhan: "success",
  pts: "warning",
  pas: "warning",
  pesantren: "default",
  lainnya: "default",
};

export const HARI: string[] = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export function modeLabel(mode: string | undefined): string {
  if (!mode) return "-";
  return MODE_LABELS[mode] ?? mode;
}

export interface EqPreset {
  key: string;
  label: string;
  gains: readonly number[];
}

export const EQ_PRESETS: readonly EqPreset[] = [
  { key: "flat", label: "Datar", gains: [0, 0, 0, 0, 0] },
  { key: "voice", label: "Suara jelas", gains: [-3, -1, 2, 4, 2] },
  { key: "outdoor", label: "Toa", gains: [-6, -2, 3, 5, 1] },
  { key: "bass", label: "Bass", gains: [6, 3, 0, 0, 0] },
  { key: "treble", label: "Treble", gains: [0, 0, 0, 3, 6] },
];

export function matchPreset(gains: readonly number[]): string | null {
  const found = EQ_PRESETS.find(
    (p) => p.gains.length === gains.length && p.gains.every((g, i) => g === gains[i]),
  );
  return found ? found.key : null;
}
