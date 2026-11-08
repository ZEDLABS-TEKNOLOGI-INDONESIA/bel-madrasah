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
