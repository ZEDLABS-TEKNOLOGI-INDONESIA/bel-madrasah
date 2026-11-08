import type { JadwalEntry } from "../../lib/types";

export interface Item extends JadwalEntry {
  days: string[];
}

export interface Group {
  key: string;
  label: string;
  days: string[];
  items: Item[];
}

function dayLabel(days: string[], hariList: string[]) {
  if (days.length === 1) return days[0];
  if (days.length === hariList.length) return "Setiap hari";
  const idx = days.map((d) => hariList.indexOf(d));
  const contiguous = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  if (contiguous) return `${days[0]}-${days[days.length - 1]}`;
  return days.join(", ");
}

export function buildGroups(jadwal: Record<string, JadwalEntry[]>, hariList: string[]): Group[] {
  const items = new Map<string, Item>();
  for (const hari of hariList) {
    for (const e of jadwal[hari] ?? []) {
      const k = `${e.waktu}|${e.audio}`;
      const found = items.get(k);
      if (!found) items.set(k, { waktu: e.waktu, audio: e.audio, days: [hari] });
      else if (!found.days.includes(hari)) found.days.push(hari);
    }
  }

  const groups = new Map<string, Group>();
  for (const item of items.values()) {
    const key = item.days.join(",");
    let g = groups.get(key);
    if (!g) {
      g = { key, label: dayLabel(item.days, hariList), days: item.days, items: [] };
      groups.set(key, g);
    }
    g.items.push(item);
  }

  const list = [...groups.values()];
  list.forEach((g) => g.items.sort((a, b) => a.waktu.localeCompare(b.waktu)));
  list.sort(
    (a, b) =>
      b.days.length - a.days.length || hariList.indexOf(a.days[0]) - hariList.indexOf(b.days[0]),
  );
  return list;
}
