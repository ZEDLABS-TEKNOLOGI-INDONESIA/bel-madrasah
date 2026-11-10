import { PageHeader } from "../ui/PageHeader";
import { EqualizerCard } from "./EqualizerCard";
import { ToneList } from "./ToneList";
import { UploadZone } from "./UploadZone";
import { VolumeSlider } from "./VolumeSlider";

const column = { display: "flex", flexDirection: "column", gap: 16 } as const;

export function AudioPage() {
  return (
    <div style={column}>
      <PageHeader title="Audio" description="Kelola nada bel, volume, dan equalizer output" />
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-5" style={column}>
          <VolumeSlider />
          <EqualizerCard />
        </div>
        <div className="col-span-12 md:col-span-7" style={column}>
          <UploadZone />
          <ToneList />
        </div>
      </div>
    </div>
  );
}
