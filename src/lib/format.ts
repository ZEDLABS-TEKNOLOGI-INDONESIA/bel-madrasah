export function safeAudioUrl(url: string): string {
  return url
    .split("/")
    .map((seg, i) => (i === 0 ? seg : encodeURIComponent(decodeURIComponent(seg))))
    .join("/");
}

export function baseName(path: string): string {
  return path.split("/").pop() ?? path;
}

export function fileLabel(path: string): string {
  return baseName(path).replace(/\.(mp3|wav|ogg)$/i, "");
}

export function formatDate(dateStr: string, withYear = true): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(
    "id-ID",
    withYear
      ? { day: "numeric", month: "long", year: "numeric" }
      : { day: "numeric", month: "long" },
  );
}

export function formatFrequency(hz: number): string {
  if (hz < 1000) return `${hz} Hz`;
  const k = hz / 1000;
  return `${Number.isInteger(k) ? k : k.toFixed(1)} kHz`;
}

export function formatGain(db: number): string {
  if (db === 0) return "0 dB";
  const text = Number.isInteger(db) ? String(Math.abs(db)) : Math.abs(db).toFixed(1);
  return `${db > 0 ? "+" : "-"}${text} dB`;
}

export function stripAudioExt(filename: string): string {
  return filename.replace(/\.(mp3|wav|ogg)$/i, "");
}
