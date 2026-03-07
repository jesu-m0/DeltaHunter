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
  hexToRgba,
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

const HEIGHT = 200;
const STEER_COLOR_USER = "#66bbff";
const STEER_COLOR_REF = "#ffaa66";

export default function TrailBrakeChart({
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
    const userBrk = chart.user_brake.slice(i0, i1);
    const refBrk = chart.ref_brake.slice(i0, i1);
    const userStr = chart.user_steering?.slice(i0, i1) ?? [];
    const refStr = chart.ref_steering?.slice(i0, i1) ?? [];

    // Normalize steering to 0-100 range for display (abs value, max ~180 deg)
    const maxSteer = 180;
    const normUser = userStr.map((v) => Math.min(Math.abs(v) / maxSteer * 100, 100));
    const normRef = refStr.map((v) => Math.min(Math.abs(v) / maxSteer * 100, 100));

    drawGrid(ctx, w, h, pad, xMin, xMax, 0, 100, "Distance (m)", "%", 6, 4);
    drawSectorBands(ctx, sectors, activeSector, w, h, pad, xMin, xMax);

    // Draw trail braking overlap zones (where brake > 5% AND |steering| > 5 deg)
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;

    if (showUser && userStr.length === dist.length) {
      for (let i = 0; i < dist.length; i++) {
        if (userBrk[i] > 5 && Math.abs(userStr[i]) > 5) {
          const px = pad.left + ((dist[i] - xMin) / (xMax - xMin)) * plotW;
          const step = plotW / dist.length;
          ctx.fillStyle = hexToRgba(COLORS.user, 0.12);
          ctx.fillRect(px - step / 2, pad.top, step, plotH);
        }
      }
    }
    if (showRef && refStr.length === dist.length) {
      for (let i = 0; i < dist.length; i++) {
        if (refBrk[i] > 5 && Math.abs(refStr[i]) > 5) {
          const px = pad.left + ((dist[i] - xMin) / (xMax - xMin)) * plotW;
          const step = plotW / dist.length;
          ctx.fillStyle = hexToRgba(COLORS.ref, 0.08);
          ctx.fillRect(px - step / 2, pad.top, step, plotH);
        }
      }
    }

    // Draw brake lines
    if (showRef) {
      drawLine(ctx, dist, refBrk, w, h, pad, xMin, xMax, 0, 100, COLORS.ref, 1.5);
    }
    if (showUser) {
      drawLine(ctx, dist, userBrk, w, h, pad, xMin, xMax, 0, 100, COLORS.user, 1.5);
    }

    // Draw steering lines (dashed)
    if (showRef && normRef.length > 0) {
      ctx.setLineDash([4, 3]);
      drawLine(ctx, dist, normRef, w, h, pad, xMin, xMax, 0, 100, STEER_COLOR_REF, 1);
      ctx.setLineDash([]);
    }
    if (showUser && normUser.length > 0) {
      ctx.setLineDash([4, 3]);
      drawLine(ctx, dist, normUser, w, h, pad, xMin, xMax, 0, 100, STEER_COLOR_USER, 1);
      ctx.setLineDash([]);
    }

    // Legend
    const legendY = pad.top + 10;
    const legendX = pad.left + 8;
    ctx.font = '9px "Outfit", sans-serif';

    ctx.strokeStyle = COLORS.user;
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(legendX, legendY); ctx.lineTo(legendX + 16, legendY); ctx.stroke();
    ctx.fillStyle = COLORS.txtDim;
    ctx.textAlign = "left";
    ctx.fillText("Brake", legendX + 20, legendY + 3);

    ctx.strokeStyle = STEER_COLOR_USER;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(legendX + 60, legendY); ctx.lineTo(legendX + 76, legendY); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillText("|Steering|", legendX + 80, legendY + 3);

    ctx.fillStyle = hexToRgba(COLORS.user, 0.25);
    ctx.fillRect(legendX + 140, legendY - 5, 10, 10);
    ctx.fillStyle = COLORS.txtDim;
    ctx.fillText("Trail zone", legendX + 154, legendY + 3);

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
        if (showUser) {
          lines.push(`You Brk: ${userBrk[idx]?.toFixed(0) ?? 0}%`);
          if (userStr.length > idx) lines.push(`You Str: ${userStr[idx]?.toFixed(0) ?? 0}°`);
        }
        if (showRef) {
          lines.push(`Ref Brk: ${refBrk[idx]?.toFixed(0) ?? 0}%`);
          if (refStr.length > idx) lines.push(`Ref Str: ${refStr[idx]?.toFixed(0) ?? 0}°`);
        }
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
