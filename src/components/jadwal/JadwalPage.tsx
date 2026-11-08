import { Plus, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { useConfig } from "../../hooks/useConfig";
import { useJadwal } from "../../hooks/useJadwal";
import { ALL_MODES, MODE_LABELS, TONE_DIR } from "../../lib/constants";
import type { JadwalEntry } from "../../lib/types";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { PageHeader } from "../ui/PageHeader";
import { SkeletonCard } from "../ui/Skeleton";
import { Chip } from "./Chip";
import { EntryModal } from "./EntryModal";
import { GroupSection } from "./GroupSection";
import { buildGroups, type Item } from "./grouping";
import { useJadwalActions } from "./useJadwalActions";

const NO_DAYS: string[] = [];

export function JadwalPage() {
  const [mode, setMode] = useState("reguler");
  const [filter, setFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);

  const { data, isLoading } = useJadwal(mode);
  const { data: configData } = useConfig();

  const hariList = data?.hari ?? NO_DAYS;
  const disabledDays = data?.disabled_days ?? NO_DAYS;
  const activeMode = configData?.active_mode ?? "reguler";
  const actions = useJadwalActions(mode, data?.jadwal, hariList);

  const groups = useMemo(() => buildGroups(data?.jadwal ?? {}, data?.hari ?? []), [data]);
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const activeFilter = groups.some((g) => g.key === filter) ? filter : "all";
  const visible = activeFilter === "all" ? groups : groups.filter((g) => g.key === activeFilter);

  function openAdd() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(item: Item) {
    setEditing(item);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  async function handleSave(entry: JadwalEntry, days: string[]) {
    const ok = await actions.save(entry, days, editing);
    if (ok) closeModal();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageHeader
        title="Jadwal"
        description="Atur waktu dan audio bel untuk setiap mode dan hari"
        action={
          <Button variant="primary" icon={<Plus size={14} />} onClick={openAdd}>
            Tambah bel
          </Button>
        }
      />

      <Card
        title="Jadwal bel"
        action={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label htmlFor="jadwal-mode" style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Mode
            </label>
            <select
              id="jadwal-mode"
              value={mode}
              onChange={(e) => {
                setMode(e.target.value);
                setFilter("all");
              }}
              style={{ width: "auto", padding: "4px 8px", fontSize: 12 }}
            >
              {ALL_MODES.map((m) => (
                <option key={m} value={m}>
                  {MODE_LABELS[m]}
                  {m === activeMode ? " (aktif)" : ""}
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              size="sm"
              icon={<RotateCcw size={12} />}
              loading={actions.resetPending}
              onClick={actions.reset}
            >
              Reset ke default
            </Button>
          </div>
        }
        bodyStyle={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
        {isLoading ? (
          <SkeletonCard />
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
                Hari aktif
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {hariList.map((h) => {
                  const off = disabledDays.includes(h);
                  return (
                    <button
                      key={h}
                      onClick={() => actions.toggleDay(h, off)}
                      disabled={actions.togglePending}
                      aria-pressed={!off}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "4px 12px",
                        borderRadius: 99,
                        border: "1px solid var(--border)",
                        background: "transparent",
                        color: off ? "var(--text-muted)" : "var(--text)",
                        fontFamily: "var(--font)",
                        fontSize: 12,
                        cursor: "pointer",
                        textDecoration: off ? "line-through" : "none",
                      }}
                    >
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: "50%",
                          background: off ? "var(--danger)" : "var(--success)",
                        }}
                      />
                      {h}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <Chip active={activeFilter === "all"} onClick={() => setFilter("all")}>
                Semua ({total})
              </Chip>
              {groups.map((g) => (
                <Chip key={g.key} active={activeFilter === g.key} onClick={() => setFilter(g.key)}>
                  {g.label} ({g.items.length})
                </Chip>
              ))}
            </div>

            {groups.length === 0 ? (
              <EmptyState text="Belum ada bel pada mode ini." />
            ) : (
              visible.map((g) => (
                <GroupSection
                  key={g.key}
                  group={g}
                  disabledDays={disabledDays}
                  isPlaying={actions.isPlaying}
                  onPlay={actions.play}
                  onStop={actions.stopPlayback}
                  onEdit={openEdit}
                  onDelete={actions.remove}
                />
              ))
            )}
          </>
        )}
      </Card>

      <EntryModal
        open={modalOpen}
        onClose={closeModal}
        onSave={handleSave}
        initial={editing}
        initialDays={editing?.days}
        hariList={hariList}
        loading={actions.savePending}
        toneDir={TONE_DIR}
      />
    </div>
  );
}
