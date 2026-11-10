import { useEffect, useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { useRenameTone } from "../../hooks/useTones";
import { audioManager } from "../../lib/audioManager";
import { errorMessage } from "../../lib/errors";
import { stripAudioExt } from "../../lib/format";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Modal } from "../ui/Modal";

interface RenameModalProps {
  filename: string | null;
  onClose: () => void;
}

export function RenameModal({ filename, onClose }: RenameModalProps) {
  const [name, setName] = useState("");
  const rename = useRenameTone();
  const ext = filename?.match(/\.[^.]+$/)?.[0] ?? "";

  useEffect(() => {
    if (filename) setName(stripAudioExt(filename));
  }, [filename]);

  const trimmed = name.trim();
  const unchanged = filename !== null && trimmed === stripAudioExt(filename);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!filename || !trimmed || unchanged) return;
    try {
      const res = await rename.mutateAsync({ filename, new_name: trimmed });
      if (audioManager.isPlaying(filename)) audioManager.stopBrowser();
      const scheduled = res.updated > 0 ? `, ${res.updated} jadwal ikut diperbarui` : "";
      toast.success(`Nama diganti menjadi ${res.filename}${scheduled}`);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <Modal open={filename !== null} onClose={onClose} title="Ganti nama file" width={420}>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field
          label="Nama baru"
          htmlFor="rename-input"
          hint={`Ekstensi ${ext} dipertahankan. Spasi menjadi tanda hubung, huruf menjadi kecil. Jadwal yang memakai file ini ikut diperbarui.`}
        >
          <div className="input-group">
            <input
              id="rename-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              maxLength={120}
            />
            <span
              className="addon tabular"
              style={{ width: "auto", padding: "0 12px", fontSize: 12 }}
            >
              {ext}
            </span>
          </div>
        </Field>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button type="button" variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={rename.isPending}
            disabled={!trimmed || unchanged}
          >
            Simpan
          </Button>
        </div>
      </form>
    </Modal>
  );
}
