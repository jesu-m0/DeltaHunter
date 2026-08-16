"use client";

import { useAnalysisStore } from "@/lib/store";
import { usePlayback } from "@/lib/usePlayback";
import type { ChartData } from "@/lib/types";
import PlaybackBar from "./PlaybackBar";
import PlaybackSheet from "./PlaybackSheet";
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

  // One playback instance feeds both layouts, so crossing the breakpoint (or
  // collapsing the mobile sheet) never interrupts playback.
  const pb = usePlayback(chart, markerDist, onMarkerPlace);

  const toggleUser = () => setShowUser(!showUser);
  const toggleRef = () => setShowRef(!showRef);

  return (
    <>
      {/* Desktop (sm+): single row with every control visible */}
      <div className="hidden sm:block fixed bottom-0 inset-x-0 z-40 border-t border-border bg-surface/95 backdrop-blur-md">
        <div className="max-w-[1600px] mx-auto px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          <DriverToggle
            showUser={showUser}
            showRef={showRef}
            userLabel={userLabel}
            refLabel={refLabel}
            onToggleUser={toggleUser}
            onToggleRef={toggleRef}
          />
          <div className="flex-1 min-w-0">
            <PlaybackBar pb={pb} markerDist={markerDist} />
          </div>
        </div>
      </div>

      {/* Mobile: mini-player that pulls up into the full board */}
      <div className="sm:hidden">
        <PlaybackSheet
          pb={pb}
          markerDist={markerDist}
          showUser={showUser}
          showRef={showRef}
          userLabel={userLabel}
          refLabel={refLabel}
          onToggleUser={toggleUser}
          onToggleRef={toggleRef}
        />
      </div>
    </>
  );
}
