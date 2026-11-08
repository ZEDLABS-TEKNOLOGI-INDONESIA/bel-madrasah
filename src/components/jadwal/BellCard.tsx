import { Pencil, Play, Square, Trash2 } from "lucide-react";
import { fileLabel } from "../../lib/format";
import { Button } from "../ui/Button";
import type { Item } from "./grouping";

interface BellCardProps {
  item: Item;
  playing: boolean;
  onPlay: () => void;
  onStop: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function BellCard({ item, playing, onPlay, onStop, onEdit, onDelete }: BellCardProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        padding: "10px 12px",
        border: `1px solid ${playing ? "var(--accent)" : "var(--border)"}`,
        borderRadius: "var(--radius)",
        background: playing ? "var(--accent-soft)" : "var(--bg-secondary)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          className="tabular"
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: playing ? "var(--accent)" : "var(--text)",
          }}
        >
          {item.waktu}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            marginTop: 2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {fileLabel(item.audio)}
        </div>
      </div>
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        {playing ? (
          <Button
            variant="danger"
            size="sm"
            icon={<Square size={12} />}
            onClick={onStop}
            title="Stop"
            aria-label="Stop"
          />
        ) : (
          <Button
            variant="ghost"
            size="sm"
            icon={<Play size={12} />}
            onClick={onPlay}
            title="Putar"
            aria-label="Putar"
          />
        )}
        <Button
          variant="ghost"
          size="sm"
          icon={<Pencil size={12} />}
          onClick={onEdit}
          title="Edit"
          aria-label="Edit"
        />
        <Button
          variant="ghost"
          size="sm"
          icon={<Trash2 size={12} />}
          onClick={onDelete}
          title="Hapus"
          aria-label="Hapus"
          style={{ color: "var(--danger)" }}
        />
      </div>
    </div>
  );
}
