import { Pencil, Play, Plus, RotateCcw, Square, Trash2 } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useConfig } from "../../hooks/useConfig";
import { useDayToggle, useJadwal, useJadwalEntry } from "../../hooks/useJadwal";
import { api } from "../../lib/api";
import { audioManager } from "../../lib/audioManager";
import { queryClient } from "../../lib/queryClient";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { PageHeader } from "../ui/PageHeader";
import { SkeletonCard } from "../ui/Skeleton";
import { EntryModal } from "./EntryModal";

const ALL_MODES = ["reguler", "ramadhan", "pts", "pas", "pesantren", "lainnya"];
const MODE_LABELS: Record<string, string> = {
  reguler: "Reguler",
  ramadhan: "Ramadhan",
  pts: "PTS",
  pas: "PAS",
  pesantren: "Pesantren",
  lainnya: "Lainnya",
};
const TONE_DIR = "/opt/bel-madrasah/tone";

interface Entry {
  waktu: string;
  audio: string;
}

interface Item {
  waktu: string;
  audio: string;
  days: string[];
}

interface Group {
  key: string;
  label: string;
  days: string[];
  items: Item[];
}

function safeAudioUrl(url: string): string {
  return url
    .split("/")
    .map((segment, i) => (i === 0 ? segment : encodeURIComponent(decodeURIComponent(segment))))
    .join("/");
}

function fileLabel(audio: string) {
  const name = audio.split("/").pop() ?? audio;
  return name.replace(/\.(mp3|wav|ogg)$/i, "");
}

function dayLabel(days: string[], hariList: string[]) {
  if (days.length === 1) return days[0];
  if (days.length === hariList.length) return "Setiap hari";
  const idx = days.map((d) => hariList.indexOf(d));
  const contiguous = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  if (contiguous) return `${days[0]}-${days[days.length - 1]}`;
  return days.join(", ");
}

function buildGroups(jadwal: Record<string, Entry[]>, hariList: string[]): Group[] {
  const items = new Map<string, Item>();
  for (const hari of hariList) {
    for (const e of jadwal[hari] ?? []) {
      const k = `${e.waktu}|${e.audio}`;
      const found = items.get(k);
      if (!found) items.set(k, { waktu: e.waktu, audio: e.audio, days: [hari] });
      else if (!found.days.includes(hari)) found.days.push(hari);
    }
  }

  const groups = new Map<string, Group>();
  for (const item of items.values()) {
    const key = item.days.join(",");
    let g = groups.get(key);
    if (!g) {
      g = { key, label: dayLabel(item.days, hariList), days: item.days, items: [] };
      groups.set(key, g);
    }
    g.items.push(item);
  }

  const list = [...groups.values()];
  list.forEach((g) => g.items.sort((a, b) => a.waktu.localeCompare(b.waktu)));
  list.sort(
    (a, b) =>
      b.days.length - a.days.length || hariList.indexOf(a.days[0]) - hariList.indexOf(b.days[0])
  );
  return list;
}

function Chip(props: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={props.onClick}
      style={{
        padding: "4px 12px",
        borderRadius: 99,
        border: `1px solid ${props.active ? "var(--accent)" : "var(--border)"}`,
        background: props.active ? "var(--accent)" : "var(--bg-tertiary)",
        color: props.active ? "#fff" : "var(--text-muted)",
        fontFamily: "var(--font)",
        fontSize: 12,
        fontWeight: props.active ? 600 : 500,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {props.children}
    </button>
  );
}

export function JadwalPage() {
  const [mode, setMode] = useState("reguler");
  const [filter, setFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [playingFile, setPlayingFile] = useState<string | null>(audioManager.playing);
  const [resetting, setResetting] = useState(false);

  const { data, isLoading } = useJadwal(mode);
  const { data: configData } = useConfig();
  const entryMutation = useJadwalEntry();
  const dayToggle = useDayToggle();

  useEffect(() => {
    return audioManager.subscribe(() => setPlayingFile(audioManager.playing));
  }, []);

  const activeMode = configData?.active_mode ?? "reguler";
  const jadwal: Record<string, Entry[]> = data?.jadwal ?? {};
  const hariList: string[] = data?.hari ?? [];
  const disabledDays: string[] = data?.disabled_days ?? [];

  const groups = useMemo(() => buildGroups(jadwal, hariList), [data]);
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const activeFilter = groups.some((g) => g.key === filter) ? filter : "all";
  const visible = activeFilter === "all" ? groups : groups.filter((g) => g.key === activeFilter);

  function indexOfEntry(day: string, item: Entry) {
    return (jadwal[day] ?? []).findIndex((e) => e.waktu === item.waktu && e.audio === item.audio);
  }

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

  async function handleSave(entry: Entry, days: string[]) {
    try {
      if (editing) {
        for (const day of hariList) {
          const inOld = editing.days.includes(day);
          const inNew = days.includes(day);
          const index = inOld ? indexOfEntry(day, editing) : -1;
          if (inOld && inNew && index >= 0) {
            await entryMutation.mutateAsync({ action: "edit", mode, hari: day, index, entry });
          } else if (inOld && !inNew && index >= 0) {
            await entryMutation.mutateAsync({ action: "delete", mode, hari: day, index });
          } else if (inNew) {
            await entryMutation.mutateAsync({ action: "add", mode, hari: day, entry });
          }
        }
        toast.success("Bel diperbarui");
      } else {
        for (const day of days) {
          await entryMutation.mutateAsync({ action: "add", mode, hari: day, entry });
        }
        toast.success("Bel ditambahkan");
      }
      closeModal();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleDelete(item: Item, label: string) {
    if (!confirm(`Hapus bel ${item.waktu} (${fileLabel(item.audio)}) pada ${label}?`)) return;
    try {
      for (const day of item.days) {
        const index = indexOfEntry(day, item);
        if (index >= 0) {
          await entryMutation.mutateAsync({ action: "delete", mode, hari: day, index });
        }
      }
      toast.success("Bel dihapus");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handlePlay(item: Item) {
    const day = item.days[0];
    const index = indexOfEntry(day, item);
    if (index < 0) return;
    try {
      const res: any = await api.post("/api/jadwal/entry", {
        action: "preview",
        mode,
        hari: day,
        index,
      });
      await audioManager.play(res.filename, safeAudioUrl(res.url));
      queryClient.invalidateQueries({ queryKey: ["service-status"] });
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleStop() {
    try {
      await api.post("/api/tones/stop", {});
    } finally {
      audioManager.stopBrowser();
      queryClient.invalidateQueries({ queryKey: ["service-status"] });
    }
  }

  async function handleToggleDay(hari: string, currentlyOff: boolean) {
    try {
      await dayToggle.mutateAsync({ mode, hari, disable: !currentlyOff });
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleReset() {
    if (
      !confirm(
        `Reset jadwal mode ${MODE_LABELS[mode]} ke default? Semua bel pada mode ini akan diganti.`
      )
    )
      return;
    setResetting(true);
    try {
      await api.post("/api/jadwal/reset", { mode });
      await queryClient.invalidateQueries({ queryKey: ["jadwal"] });
      toast.success("Jadwal direset ke default");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setResetting(false);
    }
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
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Mode</span>
            <select
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
              loading={resetting}
              onClick={handleReset}
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
                      onClick={() => handleToggleDay(h, off)}
                      disabled={dayToggle.isPending}
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
              <div
                style={{
                  textAlign: "center",
                  padding: 32,
                  fontSize: 13,
                  color: "var(--text-muted)",
                }}
              >
                Belum ada bel pada mode ini.
              </div>
            ) : (
              visible.map((g) => {
                const allOff = g.days.every((d) => disabledDays.includes(d));
                return (
                  <div key={g.key} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{g.label}</span>
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {g.items.length} bel
                      </span>
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                        gap: 8,
                        opacity: allOff ? 0.5 : 1,
                      }}
                    >
                      {g.items.map((item) => {
                        const filename = item.audio.split("/").pop() ?? "";
                        const playing = playingFile === filename;
                        return (
                          <div
                            key={`${item.waktu}|${item.audio}`}
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
                                  onClick={handleStop}
                                  title="Stop"
                                />
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  icon={<Play size={12} />}
                                  onClick={() => handlePlay(item)}
                                  title="Putar"
                                />
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                icon={<Pencil size={12} />}
                                onClick={() => openEdit(item)}
                                title="Edit"
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                icon={<Trash2 size={12} />}
                                onClick={() => handleDelete(item, g.label)}
                                title="Hapus"
                                style={{ color: "var(--danger)" }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}
      </Card>

      <EntryModal
        open={modalOpen}
        onClose={closeModal}
        onSave={handleSave}
        initial={editing ? { waktu: editing.waktu, audio: editing.audio } : null}
        initialDays={editing?.days}
        hariList={hariList}
        loading={entryMutation.isPending}
        toneDir={TONE_DIR}
      />
    </div>
  );
}
