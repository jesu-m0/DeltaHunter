"use client";

import type { SectorData } from "@/lib/types";

interface Props {
  sectors: SectorData[];
  activeSector: number | null;
  onSectorSelect: (id: number | null) => void;
}

export default function SectorButtons({
  sectors,
  activeSector,
  onSectorSelect,
}: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onSectorSelect(null)}
        className={`
          px-3 py-1.5 rounded-lg text-xs font-medium transition-all
          ${
            activeSector === null
              ? "bg-user text-white"
              : "bg-surface2 text-txt-dim hover:text-txt"
          }
        `}
      >
        Full lap
      </button>
      {sectors.map((s) => (
        <button
          key={s.id}
          onClick={() =>
            onSectorSelect(activeSector === s.id ? null : s.id)
          }
          className={`
            px-3 py-1.5 rounded-lg text-xs font-medium transition-all
            ${
              activeSector === s.id
                ? "bg-user text-white"
                : "bg-surface2 text-txt-dim hover:text-txt"
            }
          `}
        >
          {s.name}
          <span
            className={`ml-1.5 font-mono ${
              s.delta > 0 ? "text-loss" : "text-gain"
            }`}
          >
            {s.delta > 0 ? "+" : ""}
            {s.delta.toFixed(2)}
          </span>
        </button>
      ))}
    </div>
  );
}
