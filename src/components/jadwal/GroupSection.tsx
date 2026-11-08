import { baseName } from "../../lib/format";
import { BellCard } from "./BellCard";
import type { Group, Item } from "./grouping";

interface GroupSectionProps {
  group: Group;
  disabledDays: string[];
  isPlaying: (filename: string) => boolean;
  onPlay: (item: Item) => void;
  onStop: () => void;
  onEdit: (item: Item) => void;
  onDelete: (item: Item, label: string) => void;
}

export function GroupSection({
  group,
  disabledDays,
  isPlaying,
  onPlay,
  onStop,
  onEdit,
  onDelete,
}: GroupSectionProps) {
  const allOff = group.days.every((d) => disabledDays.includes(d));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 12px",
          borderRadius: "var(--radius)",
          background: "var(--bg-tertiary)",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600 }}>{group.label}</span>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{group.items.length} bel</span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 8,
          opacity: allOff ? 0.5 : 1,
        }}
      >
        {group.items.map((item) => (
          <BellCard
            key={`${item.waktu}|${item.audio}`}
            item={item}
            playing={isPlaying(baseName(item.audio))}
            onPlay={() => onPlay(item)}
            onStop={onStop}
            onEdit={() => onEdit(item)}
            onDelete={() => onDelete(item, group.label)}
          />
        ))}
      </div>
    </div>
  );
}
