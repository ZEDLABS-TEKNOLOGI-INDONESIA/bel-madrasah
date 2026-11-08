import { CalendarOff, Plus, Trash2 } from "lucide-react";
import React, { useState } from "react";
import toast from "react-hot-toast";
import { useLibur, useMutateLibur } from "../../hooks/useLibur";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { SkeletonCard } from "../ui/Skeleton";
import { LiburModal } from "./LiburModal";

interface LiburDate {
  date: string;
  keterangan: string;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

function isUpcoming(dateStr: string) {
  return new Date(dateStr + "T00:00:00") >= new Date(new Date().toDateString());
}

export function LiburList() {
  const { data, isLoading } = useLibur();
  const mutate = useMutateLibur();
  const [modalOpen, setModalOpen] = useState(false);

  const libur: LiburDate[] = data?.libur ?? [];

  async function handleSave(date: string, keterangan: string) {
    try {
      await mutate.mutateAsync({ action: "add", date, keterangan });
      toast.success("Hari libur ditambahkan");
      setModalOpen(false);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleDelete(date: string) {
    if (!confirm(`Hapus libur ${formatDate(date)}?`)) return;
    try {
      await mutate.mutateAsync({ action: "delete", date, keterangan: "" });
      toast.success("Hari libur dihapus");
    } catch (e: any) {
      toast.error(e.message);
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
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
              padding: 32,
              color: "var(--text-muted)",
            }}
          >
            <CalendarOff size={28} />
            <span style={{ fontSize: 13 }}>Belum ada hari libur</span>
          </div>
        ) : (
          libur.map((item, i) => {
            const upcoming = isUpcoming(item.date);
            return (
              <div
                key={item.date}
                className="row-hover"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "10px 16px",
                  borderBottom: i === libur.length - 1 ? "none" : "1px solid var(--border)",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="tabular" style={{ fontSize: 13, fontWeight: 500 }}>
                      {formatDate(item.date)}
                    </span>
                    {upcoming && <Badge variant="warning">Mendatang</Badge>}
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
                  loading={mutate.isPending}
                  style={{ color: "var(--danger)", flexShrink: 0 }}
                />
              </div>
            );
          })
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
