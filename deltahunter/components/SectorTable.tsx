"use client";

import type { SectorData } from "@/lib/types";

interface Props {
  sectors: SectorData[];
  activeSector: number | null;
  onSectorSelect: (id: number | null) => void;
}

export default function SectorTable({
  sectors,
  activeSector,
  onSectorSelect,
}: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-txt-dim text-xs uppercase tracking-wider border-b border-border">
            <th className="text-left py-2 px-3 font-medium">Sector</th>
            <th className="text-right py-2 px-3 font-medium">Delta</th>
            <th className="text-right py-2 px-3 font-medium">Your min</th>
            <th className="text-right py-2 px-3 font-medium">Ref min</th>
            <th className="text-right py-2 px-3 font-medium">Diff</th>
          </tr>
        </thead>
        <tbody>
          {sectors.map((s) => {
            const isActive = activeSector === s.id;
            const diff = s.ref_min_speed - s.user_min_speed;
            return (
              <tr
                key={s.id}
                onClick={() =>
                  onSectorSelect(isActive ? null : s.id)
                }
                className={`
                  cursor-pointer border-b border-border/50 transition-colors
                  ${
                    isActive
                      ? "bg-user/10"
                      : "hover:bg-surface2"
                  }
                `}
              >
                <td className="py-2.5 px-3 font-medium text-txt">
                  {s.name}
                </td>
                <td
                  className={`py-2.5 px-3 text-right font-mono font-semibold ${
                    s.delta > 0 ? "text-loss" : "text-gain"
                  }`}
                >
                  {s.delta > 0 ? "+" : ""}
                  {s.delta.toFixed(3)}s
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-user">
                  {s.user_min_speed.toFixed(0)}
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-ref">
                  {s.ref_min_speed.toFixed(0)}
                </td>
                <td
                  className={`py-2.5 px-3 text-right font-mono ${
                    diff > 0 ? "text-loss" : "text-gain"
                  }`}
                >
                  {diff > 0 ? "-" : "+"}
                  {Math.abs(diff).toFixed(0)} kph
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
