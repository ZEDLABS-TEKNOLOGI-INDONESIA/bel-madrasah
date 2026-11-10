import type { RangeMode } from "./constants";

export type RangeKey = `${RangeMode}_start` | `${RangeMode}_end`;

export function rangeKey(mode: RangeMode, edge: "start" | "end"): RangeKey {
  return `${mode}_${edge}` as RangeKey;
}

export type Config = { [K in RangeKey]?: string } & {
  mode: string;
  manual_override?: boolean;
};

export interface ConfigResponse {
  config: Config;
  active_mode: string;
}

export interface ServiceStatus {
  running: boolean;
  is_playing: boolean;
  now_playing?: string;
  is_libur: boolean;
  active_mode: string;
  volume?: number;
  version?: string;
}

export interface VolumeResponse {
  volume: number;
}

export interface JadwalEntry {
  waktu: string;
  audio: string;
}

export interface JadwalResponse {
  jadwal: Record<string, JadwalEntry[]>;
  hari: string[];
  disabled_days: string[];
}

export type JadwalEntryBody =
  | { action: "add"; mode: string; hari: string; entry: JadwalEntry }
  | { action: "edit"; mode: string; hari: string; index: number; entry: JadwalEntry }
  | { action: "delete"; mode: string; hari: string; index: number }
  | { action: "preview"; mode: string; hari: string; index: number };

export interface DayToggleBody {
  mode: string;
  hari: string;
  disable: boolean;
}

export interface PreviewResponse {
  url: string;
  filename?: string;
}

export interface TonesResponse {
  tones: string[];
  usage: Record<string, number>;
  pages: number;
  total: number;
}

export interface TonesQuery {
  page: number;
  perPage: number;
}

export interface LogEntry {
  time: string;
  mode: string;
  hari: string;
  waktu: string;
  audio: string;
}

export interface LogResponse {
  logs: LogEntry[];
}

export interface LiburDate {
  date: string;
  keterangan: string;
}

export interface LiburResponse {
  libur: LiburDate[];
}

export interface LiburBody {
  action: "add" | "delete";
  date: string;
  keterangan: string;
}

export interface NasionalItem {
  date: string;
  name: string;
  is_national_holiday: boolean;
}

export interface EqualizerSettings {
  enabled: boolean;
  gains: number[];
}

export interface EqualizerResponse extends EqualizerSettings {
  frequencies: number[];
  min_gain: number;
  max_gain: number;
  peak_q: number;
}

export interface RenameToneBody {
  filename: string;
  new_name: string;
}

export interface DeleteToneResponse {
  removed: number;
}

export interface RenameToneResponse {
  filename: string;
  updated: number;
}
