"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAnalysisStore } from "@/lib/store";
import ChartCard from "@/components/ChartCard";
import OverviewMap from "@/components/OverviewMap";
import SectorTable from "@/components/SectorTable";
import SectorButtons from "@/components/SectorButtons";
import SectorDetail from "@/components/SectorDetail";
import SpeedChart from "@/components/SpeedChart";
import DeltaChart from "@/components/DeltaChart";
import ThrottleChart from "@/components/ThrottleChart";
import BrakeChart from "@/components/BrakeChart";
import TrailBrakeChart from "@/components/TrailBrakeChart";
import GearChart from "@/components/GearChart";
import RpmGearChart from "@/components/RpmGearChart";
import TelemetryCard from "@/components/TelemetryCard";
import ControlDock from "@/components/ControlDock";
import LapSelector from "@/components/LapSelector";
import Findings from "@/components/Findings";
import TopLosses from "@/components/TopLosses";
import SessionStats from "@/components/SessionStats";

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
  const markerDist = useAnalysisStore((s) => s.markerDist);
  const setMarkerDist = useAnalysisStore((s) => s.setMarkerDist);
  const parsedUser = useAnalysisStore((s) => s.parsedUser);
  const parsedRef = useAnalysisStore((s) => s.parsedRef);
  const userLapIndex = useAnalysisStore((s) => s.userLapIndex);
  const refLapIndex = useAnalysisStore((s) => s.refLapIndex);
  const setUserLapIndex = useAnalysisStore((s) => s.setUserLapIndex);
  const setRefLapIndex = useAnalysisStore((s) => s.setRefLapIndex);
  const recompare = useAnalysisStore((s) => s.recompare);
  const comparing = useAnalysisStore((s) => s.comparing);
  const compareError = useAnalysisStore((s) => s.error);

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
        <div className="max-w-[1600px] mx-auto px-4 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-y-2">
          <button
            onClick={() => router.push("/")}
            className="text-xl font-bold tracking-tight hover:opacity-80 transition-opacity"
          >
            <span className="text-user">Delta</span>
            <span className="text-txt">Hunter</span>
          </button>

          <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-3 sm:gap-6">
            <div className="text-left sm:text-right min-w-0">
              <div className="text-xs text-txt-dim truncate">
                {meta.circuit_name || meta.track}
              </div>
              <div className="text-xs text-txt-dim truncate">{meta.car}</div>
            </div>
            <div className="flex gap-3 sm:gap-4 shrink-0">
              <div className="text-right">
                <div className="text-[10px] uppercase text-user/70 truncate max-w-[80px] sm:max-w-none">
                  {meta.user_driver}
                </div>
                <div className="font-mono text-sm font-semibold text-user">
                  {formatLapTime(meta.user_lap_time)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase text-ref/70 truncate max-w-[80px] sm:max-w-none">
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

      <div className="max-w-[1600px] mx-auto px-4 py-6 space-y-6 pb-44 sm:pb-24">
        {/* Prioritized time losses */}
        <TopLosses
          sectors={sectors}
          activeSector={activeSector}
          onSectorSelect={setActiveSector}
        />

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
              markerDist={markerDist}
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
            markerDist={markerDist}
            onMarkerPlace={setMarkerDist}
          />
        )}

        {/* Lap selectors */}
        {parsedUser && parsedRef && (parsedUser.laps.length > 1 || parsedRef.laps.length > 1) ? (
          <div className="bg-surface rounded-xl border border-border p-4 flex flex-wrap items-center gap-4">
            <span className="text-xs text-txt-dim uppercase tracking-wider font-semibold">Lap</span>
            {parsedUser && (
              <LapSelector
                label={meta.user_driver}
                color="user"
                session={parsedUser}
                selectedIndex={userLapIndex >= 0 ? userLapIndex : parsedUser.best_index}
                onChange={(i) => { setUserLapIndex(i); }}
                disabled={comparing}
              />
            )}
            {parsedRef && (
              <LapSelector
                label={meta.ref_driver}
                color="ref"
                session={parsedRef}
                selectedIndex={refLapIndex >= 0 ? refLapIndex : parsedRef.best_index}
                onChange={(i) => { setRefLapIndex(i); }}
                disabled={comparing}
              />
            )}
            <button
              onClick={() => recompare()}
              disabled={comparing}
              className="ml-auto px-4 py-1.5 rounded-lg bg-user/20 text-user text-xs font-semibold
                hover:bg-user/30 transition-colors disabled:opacity-50"
            >
              {comparing ? "Comparing..." : "Compare"}
            </button>
            {compareError && (
              <p className="w-full text-xs text-loss">{compareError}</p>
            )}
          </div>
        ) : null}

        {/* Session stats: consistency + theoretical best */}
        {parsedUser && parsedRef && (parsedUser.laps.length > 1 || parsedRef.laps.length > 1) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-surface rounded-xl border border-border p-4">
              <SessionStats
                session={parsedUser}
                label={meta.user_driver}
                color="user"
                selectedIndex={userLapIndex >= 0 ? userLapIndex : parsedUser.best_index}
                onSelectLap={setUserLapIndex}
                disabled={comparing}
              />
            </div>
            <div className="bg-surface rounded-xl border border-border p-4">
              <SessionStats
                session={parsedRef}
                label={meta.ref_driver}
                color="ref"
                selectedIndex={refLapIndex >= 0 ? refLapIndex : parsedRef.best_index}
                onSelectLap={setRefLapIndex}
                disabled={comparing}
              />
            </div>
          </div>
        )}

        {/* Sector selector */}
        <SectorButtons
          sectors={sectors}
          activeSector={activeSector}
          onSectorSelect={setActiveSector}
        />

        {/* Live telemetry card */}
        {markerDist !== null && (
          <TelemetryCard
            chart={chart}
            markerDist={markerDist}
            showUser={showUser}
            showRef={showRef}
            userLabel={meta.user_driver}
            refLabel={meta.ref_driver}
          />
        )}

        {/* Charts */}
        <div className="space-y-4">
          <ChartCard title="Speed" defaultHeight={220} storageKey="speed">
            <SpeedChart
              chart={chart}
              sectors={sectors}
              activeSector={activeSector}
              showUser={showUser}
              showRef={showRef}
              markerDist={markerDist}
              onMarkerPlace={setMarkerDist}
            />
          </ChartCard>

          <ChartCard title="Time delta" defaultHeight={160} storageKey="delta">
            <DeltaChart
              chart={chart}
              sectors={sectors}
              activeSector={activeSector}
              markerDist={markerDist}
              onMarkerPlace={setMarkerDist}
            />
          </ChartCard>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
            <ChartCard title="Gear" defaultHeight={160} storageKey="gear">
              <GearChart
                chart={chart}
                sectors={sectors}
                activeSector={activeSector}
                showUser={showUser}
                showRef={showRef}
                markerDist={markerDist}
                onMarkerPlace={setMarkerDist}
              />
            </ChartCard>

            <ChartCard
              title="RPM & Gear"
              description="RPM trace with gear overlay. Dots mark upshift points — compare shift RPM to find optimal shift timing."
              defaultHeight={180}
              storageKey="rpmgear"
            >
              <RpmGearChart
                chart={chart}
                sectors={sectors}
                activeSector={activeSector}
                showUser={showUser}
                showRef={showRef}
                markerDist={markerDist}
                onMarkerPlace={setMarkerDist}
              />
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <ChartCard title="Throttle" defaultHeight={160} storageKey="throttle">
              <ThrottleChart
                chart={chart}
                sectors={sectors}
                activeSector={activeSector}
                showUser={showUser}
                showRef={showRef}
                markerDist={markerDist}
                onMarkerPlace={setMarkerDist}
              />
            </ChartCard>
            <ChartCard title="Brake" defaultHeight={160} storageKey="brake">
              <BrakeChart
                chart={chart}
                sectors={sectors}
                activeSector={activeSector}
                showUser={showUser}
                showRef={showRef}
                markerDist={markerDist}
                onMarkerPlace={setMarkerDist}
              />
            </ChartCard>
          </div>

          <ChartCard
            title="Trail braking"
            description="Solid line = brake %, dashed line = steering angle. Shaded zones = trail braking (braking while turning). More trail braking usually means better corner entry speed."
            defaultHeight={240}
            storageKey="trailbrake"
          >
            <TrailBrakeChart
              chart={chart}
              sectors={sectors}
              activeSector={activeSector}
              showUser={showUser}
              showRef={showRef}
              markerDist={markerDist}
              onMarkerPlace={setMarkerDist}
            />
          </ChartCard>
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

      <ControlDock
        chart={chart}
        markerDist={markerDist}
        onMarkerPlace={setMarkerDist}
        userLabel={meta.user_driver}
        refLabel={meta.ref_driver}
      />
    </main>
  );
}
