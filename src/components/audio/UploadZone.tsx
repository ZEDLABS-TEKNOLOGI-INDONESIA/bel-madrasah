import { CheckCircle2, FileAudio, Upload } from "lucide-react";
import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { useUploadTone } from "../../hooks/useTones";
import { errorMessage } from "../../lib/errors";
import { Card } from "../ui/Card";

const ALLOWED_EXT = ["mp3", "wav", "ogg"];
const MAX_SIZE = 32 * 1024 * 1024;

export function UploadZone() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const upload = useUploadTone();

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXT.includes(ext ?? "")) {
      toast.error("Format tidak didukung (mp3, wav, ogg)");
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error("File terlalu besar (maks 32MB)");
      return;
    }

    setProgress(0);
    const form = new FormData();
    form.append("file", file);

    const interval = setInterval(() => {
      setProgress((p) => (p != null && p < 85 ? p + 10 : p));
    }, 120);

    try {
      await upload.mutateAsync(form);
      setProgress(100);
      toast.success(`${file.name} berhasil diupload`);
      setTimeout(() => setProgress(null), 1500);
    } catch (e) {
      setProgress(null);
      const message = errorMessage(e);
      toast.error(
        message === "Failed to fetch" ? "Koneksi terputus saat upload, coba lagi" : message,
      );
    } finally {
      clearInterval(interval);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <Card title="Upload audio" bodyStyle={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `1px dashed ${dragging ? "var(--accent)" : "var(--border)"}`,
          borderRadius: "var(--radius-lg)",
          background: dragging ? "var(--accent-soft)" : "var(--bg-secondary)",
          padding: "28px 16px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
          cursor: "pointer",
          transition: "background 0.15s, border-color 0.15s",
        }}
      >
        {progress === 100 ? (
          <CheckCircle2 size={28} color="var(--success)" />
        ) : upload.isPending ? (
          <FileAudio size={28} color="var(--accent)" />
        ) : (
          <Upload size={28} color={dragging ? "var(--accent)" : "var(--text-muted)"} />
        )}
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: dragging ? "var(--accent)" : "var(--text)",
            }}
          >
            {upload.isPending ? "Mengupload..." : "Drag dan drop atau klik untuk pilih file"}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
            MP3, WAV, OGG, maks 32MB
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".mp3,.wav,.ogg"
          aria-label="Pilih file audio"
          style={{ display: "none" }}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {progress !== null && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 11,
              color: "var(--text-muted)",
            }}
          >
            <span>{progress === 100 ? "Selesai" : "Mengupload..."}</span>
            <span className="tabular">{progress}%</span>
          </div>
          <div
            style={{
              height: 4,
              borderRadius: 99,
              background: "var(--bg-tertiary)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progress}%`,
                background: progress === 100 ? "var(--success)" : "var(--accent)",
                borderRadius: 99,
                transition: "width 0.12s, background 0.3s",
              }}
            />
          </div>
        </div>
      )}
    </Card>
  );
}
