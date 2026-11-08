import { PageHeader } from "../ui/PageHeader";
import { ModeCard } from "./ModeCard";
import { NowPlayingCard } from "./NowPlayingCard";
import { QuickActions } from "./QuickActions";
import { RecentActivity } from "./RecentActivity";
import { StatsRow } from "./StatsRow";
import { TodaySchedule } from "./TodaySchedule";

function formatToday() {
  return new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function DashboardPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageHeader title="Dashboard" description={formatToday()} />

      <StatsRow />

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-8">
          <TodaySchedule />
        </div>
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">
          <NowPlayingCard />
          <QuickActions />
        </div>
        <div className="col-span-12 lg:col-span-8">
          <RecentActivity />
        </div>
        <div className="col-span-12 lg:col-span-4">
          <ModeCard />
        </div>
      </div>
    </div>
  );
}
