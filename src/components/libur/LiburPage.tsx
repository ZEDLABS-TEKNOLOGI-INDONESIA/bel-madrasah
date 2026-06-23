import { ExternalLink, Plus } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useLiburNasional, useMutateLibur } from "../../hooks/useLibur";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { LiburList } from "./LiburList";

interface NasionalItem {
  date: string;
  name: string;
  is_national_holiday: boolean;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long" });
}

function LiburNasionalPanel() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const { data, isLoading } = useLiburNasional(year);
  const mutate = useMutateLibur();

  const items: NasionalItem[] = Array.isArray(data) ? data : [];
  const nationals = items.filter((i) => i.is_national_holiday);

  async function handleImport(item: NasionalItem) {
    try {
      await mutate.mutateAsync({
        action: "add",
        date: item.date,
        keterangan: item.name,
      });
      toast.success(`${item.name} ditambahkan`);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Libur Nasional
        </span>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          style={{ width: "auto", padding: "4px 8px", fontSize: 12 }}
        >
          {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                height: 36,
                borderRadius: "var(--radius)",
                background: "var(--bg-tertiary)",
                animation: "shimmer 1.5s infinite",
                backgroundSize: "200% 100%",
              }}
            />
          ))}
        </div>
      ) : nationals.length === 0 ? (
        <div
          style={{
            fontSize: 13,
            color: "var(--text-muted)",
            fontStyle: "italic",
            textAlign: "center",
            padding: "16px 0",
          }}
        >
          Tidak ada data
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 1,
            maxHeight: 420,
            overflowY: "auto",
          }}
        >
          {nationals.map((item) => (
            <div
              key={item.date}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                padding: "8px 0",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{item.name}</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {formatDate(item.date)}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                icon={<Plus size={12} />}
                onClick={() => handleImport(item)}
                loading={mutate.isPending}
                style={{ flexShrink: 0 }}
              >
                Import
              </Button>
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          fontSize: 11,
          color: "var(--text-muted)",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <ExternalLink size={10} />
        Sumber: libur.deno.dev
      </div>
    </Card>
  );
}

export function LiburPage() {
  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12 md:col-span-7">
        <LiburList />
      </div>
      <div className="col-span-12 md:col-span-5">
        <LiburNasionalPanel />
      </div>
    </div>
  );
}
