"use client";

import { useAnalysisStore } from "@/lib/store";
import type { ChartData } from "@/lib/types";
import PlaybackBar from "./PlaybackBar";
import DriverToggle from "./DriverToggle";

interface Props {
  chart: ChartData;
  markerDist: number | null;
  onMarkerPlace: (dist: number | null) => void;
  userLabel: string;
  refLabel: string;
}

export default function ControlDock({
  chart,
  markerDist,
  onMarkerPlace,
  userLabel,
  refLabel,
}: Props) {
  const showUser = useAnalysisStore((s) => s.showUser);
  const showRef = useAnalysisStore((s) => s.showRef);
  const setShowUser = useAnalysisStore((s) => s.setShowUser);
  const setShowRef = useAnalysisStore((s) => s.setShowRef);

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-surface/95 backdrop-blur-md">
      <div className="max-w-[1600px] mx-auto px-3 sm:px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-2">
        <DriverToggle
          showUser={showUser}
          showRef={showRef}
          userLabel={userLabel}
          refLabel={refLabel}
          onToggleUser={() => setShowUser(!showUser)}
          onToggleRef={() => setShowRef(!showRef)}
        />
        <div className="order-last w-full sm:order-none sm:w-auto sm:flex-1 min-w-0">
          <PlaybackBar
            chart={chart}
            markerDist={markerDist}
            onMarkerPlace={onMarkerPlace}
          />
        </div>
      </div>
    </div>
  );
}
