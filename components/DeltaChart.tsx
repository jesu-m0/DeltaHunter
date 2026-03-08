"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import {
  setupCanvas,
  clearCanvas,
  drawGrid,
  drawLine,
  drawFilledLine,
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
  markerDist: number | null;
  onMarkerPlace: (dist: number | null) => void;
}

const HEIGHT = 160;

export default function DeltaChart({ chart, sectors, activeSector, markerDist, onMarkerPlace }: Props) {
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
    const delta = chart.time_delta.slice(i0, i1);

    const absMax = Math.max(Math.abs(Math.min(...delta)), Math.abs(Math.max(...delta)), 0.1);
    const yBound = Math.ceil(absMax * 10) / 10 + 0.1;

    drawGrid(ctx, w, h, pad, xMin, xMax, -yBound, yBound, "Distance (m)", "Delta (s)", 6, 4);
    drawSectorBands(ctx, sectors, activeSector, w, h, pad, xMin, xMax);

    // Zero line
    const plotH = h - pad.top - pad.bottom;
    const zeroY = pad.top + plotH * (yBound / (2 * yBound));
    ctx.strokeStyle = COLORS.txtDim;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pad.left, zeroY);
    ctx.lineTo(w - pad.right, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    drawFilledLine(ctx, dist, delta, w, h, pad, xMin, xMax, -yBound, yBound, COLORS.loss, 0.12);
    drawLine(ctx, dist, delta, w, h, pad, xMin, xMax, -yBound, yBound, COLORS.loss, 1.5);

    if (markerDist !== null) drawMarkerLine(ctx, markerDist, w, h, pad, xMin, xMax);

    if (hover && hover.x >= pad.left && hover.x <= w - pad.right) {
      const idx = findHoverIndex(dist, hover.x, w, pad, xMin, xMax);
      if (idx >= 0 && idx < dist.length) {
        const px = pad.left + ((dist[idx] - xMin) / (xMax - xMin)) * (w - pad.left - pad.right);
        ctx.strokeStyle = COLORS.border;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(px, pad.top);
        ctx.lineTo(px, h - pad.bottom);
        ctx.stroke();
        ctx.setLineDash([]);

        const d = delta[idx];
        drawTooltip(
          ctx,
          hover.x,
          hover.y,
          [
            `${dist[idx].toFixed(0)}m`,
            `Delta: ${d > 0 ? "+" : ""}${d.toFixed(3)}s`,
          ],
          w,
          h
        );
      }
    }
  }, [chart, sectors, activeSector, hover, markerDist, getRange]);

  useEffect(() => {
    draw();
    const handleResize = () => draw();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [draw]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
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
  }, [chart, getRange, markerDist, onMarkerPlace]);

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
