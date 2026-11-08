import { CalendarOff, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useLibur, useMutateLibur } from "../../hooks/useLibur";
import { confirmAction } from "../../lib/confirm";
import { errorMessage } from "../../lib/errors";
import { formatDate } from "../../lib/format";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { ListRow } from "../ui/ListRow";
import { SkeletonCard } from "../ui/Skeleton";
import { LiburModal } from "./LiburModal";

function isUpcoming(dateStr: string) {
  return new Date(dateStr + "T00:00:00") >= new Date(new Date().toDateString());
}

export function LiburList() {
  const { data, isLoading } = useLibur();
  const mutate = useMutateLibur();
  const [modalOpen, setModalOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const libur = data?.libur ?? [];

  async function handleSave(date: string, keterangan: string) {
    try {
      await mutate.mutateAsync({ action: "add", date, keterangan });
      toast.success("Hari libur ditambahkan");
      setModalOpen(false);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function handleDelete(date: string) {
    const ok = await confirmAction({
      title: "Hapus hari libur",
      message: `Hapus libur ${formatDate(date)}?`,
      confirmLabel: "Hapus",
      danger: true,
    });
    if (!ok) return;
    setDeleting(date);
    try {
      await mutate.mutateAsync({ action: "delete", date, keterangan: "" });
      toast.success("Hari libur dihapus");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setDeleting(null);
    }
  }

  if (isLoading) return <SkeletonCard />;

  return (
    <>
      <Card
        title="Libur lokal"
        action={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Badge>{libur.length}</Badge>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={13} />}
              onClick={() => setModalOpen(true)}
            >
              Tambah
            </Button>
          </div>
        }
        bodyStyle={{ padding: 0 }}
      >
        {libur.length === 0 ? (
          <EmptyState icon={CalendarOff} text="Belum ada hari libur" />
        ) : (
          libur.map((item, i) => (
            <ListRow
              key={item.date}
              last={i === libur.length - 1}
              style={{ justifyContent: "space-between" }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="tabular" style={{ fontSize: 13, fontWeight: 500 }}>
                    {formatDate(item.date)}
                  </span>
                  {isUpcoming(item.date) && <Badge variant="warning">Mendatang</Badge>}
                </div>
                {item.keterangan && (
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {item.keterangan}
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                icon={<Trash2 size={13} />}
                onClick={() => handleDelete(item.date)}
                loading={deleting === item.date}
                title="Hapus"
                aria-label={`Hapus libur ${formatDate(item.date)}`}
                style={{ color: "var(--danger)", flexShrink: 0 }}
              />
            </ListRow>
          ))
        )}
      </Card>

      <LiburModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        loading={mutate.isPending}
      />
    </>
  );
}
