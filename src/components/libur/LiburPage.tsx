import { Download, ExternalLink, Plus } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useLiburNasional, useMutateLibur } from "../../hooks/useLibur";
import { Badge } from "../ui/Badge";
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
  const [showCuti, setShowCuti] = useState(true);
  const { data, isLoading } = useLiburNasional(year);
  const mutate = useMutateLibur();
  const [importingAll, setImportingAll] = useState(false);
  const [importedDates, setImportedDates] = useState<Set<string>>(new Set());

  const items: NasionalItem[] = Array.isArray(data) ? data : [];
  const nationals = items.filter((i) => i.is_national_holiday);
  const cutis = items.filter((i) => !i.is_national_holiday);

  const displayed = showCuti ? items : nationals;

  const toImport = displayed.filter((i) => !importedDates.has(i.date));

  async function handleImport(item: NasionalItem) {
    try {
      await mutate.mutateAsync({
        action: "add",
        date: item.date,
        keterangan: item.name,
      });
      setImportedDates((prev) => new Set(prev).add(item.date));
      toast.success(`${item.name} ditambahkan`);
    } catch (e: any) {
      if (e.message?.includes("sudah ada")) {
        setImportedDates((prev) => new Set(prev).add(item.date));
      } else {
        toast.error(e.message);
      }
    }
  }

  async function handleImportAll() {
    if (toImport.length === 0) return;

    const label = showCuti
      ? `${toImport.length} hari libur & cuti bersama`
      : `${toImport.length} hari libur nasional`;

    if (!confirm(`Import semua ${label} tahun ${year}?\nData yang sudah ada akan dilewati.`))
      return;

    setImportingAll(true);
    let sukses = 0;
    let lewati = 0;
    let gagal = 0;
    const newImported = new Set(importedDates);

    for (const item of toImport) {
      try {
        await mutate.mutateAsync({
          action: "add",
          date: item.date,
          keterangan: item.name,
        });
        newImported.add(item.date);
        sukses++;
      } catch (e: any) {
        if (e.message?.includes("sudah ada")) {
          newImported.add(item.date);
          lewati++;
        } else {
          gagal++;
        }
      }
    }

    setImportedDates(newImported);
    setImportingAll(false);

    const parts: string[] = [];
    if (sukses > 0) parts.push(`${sukses} ditambahkan`);
    if (lewati > 0) parts.push(`${lewati} dilewati`);
    if (gagal > 0) parts.push(`${gagal} gagal`);
    toast.success(`Import selesai: ${parts.join(", ")}`);
  }

  function handleYearChange(y: number) {
    setYear(y);
    setImportedDates(new Set());
  }

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Header */}
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
          onChange={(e) => handleYearChange(Number(e.target.value))}
          style={{ width: "auto", padding: "4px 8px", fontSize: 12 }}
        >
          {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {/* Filter tabs: Semua / Libur Nasional / Cuti Bersama */}
      {!isLoading && items.length > 0 && (
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { label: "Semua", value: true, count: items.length },
            { label: "Libur", value: false, count: nationals.length },
          ].map((tab) => {
            const active = showCuti === tab.value;
            return (
              <button
                key={tab.label}
                onClick={() => setShowCuti(tab.value)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 10px",
                  borderRadius: 99,
                  border: active ? "1px solid var(--accent)" : "1px solid var(--border)",
                  background: active ? "rgba(9,105,218,0.1)" : "var(--bg-secondary)",
                  color: active ? "var(--accent)" : "var(--text-muted)",
                  fontSize: 12,
                  fontWeight: active ? 600 : 400,
                  fontFamily: "var(--font)",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {tab.label}
                <span
                  style={{
                    background: active ? "var(--accent)" : "var(--bg-tertiary)",
                    color: active ? "#fff" : "var(--text-muted)",
                    borderRadius: 99,
                    fontSize: 10,
                    fontWeight: 600,
                    padding: "1px 6px",
                    transition: "all 0.15s",
                  }}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
          {/* Badge info jumlah cuti */}
          {cutis.length > 0 && (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                fontSize: 11,
                color: "var(--text-muted)",
                marginLeft: 2,
              }}
            >
              ({cutis.length} cuti bersama)
            </span>
          )}
        </div>
      )}

      {/* Loading skeleton */}
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
      ) : displayed.length === 0 ? (
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
        <>
          {/* Tombol Import Semua */}
          <Button
            variant="primary"
            size="sm"
            icon={<Download size={13} />}
            loading={importingAll}
            disabled={toImport.length === 0}
            onClick={handleImportAll}
            style={{ alignSelf: "flex-start" }}
          >
            Import Semua ({toImport.length})
          </Button>

          {/* Daftar */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 1,
              maxHeight: 380,
              overflowY: "auto",
            }}
          >
            {displayed.map((item) => {
              const imported = importedDates.has(item.date);
              const isCuti = !item.is_national_holiday;
              return (
                <div
                  key={item.date}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    padding: "8px 0",
                    borderBottom: "1px solid var(--border)",
                    opacity: imported ? 0.5 : 1,
                    transition: "opacity 0.2s",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.name}
                      </span>
                      {isCuti && <Badge variant="warning">Cuti</Badge>}
                    </div>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {formatDate(item.date)}
                    </span>
                  </div>
                  <Button
                    variant={imported ? "secondary" : "ghost"}
                    size="sm"
                    icon={imported ? null : <Plus size={12} />}
                    onClick={() => !imported && handleImport(item)}
                    disabled={imported || importingAll}
                    style={{ flexShrink: 0 }}
                  >
                    {imported ? "✓" : "Import"}
                  </Button>
                </div>
              );
            })}
          </div>
        </>
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
