import React from "react";
import { Play, Square, Pencil, Trash2 } from "lucide-react";
import { Button } from "../ui/Button";

interface Entry {
  waktu: string;
  audio: string;
}

interface EntryRowProps {
  entry: Entry;
  index: number;
  disabled: boolean;
  isPlaying: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onPlay: () => void;
  onStop: () => void;
}

export function EntryRow({
  entry,
  disabled,
  isPlaying,
  onEdit,
  onDelete,
  onPlay,
  onStop,
}: EntryRowProps) {
  const filename = entry.audio.split("/").pop() ?? entry.audio;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        borderRadius: "var(--radius)",
        background: isPlaying ? "rgba(9,105,218,0.06)" : "var(--bg-secondary)",
        border: isPlaying ? "1px solid rgba(9,105,218,0.2)" : "1px solid var(--border)",
        opacity: disabled ? 0.45 : 1,
        transition: "all 0.15s",
      }}
    >
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: isPlaying ? "var(--accent)" : "var(--text)",
          minWidth: 44,
          flexShrink: 0,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {entry.waktu}
      </span>

      <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
        {isPlaying && (
          <div
            style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 14, flexShrink: 0 }}
          >
            {[1, 2, 3].map((i) => (
              <div key={i} className="wave-bar" style={{ height: `${6 + i * 2}px` }} />
            ))}
          </div>
        )}
        <span
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {filename}
        </span>
      </div>

      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        {isPlaying ? (
          <Button
            variant="danger"
            size="sm"
            icon={<Square size={12} />}
            onClick={onStop}
            disabled={disabled}
          >
            Stop
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            icon={<Play size={12} />}
            onClick={onPlay}
            disabled={disabled}
          >
            Play
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          icon={<Pencil size={12} />}
          onClick={onEdit}
          disabled={disabled}
        />
        <Button
          variant="ghost"
          size="sm"
          icon={<Trash2 size={12} />}
          onClick={onDelete}
          disabled={disabled}
          style={{ color: "var(--danger)" }}
        />
      </div>
    </div>
  );
}
