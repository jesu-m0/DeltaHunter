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

const HEIGHT = 160;

export default function GearChart({
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
    const pad = DEFAULT_PADDING;
    clearCanvas(ctx, w, h);

    const { xMin, xMax } = getRange();
    const [i0, i1] = getSliceIndices(chart.dist, xMin, xMax);
    const dist = chart.dist.slice(i0, i1);
    const userGear = chart.user_gear.slice(i0, i1);
    const refGear = chart.ref_gear.slice(i0, i1);

    const maxGear = 8;
    drawGrid(ctx, w, h, pad, xMin, xMax, 0, maxGear, "Distance (m)", "Gear", 6, maxGear);
    drawSectorBands(ctx, sectors, activeSector, w, h, pad, xMin, xMax);

    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;

    // Draw gear as stepped lines (floor values)
    const drawStepped = (data: number[], color: string, lineWidth: number) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      let started = false;
      for (let i = 0; i < dist.length; i++) {
        const px = pad.left + ((dist[i] - xMin) / (xMax - xMin)) * plotW;
        const gear = Math.round(data[i]);
        const py = pad.top + plotH - (gear / maxGear) * plotH;
        if (!started) {
          ctx.moveTo(px, py);
          started = true;
        } else {
          // Stepped: horizontal then vertical
          const prevGear = Math.round(data[i - 1]);
          const prevPy = pad.top + plotH - (prevGear / maxGear) * plotH;
          ctx.lineTo(px, prevPy);
          ctx.lineTo(px, py);
        }
      }
      ctx.stroke();
    };

    if (showRef) drawStepped(refGear, COLORS.ref, 1.5);
    if (showUser) drawStepped(userGear, COLORS.user, 1.5);

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
        if (showUser) lines.push(`You: G${Math.round(userGear[idx])}`);
        if (showRef) lines.push(`Ref: G${Math.round(refGear[idx])}`);
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
      const pad = DEFAULT_PADDING;
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
    </div>
  );
}
