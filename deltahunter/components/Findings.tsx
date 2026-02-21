"use client";

import type { SectorData } from "@/lib/types";

interface Props {
  sectors: SectorData[];
}

export default function Findings({ sectors }: Props) {
  const sorted = [...sectors].sort((a, b) => b.delta - a.delta);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-txt-dim uppercase tracking-wider">
        Key findings
      </h3>
      {sorted.map((s) => (
        <div
          key={s.id}
          className="flex gap-3 p-3 rounded-lg bg-surface2/50"
        >
          <div
            className={`w-1 rounded-full flex-shrink-0 ${
              s.delta > 0 ? "bg-loss" : "bg-gain"
            }`}
          />
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-txt">
                {s.name}
              </span>
              <span
                className={`font-mono text-xs font-semibold ${
                  s.delta > 0 ? "text-loss" : "text-gain"
                }`}
              >
                {s.delta > 0 ? "+" : ""}
                {s.delta.toFixed(3)}s
              </span>
            </div>
            <p className="text-xs text-txt-dim leading-relaxed">{s.tip}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
