import { Download, ExternalLink, Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useLiburNasional, useMutateLibur } from "../../hooks/useLibur";
import { confirmAction } from "../../lib/confirm";
import { errorMessage } from "../../lib/errors";
import { formatDate, formatDateTime } from "../../lib/format";
import type { NasionalItem } from "../../lib/types";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Chip } from "../ui/Chip";
import { EmptyState } from "../ui/EmptyState";
import { ListRow } from "../ui/ListRow";
import { Skeleton } from "../ui/Skeleton";

const ALREADY_EXISTS = "sudah ada";

export function LiburNasionalPanel() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [showCuti, setShowCuti] = useState(true);
  const { data, isLoading, isError, error, refetch, isFetching } = useLiburNasional(year);
  const mutate = useMutateLibur();
  const [importingAll, setImportingAll] = useState(false);
  const [importedDates, setImportedDates] = useState<Set<string>>(new Set());

  const items: NasionalItem[] = data?.holidays ?? [];
  const nationals = items.filter((i) => i.is_national_holiday);
  const cutis = items.filter((i) => !i.is_national_holiday);

  const displayed = showCuti ? items : nationals;
  const toImport = displayed.filter((i) => !importedDates.has(i.date));

  async function handleImport(item: NasionalItem) {
    try {
      await mutate.mutateAsync({ action: "add", date: item.date, keterangan: item.name });
      setImportedDates((prev) => new Set(prev).add(item.date));
      toast.success(`${item.name} ditambahkan`);
    } catch (e) {
      const message = errorMessage(e);
      if (message.includes(ALREADY_EXISTS)) {
        setImportedDates((prev) => new Set(prev).add(item.date));
      } else {
        toast.error(message);
      }
    }
  }

  async function handleImportAll() {
    if (toImport.length === 0) return;

    const label = showCuti
      ? `${toImport.length} hari libur dan cuti bersama`
      : `${toImport.length} hari libur nasional`;

    const ok = await confirmAction({
      title: "Import hari libur",
      message: `Import semua ${label} tahun ${year}?\nData yang sudah ada akan dilewati.`,
      confirmLabel: "Import",
    });
    if (!ok) return;

    setImportingAll(true);
    let sukses = 0;
    let lewati = 0;
    let gagal = 0;
    const newImported = new Set(importedDates);

    for (const item of toImport) {
      try {
        await mutate.mutateAsync({ action: "add", date: item.date, keterangan: item.name });
        newImported.add(item.date);
        sukses++;
      } catch (e) {
        if (errorMessage(e).includes(ALREADY_EXISTS)) {
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

  const tabs = [
    { label: "Semua", value: true, count: items.length },
    { label: "Libur", value: false, count: nationals.length },
  ];

  return (
    <Card
      title="Libur nasional"
      action={
        <select
          value={year}
          aria-label="Tahun"
          className="select-sm"
          onChange={(e) => handleYearChange(Number(e.target.value))}
        >
          {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      }
      bodyStyle={{ display: "flex", flexDirection: "column", gap: 14 }}
    >
      {!isLoading && items.length > 0 && (
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {tabs.map((tab) => (
            <Chip
              key={tab.label}
              active={showCuti === tab.value}
              count={tab.count}
              onClick={() => setShowCuti(tab.value)}
            >
              {tab.label}
            </Chip>
          ))}
          {cutis.length > 0 && (
            <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 2 }}>
              ({cutis.length} cuti bersama)
            </span>
          )}
        </div>
      )}

      {data?.stale && (
        <p role="status" style={{ fontSize: 12, color: "var(--warning)" }}>
          Sumber sedang tidak dapat dihubungi. Menampilkan data tersimpan
          {data.fetched_at ? ` dari ${formatDateTime(data.fetched_at)}` : ""}.
        </p>
      )}

      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} height={36} radius="var(--radius)" />
          ))}
        </div>
      ) : isError && !data ? (
        <div
          role="alert"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 10,
            padding: 12,
            border: "1px solid var(--danger-border)",
            borderRadius: "var(--radius)",
            background: "var(--danger-soft)",
            fontSize: 12,
            color: "var(--danger)",
          }}
        >
          <span>Data libur nasional tidak dapat diambil: {errorMessage(error)}</span>
          <Button
            size="sm"
            icon={<RefreshCw size={12} />}
            loading={isFetching}
            onClick={() => refetch()}
          >
            Coba lagi
          </Button>
        </div>
      ) : displayed.length === 0 ? (
        <EmptyState text={`Belum ada data libur nasional untuk tahun ${year}`} padding={16} />
      ) : (
        <>
          <Button
            variant="primary"
            size="sm"
            icon={<Download size={13} />}
            loading={importingAll}
            disabled={toImport.length === 0}
            onClick={handleImportAll}
            style={{ alignSelf: "flex-start" }}
          >
            Import semua ({toImport.length})
          </Button>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              maxHeight: 380,
              overflowY: "auto",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
            }}
          >
            {displayed.map((item, i) => {
              const imported = importedDates.has(item.date);
              return (
                <ListRow
                  key={item.date}
                  dimmed={imported}
                  last={i === displayed.length - 1}
                  style={{ justifyContent: "space-between", gap: 8, padding: "8px 12px" }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{item.name}</span>
                      {!item.is_national_holiday && <Badge variant="warning">Cuti</Badge>}
                    </div>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {formatDate(item.date, false)}
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
                    {imported ? "Terimpor" : "Import"}
                  </Button>
                </ListRow>
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
        <ExternalLink size={10} aria-hidden="true" />
        Sumber: {data?.source || "-"}
      </div>
    </Card>
  );
}
