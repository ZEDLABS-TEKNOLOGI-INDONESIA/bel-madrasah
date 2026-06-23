import React from "react";
import { StatusCard } from "./StatusCard";
import { ModeCard } from "./ModeCard";
import { NowPlayingCard } from "./NowPlayingCard";
import { QuickActions } from "./QuickActions";

export function DashboardPage() {
  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12 md:col-span-7">
        <StatusCard />
      </div>
      <div className="col-span-12 md:col-span-5">
        <ModeCard />
      </div>
      <div className="col-span-12 md:col-span-4">
        <NowPlayingCard />
      </div>
      <div className="col-span-12 md:col-span-8">
        <QuickActions />
      </div>
    </div>
  );
}
