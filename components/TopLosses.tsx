"use client";

import type { SectorData } from "@/lib/types";

interface Props {
  sectors: SectorData[];
  activeSector: number | null;
  onSectorSelect: (id: number | null) => void;
}

/** Compact, quantified facts for one sector, built from the compare data. */
function buildFacts(s: SectorData): string[] {
  const facts: string[] = [];

  const speedDiff = s.ref_min_speed - s.user_min_speed;
  if (speedDiff >= 3) facts.push(`−${speedDiff.toFixed(0)} kph at apex`);
  else if (speedDiff <= -3) facts.push(`+${(-speedDiff).toFixed(0)} kph at apex`);

  if (s.user_brake_point !== null && s.ref_brake_point !== null) {
    const brakeDelta = s.ref_brake_point - s.user_brake_point;
    if (brakeDelta >= 10) facts.push(`brakes ${brakeDelta.toFixed(0)}m earlier`);
    else if (brakeDelta <= -10) facts.push(`brakes ${(-brakeDelta).toFixed(0)}m later`);
  }

  if (s.user_throttle_on !== null && s.ref_throttle_on !== null) {
    const throttleDelta = s.user_throttle_on - s.ref_throttle_on;
    if (throttleDelta >= 10)
      facts.push(`full throttle ${throttleDelta.toFixed(0)}m later`);
    else if (throttleDelta <= -10)
      facts.push(`full throttle ${(-throttleDelta).toFixed(0)}m earlier`);
  }

  const trailDiff = s.ref_trail_score - s.user_trail_score;
  if (trailDiff > 20) facts.push("less trail braking");

  if (facts.length === 0) facts.push("similar inputs — line/momentum difference");
  return facts;
}

export default function TopLosses({ sectors, activeSector, onSectorSelect }: Props) {
  const losses = [...sectors]
    .filter((s) => s.delta > 0.005)
    .sort((a, b) => b.delta - a.delta);

  if (losses.length === 0) return null;

  const potential = losses.reduce((acc, s) => acc + s.delta, 0);
  const top = losses.slice(0, 3);

  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-3">
        <h2 className="text-sm font-semibold text-txt-dim uppercase tracking-wider">
          Top time losses
        </h2>
        <span className="text-xs text-txt-dim">
          Losing time in {losses.length} sector{losses.length !== 1 ? "s" : ""} —{" "}
          <span className="font-mono font-semibold text-gain">
            −{potential.toFixed(3)}s
          </span>{" "}
          recoverable
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {top.map((s, i) => {
          const isActive = activeSector === s.id;
          return (
            <button
              key={s.id}
              onClick={() => onSectorSelect(isActive ? null : s.id)}
              className={`text-left p-3 rounded-lg border transition-colors ${
                isActive
                  ? "border-user/60 bg-user/10"
                  : "border-border bg-surface2/50 hover:bg-surface2"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 rounded-full bg-loss/20 text-loss text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                  {i + 1}
                </span>
                <span className="text-sm font-semibold text-txt truncate">
                  {s.name}
                </span>
                <span className="ml-auto font-mono text-sm font-semibold text-loss flex-shrink-0">
                  +{s.delta.toFixed(3)}s
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {buildFacts(s).map((f) => (
                  <span
                    key={f}
                    className="text-[11px] font-mono text-txt-dim bg-surface2 border border-border/60 rounded px-1.5 py-0.5"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
