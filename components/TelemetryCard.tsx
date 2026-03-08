"use client";

import type { ChartData } from "@/lib/types";
import { useMemo } from "react";

interface Props {
  chart: ChartData;
  markerDist: number | null;
  showUser: boolean;
  showRef: boolean;
  userLabel: string;
  refLabel: string;
}

function findIndex(dist: number[], target: number): number {
  let closest = 0;
  let minD = Infinity;
  for (let i = 0; i < dist.length; i++) {
    const d = Math.abs(dist[i] - target);
    if (d < minD) {
      minD = d;
      closest = i;
    }
  }
  return closest;
}

interface DriverState {
  speed: number;
  throttle: number;
  brake: number;
  gear: number;
  steering: number;
  rpm: number;
  fuel: number;
  gLat: number;
  gLon: number;
  abs: number;
  tc: number;
}

function Gauge({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-txt-dim w-8 text-right">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-surface2 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-150 ease-out" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[10px] font-mono text-txt w-10 text-right tabular-nums">{value.toFixed(0)}{label === "Fuel" ? "L" : "%"}</span>
    </div>
  );
}

function DriverCard({ state, label, color }: { state: DriverState; label: string; color: string }) {
  const hasRpm = state.rpm > 0;
  const hasFuel = state.fuel > 0;
  const hasG = state.gLat !== 0 || state.gLon !== 0;

  return (
    <div className="flex-1 min-w-[200px]">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-xs font-semibold text-txt">{label}</span>
        <span className="ml-auto font-mono text-sm font-bold text-txt tabular-nums">{state.speed.toFixed(0)} kph</span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {/* Left column: inputs */}
        <div className="space-y-1">
          <Gauge label="Thr" value={state.throttle} max={100} color="#00cc88" />
          <Gauge label="Brk" value={state.brake} max={100} color="#ff3355" />
        </div>

        {/* Right column: state */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-txt-dim">Gear</span>
            <span className="font-mono text-sm font-bold text-txt tabular-nums">G{Math.round(state.gear)}</span>
          </div>
          {hasRpm && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-txt-dim">RPM</span>
              <span className="font-mono text-xs text-txt tabular-nums">{Math.round(state.rpm)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Steering */}
      <div className="mt-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-txt-dim w-8 text-right">Steer</span>
          <div className="flex-1 h-2 rounded-full bg-surface2 overflow-hidden relative">
            <div className="absolute top-0 bottom-0 w-px bg-txt-dim/30" style={{ left: "50%" }} />
            <div
              className="absolute top-0 h-full rounded-full transition-all duration-150 ease-out"
              style={{
                backgroundColor: color,
                opacity: 0.7,
                left: state.steering >= 0 ? "50%" : `${50 + (state.steering / 180) * 50}%`,
                width: `${Math.abs(state.steering / 180) * 50}%`,
              }}
            />
          </div>
          <span className="text-[10px] font-mono text-txt w-10 text-right tabular-nums">{state.steering.toFixed(0)}&deg;</span>
        </div>
      </div>

      {/* Extra data row */}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {hasFuel && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-txt-dim">Fuel</span>
            <span className="font-mono text-[10px] text-txt tabular-nums">{state.fuel.toFixed(1)}L</span>
          </div>
        )}
        {hasG && (
          <>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-txt-dim">G-Lat</span>
              <span className="font-mono text-[10px] text-txt tabular-nums">{state.gLat.toFixed(2)}g</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-txt-dim">G-Lon</span>
              <span className="font-mono text-[10px] text-txt tabular-nums">{state.gLon.toFixed(2)}g</span>
            </div>
          </>
        )}
        {state.abs > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-loss font-semibold">ABS</span>
          </div>
        )}
        {state.tc > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-loss font-semibold">TC</span>
          </div>
        )}
      </div>

      {/* G-Force mini diagram */}
      {hasG && <GForceDot gLat={state.gLat} gLon={state.gLon} color={color} />}
    </div>
  );
}

function GForceDot({ gLat, gLon, color }: { gLat: number; gLon: number; color: string }) {
  const size = 48;
  const maxG = 2.5;
  const cx = size / 2;
  const cy = size / 2;
  const px = cx + (gLat / maxG) * (size / 2 - 4);
  const py = cy - (gLon / maxG) * (size / 2 - 4);

  return (
    <div className="mt-1 flex justify-center">
      <svg width={size} height={size} className="opacity-80">
        <circle cx={cx} cy={cy} r={size / 2 - 2} fill="none" stroke="rgba(106,114,136,0.3)" strokeWidth={1} />
        <line x1={cx} y1={2} x2={cx} y2={size - 2} stroke="rgba(106,114,136,0.15)" strokeWidth={1} />
        <line x1={2} y1={cy} x2={size - 2} y2={cy} stroke="rgba(106,114,136,0.15)" strokeWidth={1} />
        <circle cx={px} cy={py} r={4} fill={color} style={{ transition: "cx 150ms ease-out, cy 150ms ease-out" }} />
      </svg>
    </div>
  );
}

export default function TelemetryCard({
  chart,
  markerDist,
  showUser,
  showRef,
  userLabel,
  refLabel,
}: Props) {
  const data = useMemo(() => {
    if (markerDist === null) return null;
    const idx = findIndex(chart.dist, markerDist);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v = (key: string) => (chart as any)[key]?.[idx] ?? 0;
    const extract = (prefix: "user" | "ref"): DriverState => ({
      speed: v(`${prefix}_speed`),
      throttle: v(`${prefix}_throttle`),
      brake: v(`${prefix}_brake`),
      gear: v(`${prefix}_gear`),
      steering: v(`${prefix}_steering`),
      rpm: v(`${prefix}_rpm`),
      fuel: v(`${prefix}_fuel`),
      gLat: v(`${prefix}_g_lat`),
      gLon: v(`${prefix}_g_lon`),
      abs: v(`${prefix}_abs`),
      tc: v(`${prefix}_tc`),
    });

    return {
      dist: chart.dist[idx],
      delta: chart.time_delta[idx],
      user: extract("user"),
      ref: extract("ref"),
    };
  }, [chart, markerDist]);

  if (!data) return null;

  return (
    <div className="bg-surface rounded-xl border border-border p-4 animate-in fade-in duration-200">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-txt-dim uppercase tracking-wider">
          Telemetry at {data.dist.toFixed(0)}m
        </h3>
        <span className={`font-mono text-xs font-semibold tabular-nums transition-colors duration-150 ${data.delta > 0 ? "text-loss" : "text-gain"}`}>
          {data.delta > 0 ? "+" : ""}{data.delta.toFixed(3)}s
        </span>
      </div>
      <div className="flex gap-6 flex-wrap">
        {showUser && <DriverCard state={data.user} label={userLabel} color="#4499ff" />}
        {showRef && <DriverCard state={data.ref} label={refLabel} color="#ff6633" />}
      </div>
    </div>
  );
}
