import { CalendarDays, CalendarOff, ChevronRight, Play, Square, Upload } from "lucide-react";
import type { ReactNode } from "react";
import toast from "react-hot-toast";
import { useServiceStatus, useServiceToggle } from "../../hooks/useConfig";
import { errorMessage } from "../../lib/errors";
import { go } from "../../lib/nav";
import { Card } from "../ui/Card";
import { Skeleton } from "../ui/Skeleton";

function ActionRow(props: {
  icon: ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
  disabled?: boolean;
  last?: boolean;
}) {
  return (
    <button
      onClick={props.onClick}
      disabled={props.disabled}
      className="row-hover"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        padding: "12px 16px",
        background: "transparent",
        border: "none",
        borderBottom: props.last ? "none" : "1px solid var(--border)",
        cursor: props.disabled ? "not-allowed" : "pointer",
        textAlign: "left",
        color: "var(--text)",
        opacity: props.disabled ? 0.5 : 1,
      }}
    >
      <span style={{ color: "var(--text-muted)", display: "flex" }}>{props.icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 500 }}>{props.title}</span>
        <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
          {props.desc}
        </span>
      </span>
      <ChevronRight size={14} color="var(--text-muted)" />
    </button>
  );
}

export function QuickActions() {
  const { data, isLoading } = useServiceStatus();
  const toggle = useServiceToggle();

  async function handleToggle() {
    try {
      await toggle.mutateAsync(undefined);
      toast.success(data?.running ? "Scheduler dihentikan" : "Scheduler dijalankan");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  if (isLoading) return <Skeleton height={200} radius="var(--radius-lg)" />;

  const running = Boolean(data?.running);

  return (
    <Card title="Aksi cepat" bodyStyle={{ padding: 0 }}>
      <ActionRow
        icon={running ? <Square size={16} /> : <Play size={16} />}
        title={running ? "Hentikan scheduler" : "Jalankan scheduler"}
        desc={running ? "Bel otomatis akan berhenti" : "Aktifkan kembali bel otomatis"}
        onClick={handleToggle}
        disabled={toggle.isPending}
      />
      <ActionRow
        icon={<CalendarDays size={16} />}
        title="Buka jadwal"
        desc="Atur waktu dan audio bel"
        onClick={() => go("/jadwal")}
      />
      <ActionRow
        icon={<Upload size={16} />}
        title="Upload audio"
        desc="Tambah nada bel baru"
        onClick={() => go("/audio")}
      />
      <ActionRow
        icon={<CalendarOff size={16} />}
        title="Kelola hari libur"
        desc="Tambah atau hapus tanggal libur"
        onClick={() => go("/libur")}
        last
      />
    </Card>
  );
}
