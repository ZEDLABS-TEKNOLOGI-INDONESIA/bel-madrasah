import React from "react";
import { PageHeader } from "../ui/PageHeader";
import { ToneList } from "./ToneList";
import { UploadZone } from "./UploadZone";
import { VolumeSlider } from "./VolumeSlider";

export function AudioPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageHeader title="Audio" description="Kelola nada bel dan volume output" />
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-5">
          <VolumeSlider />
        </div>
        <div className="col-span-12 md:col-span-7">
          <UploadZone />
        </div>
      </div>
      <ToneList />
    </div>
  );
}
