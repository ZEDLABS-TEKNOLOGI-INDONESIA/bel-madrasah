import React from "react";
import { Music2, Play, Square, Trash2 } from "lucide-react";
import { Button } from "../ui/Button";

interface ToneRowProps {
  filename: string;
  isPlaying: boolean;
  onPlay: () => void;
  onStop: () => void;
  onDelete: () => void;
  deleteLoading?: boolean;
}

export function ToneRow({
  filename,
  isPlaying,
  onPlay,
  onStop,
  onDelete,
  deleteLoading,
}: ToneRowProps) {
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
        transition: "all 0.15s",
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: isPlaying ? "rgba(9,105,218,0.12)" : "var(--bg-tertiary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transition: "background 0.15s",
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

      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        {isPlaying ? (
          <Button variant="danger" size="sm" icon={<Square size={12} />} onClick={onStop}>
            Stop
          </Button>
        ) : (
          <Button variant="ghost" size="sm" icon={<Play size={12} />} onClick={onPlay}>
            Play
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          icon={<Trash2 size={12} />}
          onClick={onDelete}
          loading={deleteLoading}
          style={{ color: "var(--danger)" }}
        />
      </div>
    </div>
  );
}
