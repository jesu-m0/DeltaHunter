"use client";

import { useMemo } from "react";
import type { ParsedSession } from "@/lib/types";
import { computeSessionStats, formatLapTime } from "@/lib/lapStats";

interface Props {
  session: ParsedSession;
  label: string;
  color: "user" | "ref";
  /** Lap currently selected for the comparison. */
  selectedIndex: number;
  onSelectLap: (index: number) => void;
  disabled?: boolean;
}

export default function SessionStats({
  session,
  label,
  color,
  selectedIndex,
  onSelectLap,
  disabled,
}: Props) {
  const stats = useMemo(() => computeSessionStats(session), [session]);
  const colorClass = color === "user" ? "text-user" : "text-ref";
  const ringClass = color === "user" ? "ring-user/60" : "ring-ref/60";

  const cells: { label: string; value: string; sub?: string }[] = [
    { label: "Best", value: formatLapTime(stats.bestTime) },
    {
      label: "Median",
      value: stats.medianTime !== null ? formatLapTime(stats.medianTime) : "—",
    },
    {
      label: "Theoretical best",
      value:
        stats.theoreticalBest !== null
          ? formatLapTime(stats.theoreticalBest)
          : "—",
      sub:
        stats.theoreticalBest !== null
          ? `${(stats.theoreticalBest - stats.bestTime).toFixed(3)}s vs best`
          : undefined,
    },
    {
      label: "Consistency",
      value: stats.stdDev !== null ? `±${stats.stdDev.toFixed(3)}s` : "—",
    },
  ];

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-3">
        <h2 className="text-sm font-semibold text-txt-dim uppercase tracking-wider">
          Session
        </h2>
        <span className={`text-xs font-semibold uppercase ${colorClass}`}>
          {label}
        </span>
        <span className="text-xs text-txt-dim ml-auto">
          {stats.lapCount} lap{stats.lapCount !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        {cells.map((c) => (
          <div key={c.label} className="bg-surface2/50 rounded-lg p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-txt-dim mb-0.5">
              {c.label}
            </div>
            <div className="font-mono text-sm font-semibold text-txt">
              {c.value}
            </div>
            {c.sub && (
              <div className="font-mono text-[10px] text-gain">{c.sub}</div>
            )}
          </div>
        ))}
      </div>

      <div className="max-h-48 overflow-y-auto pr-1 space-y-1">
        {session.laps.map((lap, i) => {
          const isSelected = i === selectedIndex;
          const isValid = stats.validLap[i];
          const delta = stats.deltaToBest[i];
          return (
            <button
              key={i}
              onClick={() => onSelectLap(i)}
              disabled={disabled}
              title={
                isValid
                  ? undefined
                  : "Excluded from stats (slower than 107% of best)"
              }
              className={`w-full flex items-center gap-3 px-2.5 py-1.5 rounded-lg text-xs transition-colors
                ${isSelected ? `bg-surface2 ring-1 ${ringClass}` : "hover:bg-surface2/60"}
                ${isValid ? "" : "opacity-40"}
                disabled:cursor-not-allowed`}
            >
              <span className="text-txt-dim w-12 text-left">
                Lap {lap.lap_number}
              </span>
              <span className="font-mono text-txt">
                {formatLapTime(lap.lap_time)}
              </span>
              <span className="font-mono text-txt-dim ml-auto">
                {i === stats.bestIndex ? "★ best" : `+${delta.toFixed(3)}`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
