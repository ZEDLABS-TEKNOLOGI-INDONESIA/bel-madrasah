import toast from "react-hot-toast";
import { useAudio } from "../../hooks/useAudio";
import { useDayToggle, useJadwalEntry, useResetJadwal } from "../../hooks/useJadwal";
import { confirmAction } from "../../lib/confirm";
import { MODE_LABELS } from "../../lib/constants";
import { errorMessage } from "../../lib/errors";
import { baseName, fileLabel } from "../../lib/format";
import type { JadwalEntry } from "../../lib/types";
import type { Item } from "./grouping";

export function useJadwalActions(
  mode: string,
  jadwal: Record<string, JadwalEntry[]> | undefined,
  hariList: string[],
) {
  const entryMutation = useJadwalEntry();
  const dayToggle = useDayToggle();
  const resetMutation = useResetJadwal();
  const { preview, stop, isPlaying } = useAudio();

  function indexOfEntry(day: string, item: JadwalEntry) {
    return (jadwal?.[day] ?? []).findIndex((e) => e.waktu === item.waktu && e.audio === item.audio);
  }

  async function save(entry: JadwalEntry, days: string[], editing: Item | null) {
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
      return true;
    } catch (e) {
      toast.error(errorMessage(e));
      return false;
    }
  }

  async function remove(item: Item, label: string) {
    const ok = await confirmAction({
      title: "Hapus bel",
      message: `Hapus bel ${item.waktu} (${fileLabel(item.audio)}) pada ${label}?`,
      confirmLabel: "Hapus",
      danger: true,
    });
    if (!ok) return;
    try {
      for (const day of item.days) {
        const index = indexOfEntry(day, item);
        if (index >= 0) {
          await entryMutation.mutateAsync({ action: "delete", mode, hari: day, index });
        }
      }
      toast.success("Bel dihapus");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function play(item: Item) {
    const day = item.days[0];
    const index = indexOfEntry(day, item);
    if (index < 0) return;
    try {
      await preview(baseName(item.audio), "/api/jadwal/entry", {
        action: "preview",
        mode,
        hari: day,
        index,
      });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function stopPlayback() {
    try {
      await stop();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function toggleDay(hari: string, currentlyOff: boolean) {
    try {
      await dayToggle.mutateAsync({ mode, hari, disable: !currentlyOff });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function reset() {
    const ok = await confirmAction({
      title: "Reset jadwal",
      message: `Reset jadwal mode ${MODE_LABELS[mode]} ke default? Semua bel pada mode ini akan diganti.`,
      confirmLabel: "Reset",
      danger: true,
    });
    if (!ok) return;
    try {
      await resetMutation.mutateAsync(mode);
      toast.success("Jadwal direset ke default");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return {
    save,
    remove,
    play,
    stopPlayback,
    toggleDay,
    reset,
    isPlaying,
    savePending: entryMutation.isPending,
    togglePending: dayToggle.isPending,
    resetPending: resetMutation.isPending,
  };
}
