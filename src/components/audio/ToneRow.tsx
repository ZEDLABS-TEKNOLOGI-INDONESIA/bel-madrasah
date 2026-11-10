import { Music2, Pencil, Play, Square, Trash2 } from "lucide-react";
import { Button } from "../ui/Button";
import { ListRow } from "../ui/ListRow";

interface ToneRowProps {
  filename: string;
  isPlaying: boolean;
  onPlay: () => void;
  onStop: () => void;
  onRename: () => void;
  onDelete: () => void;
  deleteLoading?: boolean;
  compact?: boolean;
  last?: boolean;
}

export function ToneRow({
  filename,
  isPlaying,
  onPlay,
  onStop,
  onRename,
  onDelete,
  deleteLoading,
  compact,
  last,
}: ToneRowProps) {
  return (
    <ListRow highlighted={isPlaying} last={last} style={{ padding: "8px 12px 8px 16px" }}>
      <div
        aria-hidden="true"
        style={{
          width: 32,
          height: 32,
          borderRadius: "var(--radius)",
          background: isPlaying ? "var(--accent-soft)" : "var(--bg-tertiary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {isPlaying ? (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 14 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="wave-bar" style={{ height: `${6 + i * 2}px` }} />
            ))}
          </div>
        ) : (
          <Music2 size={14} color="var(--text-muted)" />
        )}
      </div>

      <span
        title={filename}
        style={{
          flex: 1,
          fontSize: 13,
          fontWeight: isPlaying ? 500 : 400,
          color: isPlaying ? "var(--accent)" : "var(--text)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          minWidth: 0,
        }}
      >
        {filename}
      </span>

      <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
        {isPlaying ? (
          <Button
            variant="danger"
            size="sm"
            icon={<Square size={12} />}
            onClick={onStop}
            title="Stop"
            aria-label={`Stop ${filename}`}
          >
            {!compact && "Stop"}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            icon={<Play size={12} />}
            onClick={onPlay}
            title="Putar"
            aria-label={`Putar ${filename}`}
          >
            {!compact && "Putar"}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          icon={<Pencil size={12} />}
          onClick={onRename}
          title="Ganti nama"
          aria-label={`Ganti nama ${filename}`}
        />
        <Button
          variant="ghost"
          size="sm"
          icon={<Trash2 size={12} />}
          onClick={onDelete}
          loading={deleteLoading}
          title="Hapus"
          aria-label={`Hapus ${filename}`}
          style={{ color: "var(--danger)" }}
        />
      </div>
    </ListRow>
  );
}
