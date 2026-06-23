import React from "react";
import { VolumeSlider } from "./VolumeSlider";
import { UploadZone } from "./UploadZone";
import { ToneList } from "./ToneList";

export function AudioPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
