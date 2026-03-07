"use client";

import type { SectorData, HdData } from "@/lib/types";
import RacingLineMap from "./RacingLineMap";
import DriverToggle from "./DriverToggle";

interface Props {
  sector: SectorData;
  hd: HdData;
  showUser: boolean;
  showRef: boolean;
  userLabel: string;
  refLabel: string;
  onToggleUser: () => void;
  onToggleRef: () => void;
  onClose: () => void;
  markerDist: number | null;
  onMarkerPlace: (dist: number | null) => void;
}

export default function SectorDetail({
  sector,
  hd,
  showUser,
  showRef,
  userLabel,
  refLabel,
  onToggleUser,
  onToggleRef,
  onClose,
  markerDist,
  onMarkerPlace,
}: Props) {
  const diff = sector.ref_min_speed - sector.user_min_speed;

  return (
    <div className="bg-surface rounded-xl border border-border overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-txt">{sector.name}</h3>
          <span
            className={`font-mono text-sm font-semibold ${
              sector.delta > 0 ? "text-loss" : "text-gain"
            }`}
          >
            {sector.delta > 0 ? "+" : ""}
            {sector.delta.toFixed(3)}s
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface2 text-txt-dim hover:text-txt transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 px-5 py-3 border-b border-border/50">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-txt-dim mb-0.5">Delta</div>
          <div className={`font-mono text-sm font-semibold ${sector.delta > 0 ? "text-loss" : "text-gain"}`}>
            {sector.delta > 0 ? "+" : ""}{sector.delta.toFixed(3)}s
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-txt-dim mb-0.5">Your min speed</div>
          <div className="font-mono text-sm font-semibold text-user">
            {sector.user_min_speed.toFixed(0)} kph
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-txt-dim mb-0.5">Ref min speed</div>
          <div className="font-mono text-sm font-semibold text-ref">
            {sector.ref_min_speed.toFixed(0)} kph
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-txt-dim mb-0.5">Speed diff</div>
          <div className={`font-mono text-sm font-semibold ${diff > 0 ? "text-loss" : "text-gain"}`}>
            {diff > 0 ? "-" : "+"}{Math.abs(diff).toFixed(0)} kph
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-txt-dim mb-0.5">Your trail brake</div>
          <div className="font-mono text-sm font-semibold text-user">
            {sector.user_trail_score?.toFixed(0) ?? 0}%
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-txt-dim mb-0.5">Ref trail brake</div>
          <div className="font-mono text-sm font-semibold text-ref">
            {sector.ref_trail_score?.toFixed(0) ?? 0}%
          </div>
        </div>
      </div>

      {/* Driver toggle */}
      <div className="px-5 py-3 border-b border-border/50">
        <DriverToggle
          showUser={showUser}
          showRef={showRef}
          userLabel={userLabel}
          refLabel={refLabel}
          onToggleUser={onToggleUser}
          onToggleRef={onToggleRef}
        />
      </div>

      {/* Racing line map */}
      <RacingLineMap
        hd={hd}
        sector={sector}
        showUser={showUser}
        showRef={showRef}
        markerDist={markerDist}
        onMarkerPlace={onMarkerPlace}
      />

      {/* Tip */}
      <div className="px-5 py-4 border-t border-border/50">
        <div className="flex gap-3">
          <div className={`w-1 rounded-full flex-shrink-0 ${sector.delta > 0 ? "bg-loss" : "bg-gain"}`} />
          <p className="text-sm text-txt/80 leading-relaxed">{sector.tip}</p>
        </div>
      </div>
    </div>
  );
}
