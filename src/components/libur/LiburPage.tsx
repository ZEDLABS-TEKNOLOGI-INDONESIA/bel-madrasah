import { PageHeader } from "../ui/PageHeader";
import { LiburList } from "./LiburList";
import { LiburNasionalPanel } from "./LiburNasionalPanel";

export function LiburPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageHeader title="Hari libur" description="Bel tidak berbunyi pada tanggal yang terdaftar" />
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-7">
          <LiburList />
        </div>
        <div className="col-span-12 md:col-span-5">
          <LiburNasionalPanel />
        </div>
      </div>
    </div>
  );
}
