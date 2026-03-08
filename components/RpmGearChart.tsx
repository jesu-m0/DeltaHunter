"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import {
  setupCanvas,
  clearCanvas,
  drawGrid,
  drawSectorBands,
  drawMarkerLine,
  drawTooltip,
  findHoverIndex,
  getSliceIndices,
  COLORS,
  DEFAULT_PADDING,
} from "@/lib/chartUtils";
import type { ChartData, SectorData } from "@/lib/types";

interface Props {
  chart: ChartData;
  sectors: SectorData[];
  activeSector: number | null;
  showUser: boolean;
  showRef: boolean;
  markerDist: number | null;
  onMarkerPlace: (dist: number | null) => void;
}

const HEIGHT = 180;

export default function RpmGearChart({
  chart,
  sectors,
  activeSector,
  showUser,
  showRef,
  markerDist,
  onMarkerPlace,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);

  const getRange = useCallback(() => {
    if (activeSector !== null) {
      const s = sectors.find((s) => s.id === activeSector);
      if (s) return { xMin: s.start - 80, xMax: s.end + 80 };
    }
    return {
      xMin: chart.dist[0] ?? 0,
      xMax: chart.dist[chart.dist.length - 1] ?? 1,
    };
  }, [chart, sectors, activeSector]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const w = container.clientWidth;
    const h = HEIGHT;
    const ctx = setupCanvas(canvas, w, h);
    const pad = { ...DEFAULT_PADDING, right: 56 };
    clearCanvas(ctx, w, h);

    const { xMin, xMax } = getRange();
    const [i0, i1] = getSliceIndices(chart.dist, xMin, xMax);
    const dist = chart.dist.slice(i0, i1);
    const userRpm = (chart.user_rpm ?? []).slice(i0, i1);
    const refRpm = (chart.ref_rpm ?? []).slice(i0, i1);
    const userGear = chart.user_gear.slice(i0, i1);
    const refGear = chart.ref_gear.slice(i0, i1);

    // Find RPM range
    let rpmMax = 8000;
    for (let i = 0; i < dist.length; i++) {
      if (showUser && userRpm[i] > rpmMax) rpmMax = userRpm[i];
      if (showRef && refRpm[i] > rpmMax) rpmMax = refRpm[i];
    }
    rpmMax = Math.ceil(rpmMax / 1000) * 1000;

    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;

    // Draw grid for RPM (left axis)
    drawGrid(ctx, w, h, pad, xMin, xMax, 0, rpmMax, "Distance (m)", "RPM", 6, 5);
    drawSectorBands(ctx, sectors, activeSector, w, h, pad, xMin, xMax);

    // Right axis labels for gear
    const maxGear = 8;
    ctx.fillStyle = COLORS.txtDim;
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = "left";
    for (let i = 0; i <= maxGear; i++) {
      const y = pad.top + plotH - (i / maxGear) * plotH;
      ctx.fillText(`G${i}`, w - pad.right + 6, y + 3);
    }

    // Right axis label
    ctx.font = '10px "Outfit", sans-serif';
    ctx.save();
    ctx.translate(w - 8, pad.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.fillText("Gear", 0, 0);
    ctx.restore();

    // Draw RPM lines
    const drawRpmLine = (data: number[], color: string) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < dist.length; i++) {
        const px = pad.left + ((dist[i] - xMin) / (xMax - xMin)) * plotW;
        const py = pad.top + plotH - (data[i] / rpmMax) * plotH;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    };

    // Draw gear as faded stepped lines
    const drawGearStepped = (data: number[], color: string) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.3;
      for (let i = 0; i < dist.length; i++) {
        const px = pad.left + ((dist[i] - xMin) / (xMax - xMin)) * plotW;
        const gear = Math.round(data[i]);
        const py = pad.top + plotH - (gear / maxGear) * plotH;
        if (i === 0) {
          ctx.moveTo(px, py);
        } else {
          const prevGear = Math.round(data[i - 1]);
          const prevPy = pad.top + plotH - (prevGear / maxGear) * plotH;
          ctx.lineTo(px, prevPy);
          ctx.lineTo(px, py);
        }
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    if (showRef) {
      drawGearStepped(refGear, COLORS.ref);
      drawRpmLine(refRpm, COLORS.ref);
    }
    if (showUser) {
      drawGearStepped(userGear, COLORS.user);
      drawRpmLine(userRpm, COLORS.user);
    }

    // Highlight shift points (gear changes) with dots
    const drawShiftPoints = (gearData: number[], rpmData: number[], color: string) => {
      for (let i = 1; i < dist.length; i++) {
        const g0 = Math.round(gearData[i - 1]);
        const g1 = Math.round(gearData[i]);
        if (g1 !== g0 && g1 > g0) {
          // Upshift — mark the RPM at shift point
          const px = pad.left + ((dist[i] - xMin) / (xMax - xMin)) * plotW;
          const py = pad.top + plotH - (rpmData[i - 1] / rpmMax) * plotH;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    if (showRef) drawShiftPoints(refGear, refRpm, COLORS.ref);
    if (showUser) drawShiftPoints(userGear, userRpm, COLORS.user);

    if (markerDist !== null) drawMarkerLine(ctx, markerDist, w, h, pad, xMin, xMax);

    if (hover && hover.x >= pad.left && hover.x <= w - pad.right) {
      const idx = findHoverIndex(dist, hover.x, w, pad, xMin, xMax);
      if (idx >= 0 && idx < dist.length) {
        const px = pad.left + ((dist[idx] - xMin) / (xMax - xMin)) * plotW;
        ctx.strokeStyle = COLORS.border;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(px, pad.top);
        ctx.lineTo(px, h - pad.bottom);
        ctx.stroke();
        ctx.setLineDash([]);

        const lines = [`${dist[idx].toFixed(0)}m`];
        if (showUser) lines.push(`You: ${Math.round(userRpm[idx])} RPM G${Math.round(userGear[idx])}`);
        if (showRef) lines.push(`Ref: ${Math.round(refRpm[idx])} RPM G${Math.round(refGear[idx])}`);
        drawTooltip(ctx, hover.x, hover.y, lines, w, h);
      }
    }
  }, [chart, sectors, activeSector, showUser, showRef, hover, markerDist, getRange]);

  useEffect(() => {
    draw();
    const handleResize = () => draw();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [draw]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const pad = { ...DEFAULT_PADDING, right: 56 };
      const w = rect.width;
      if (mx < pad.left || mx > w - pad.right) return;
      const { xMin, xMax } = getRange();
      const [i0, i1] = getSliceIndices(chart.dist, xMin, xMax);
      const dist = chart.dist.slice(i0, i1);
      const idx = findHoverIndex(dist, mx, w, pad, xMin, xMax);
      if (idx >= 0 && idx < dist.length) {
        const d = dist[idx];
        onMarkerPlace(markerDist !== null && Math.abs(markerDist - d) < 12 ? null : d);
      }
    },
    [chart, getRange, markerDist, onMarkerPlace]
  );

  // Check if RPM data is meaningful
  const hasRpm = chart.user_rpm?.some((v) => v > 0) || chart.ref_rpm?.some((v) => v > 0);
  if (!hasRpm) return null;

  return (
    <div ref={containerRef} className="w-full">
      <canvas
        ref={canvasRef}
        className="w-full cursor-crosshair"
        style={{ height: HEIGHT }}
        onClick={handleClick}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setHover({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }}
        onMouseLeave={() => setHover(null)}
      />
      <div className="flex gap-4 mt-1 px-2 text-[10px] text-txt-dim">
        <span>Solid line = RPM &middot; Faded stepped line = Gear &middot; Dots = upshift points</span>
      </div>
    </div>
  );
}
