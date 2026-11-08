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

export const TONE_DIR = "/opt/bel-madrasah/tone";

export function modeLabel(mode: string | undefined): string {
  if (!mode) return "-";
  return MODE_LABELS[mode] ?? mode;
}
