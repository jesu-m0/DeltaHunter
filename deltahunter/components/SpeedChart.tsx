"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import {
  setupCanvas,
  clearCanvas,
  drawGrid,
  drawLine,
  drawFilledLine,
  drawSectorBands,
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
}

const HEIGHT = 220;

export default function SpeedChart({
  chart,
  sectors,
  activeSector,
  showUser,
  showRef,
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
    const userSpd = chart.user_speed.slice(i0, i1);
    const refSpd = chart.ref_speed.slice(i0, i1);

    const allSpd = [
      ...(showUser ? userSpd : []),
      ...(showRef ? refSpd : []),
    ];
    const yMax = Math.ceil((Math.max(...allSpd, 100) + 10) / 10) * 10;

    drawGrid(ctx, w, h, pad, xMin, xMax, 0, yMax, "Distance (m)", "Speed (kph)");
    drawSectorBands(ctx, sectors, activeSector, w, h, pad, xMin, xMax);

    if (showRef) {
      drawFilledLine(ctx, dist, refSpd, w, h, pad, xMin, xMax, 0, yMax, COLORS.ref, 0.08);
      drawLine(ctx, dist, refSpd, w, h, pad, xMin, xMax, 0, yMax, COLORS.ref, 1.5);
    }
    if (showUser) {
      drawFilledLine(ctx, dist, userSpd, w, h, pad, xMin, xMax, 0, yMax, COLORS.user, 0.08);
      drawLine(ctx, dist, userSpd, w, h, pad, xMin, xMax, 0, yMax, COLORS.user, 1.5);
    }

    // Hover tooltip
    if (hover && hover.x >= pad.left && hover.x <= w - pad.right) {
      const idx = findHoverIndex(dist, hover.x, w, pad, xMin, xMax);
      if (idx >= 0 && idx < dist.length) {
        // Crosshair
        const plotH = h - pad.top - pad.bottom;
        const px = pad.left + ((dist[idx] - xMin) / (xMax - xMin)) * (w - pad.left - pad.right);
        ctx.strokeStyle = COLORS.border;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(px, pad.top);
        ctx.lineTo(px, h - pad.bottom);
        ctx.stroke();
        ctx.setLineDash([]);

        const lines = [`${dist[idx].toFixed(0)}m`];
        if (showUser) lines.push(`You: ${userSpd[idx].toFixed(1)} kph`);
        if (showRef) lines.push(`Ref: ${refSpd[idx].toFixed(1)} kph`);
        if (showUser && showRef)
          lines.push(`Delta: ${(userSpd[idx] - refSpd[idx]).toFixed(1)} kph`);
        drawTooltip(ctx, hover.x, hover.y, lines, w, h);
      }
    }
  }, [chart, sectors, activeSector, showUser, showRef, hover, getRange]);

  useEffect(() => {
    draw();
    const handleResize = () => draw();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [draw]);

  return (
    <div ref={containerRef} className="w-full">
      <canvas
        ref={canvasRef}
        className="w-full"
        style={{ height: HEIGHT }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setHover({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }}
        onMouseLeave={() => setHover(null)}
      />
    </div>
  );
}
