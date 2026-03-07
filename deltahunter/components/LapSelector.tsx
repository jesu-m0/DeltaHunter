"use client";

import type { ParsedSession } from "@/lib/types";

interface Props {
  label: string;
  color: "user" | "ref";
  session: ParsedSession;
  selectedIndex: number;
  onChange: (index: number) => void;
  disabled?: boolean;
}

function formatLapTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toFixed(3).padStart(6, "0")}`;
}

export default function LapSelector({
  label,
  color,
  session,
  selectedIndex,
  onChange,
  disabled,
}: Props) {
  const colorClass = color === "user" ? "text-user" : "text-ref";
  const borderClass = color === "user" ? "border-user/30" : "border-ref/30";

  return (
    <div className="flex items-center gap-2">
      <span className={`text-[10px] uppercase tracking-wider ${colorClass}`}>
        {label}
      </span>
      <select
        value={selectedIndex}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className={`bg-surface2 border ${borderClass} rounded-md px-2 py-1 text-xs font-mono text-txt
          focus:outline-none focus:ring-1 focus:ring-user/50 disabled:opacity-50 cursor-pointer`}
      >
        {session.laps.map((lap, i) => (
          <option key={i} value={i}>
            Lap {lap.lap_number} — {formatLapTime(lap.lap_time)}
            {lap.is_best ? " ★" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
