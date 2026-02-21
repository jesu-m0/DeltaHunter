"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAnalysisStore } from "@/lib/store";
import OverviewMap from "@/components/OverviewMap";
import SectorTable from "@/components/SectorTable";
import SectorButtons from "@/components/SectorButtons";
import SectorDetail from "@/components/SectorDetail";
import SpeedChart from "@/components/SpeedChart";
import DeltaChart from "@/components/DeltaChart";
import ThrottleChart from "@/components/ThrottleChart";
import BrakeChart from "@/components/BrakeChart";
import DriverToggle from "@/components/DriverToggle";
import Findings from "@/components/Findings";

function formatLapTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toFixed(3).padStart(6, "0")}`;
}

export default function AnalysisPage() {
  const router = useRouter();
  const data = useAnalysisStore((s) => s.data);
  const activeSector = useAnalysisStore((s) => s.activeSector);
  const showUser = useAnalysisStore((s) => s.showUser);
  const showRef = useAnalysisStore((s) => s.showRef);
  const setActiveSector = useAnalysisStore((s) => s.setActiveSector);
  const setShowUser = useAnalysisStore((s) => s.setShowUser);
  const setShowRef = useAnalysisStore((s) => s.setShowRef);

  useEffect(() => {
    if (!data) router.replace("/");
  }, [data, router]);

  if (!data) return null;

  const { meta, chart, hd, sectors } = data;
  const activeSectorData = sectors.find((s) => s.id === activeSector) ?? null;

  return (
    <main className="min-h-screen bg-bg">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push("/")}
            className="text-xl font-bold tracking-tight hover:opacity-80 transition-opacity"
          >
            <span className="text-user">Delta</span>
            <span className="text-txt">Hunter</span>
          </button>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-xs text-txt-dim">
                {meta.circuit_name || meta.track}
              </div>
              <div className="text-xs text-txt-dim">{meta.car}</div>
            </div>
            <div className="flex gap-4">
              <div className="text-right">
                <div className="text-[10px] uppercase text-user/70">
                  {meta.user_driver}
                </div>
                <div className="font-mono text-sm font-semibold text-user">
                  {formatLapTime(meta.user_lap_time)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase text-ref/70">
                  {meta.ref_driver}
                </div>
                <div className="font-mono text-sm font-semibold text-ref">
                  {formatLapTime(meta.ref_lap_time)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase text-txt-dim">Delta</div>
                <div
                  className={`font-mono text-sm font-semibold ${
                    meta.total_delta > 0 ? "text-loss" : "text-gain"
                  }`}
                >
                  {meta.total_delta > 0 ? "+" : ""}
                  {meta.total_delta.toFixed(3)}s
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Top section: Map + Sectors */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-surface rounded-xl border border-border p-4">
            <h2 className="text-sm font-semibold text-txt-dim uppercase tracking-wider mb-3">
              Circuit overview
            </h2>
            <OverviewMap
              chart={chart}
              sectors={sectors}
              activeSector={activeSector}
              onSectorSelect={setActiveSector}
            />
          </div>
          <div className="bg-surface rounded-xl border border-border p-4">
            <h2 className="text-sm font-semibold text-txt-dim uppercase tracking-wider mb-3">
              Time loss by sector
            </h2>
            <SectorTable
              sectors={sectors}
              activeSector={activeSector}
              onSectorSelect={setActiveSector}
            />
          </div>
        </div>

        {/* Sector detail panel */}
        {activeSectorData && (
          <SectorDetail
            sector={activeSectorData}
            hd={hd}
            showUser={showUser}
            showRef={showRef}
            userLabel={meta.user_driver}
            refLabel={meta.ref_driver}
            onToggleUser={() => setShowUser(!showUser)}
            onToggleRef={() => setShowRef(!showRef)}
            onClose={() => setActiveSector(null)}
          />
        )}

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <SectorButtons
            sectors={sectors}
            activeSector={activeSector}
            onSectorSelect={setActiveSector}
          />
          <DriverToggle
            showUser={showUser}
            showRef={showRef}
            userLabel={meta.user_driver}
            refLabel={meta.ref_driver}
            onToggleUser={() => setShowUser(!showUser)}
            onToggleRef={() => setShowRef(!showRef)}
          />
        </div>

        {/* Charts */}
        <div className="space-y-4">
          <div className="bg-surface rounded-xl border border-border p-4">
            <h2 className="text-xs font-semibold text-txt-dim uppercase tracking-wider mb-2">
              Speed
            </h2>
            <SpeedChart
              chart={chart}
              sectors={sectors}
              activeSector={activeSector}
              showUser={showUser}
              showRef={showRef}
            />
          </div>

          <div className="bg-surface rounded-xl border border-border p-4">
            <h2 className="text-xs font-semibold text-txt-dim uppercase tracking-wider mb-2">
              Time delta
            </h2>
            <DeltaChart
              chart={chart}
              sectors={sectors}
              activeSector={activeSector}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-surface rounded-xl border border-border p-4">
              <h2 className="text-xs font-semibold text-txt-dim uppercase tracking-wider mb-2">
                Throttle
              </h2>
              <ThrottleChart
                chart={chart}
                sectors={sectors}
                activeSector={activeSector}
                showUser={showUser}
                showRef={showRef}
              />
            </div>
            <div className="bg-surface rounded-xl border border-border p-4">
              <h2 className="text-xs font-semibold text-txt-dim uppercase tracking-wider mb-2">
                Brake
              </h2>
              <BrakeChart
                chart={chart}
                sectors={sectors}
                activeSector={activeSector}
                showUser={showUser}
                showRef={showRef}
              />
            </div>
          </div>
        </div>

        {/* Findings */}
        <div className="bg-surface rounded-xl border border-border p-5">
          <Findings sectors={sectors} />
        </div>

        {/* Footer */}
        <div className="text-center text-txt-dim/40 text-xs py-4">
          DeltaHunter — Telemetry comparison for sim racing
        </div>
      </div>
    </main>
  );
}
