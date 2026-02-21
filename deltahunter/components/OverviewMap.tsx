"use client";

import { useRef, useEffect, useCallback } from "react";
import { setupCanvas, clearCanvas, COLORS, hexToRgba } from "@/lib/chartUtils";
import type { ChartData, SectorData } from "@/lib/types";

interface Props {
  chart: ChartData;
  sectors: SectorData[];
  activeSector: number | null;
  onSectorSelect: (id: number | null) => void;
}

export default function OverviewMap({
  chart,
  sectors,
  activeSector,
  onSectorSelect,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const w = container.clientWidth;
    const h = 360;
    const ctx = setupCanvas(canvas, w, h);
    clearCanvas(ctx, w, h);

    const { map_x, map_y, dist } = chart;
    if (map_x.length < 2) return;

    const pad = 40;
    const minX = Math.min(...map_x);
    const maxX = Math.max(...map_x);
    const minY = Math.min(...map_y);
    const maxY = Math.max(...map_y);
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const scale = Math.min((w - pad * 2) / rangeX, (h - pad * 2) / rangeY);
    const offX = (w - rangeX * scale) / 2;
    const offY = (h - rangeY * scale) / 2;

    const toScreen = (x: number, y: number): [number, number] => [
      offX + (x - minX) * scale,
      offY + (maxY - y) * scale,
    ];

    // Find which sector each point belongs to
    const sectorOf = new Array(dist.length).fill(-1);
    for (const s of sectors) {
      for (let i = 0; i < dist.length; i++) {
        if (dist[i] >= s.start && dist[i] <= s.end) {
          sectorOf[i] = s.id;
        }
      }
    }

    // Draw base track (dim)
    ctx.beginPath();
    ctx.strokeStyle = hexToRgba(COLORS.txt, 0.08);
    ctx.lineWidth = 6;
    ctx.lineJoin = "round";
    for (let i = 0; i < map_x.length; i++) {
      const [sx, sy] = toScreen(map_x[i], map_y[i]);
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();

    // Draw sectors colored by delta intensity
    const maxDelta = Math.max(...sectors.map((s) => Math.abs(s.delta)), 0.01);
    for (const s of sectors) {
      const isActive = activeSector === s.id;
      const intensity = Math.min(1, Math.abs(s.delta) / maxDelta);

      ctx.beginPath();
      ctx.lineWidth = isActive ? 5 : 3.5;

      if (isActive) {
        ctx.strokeStyle = "#ffffff";
      } else if (activeSector !== null) {
        ctx.strokeStyle = hexToRgba(
          s.delta > 0 ? COLORS.loss : COLORS.gain,
          0.25
        );
      } else {
        const alpha = 0.3 + intensity * 0.7;
        ctx.strokeStyle = hexToRgba(
          s.delta > 0 ? COLORS.loss : COLORS.gain,
          alpha
        );
      }

      ctx.lineJoin = "round";
      let started = false;
      for (let i = 0; i < dist.length; i++) {
        if (dist[i] >= s.start && dist[i] <= s.end) {
          const [sx, sy] = toScreen(map_x[i], map_y[i]);
          if (!started) {
            ctx.moveTo(sx, sy);
            started = true;
          } else {
            ctx.lineTo(sx, sy);
          }
        }
      }
      ctx.stroke();

      // Label
      const midDist = (s.start + s.end) / 2;
      let midIdx = 0;
      let minD = Infinity;
      for (let i = 0; i < dist.length; i++) {
        const d = Math.abs(dist[i] - midDist);
        if (d < minD) {
          minD = d;
          midIdx = i;
        }
      }

      const [lx, ly] = toScreen(map_x[midIdx], map_y[midIdx]);
      const deltaStr =
        s.delta > 0 ? `+${s.delta.toFixed(2)}s` : `${s.delta.toFixed(2)}s`;
      const dimmed = activeSector !== null && activeSector !== s.id;

      ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillStyle = dimmed
        ? hexToRgba(COLORS.txtDim, 0.3)
        : s.delta > 0
        ? COLORS.loss
        : COLORS.gain;
      ctx.fillText(deltaStr, lx, ly - 10);

      ctx.font = '500 10px "Outfit", sans-serif';
      ctx.fillStyle = dimmed ? hexToRgba(COLORS.txtDim, 0.3) : COLORS.txt;
      ctx.fillText(s.name, lx, ly - 22);
    }
  }, [chart, sectors, activeSector]);

  useEffect(() => {
    draw();
    const handleResize = () => draw();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [draw]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const mx = (e.clientX - rect.left);
    const my = (e.clientY - rect.top);

    const { map_x, map_y, dist } = chart;
    const pad = 40;
    const minX = Math.min(...map_x);
    const maxX = Math.max(...map_x);
    const minY = Math.min(...map_y);
    const maxY = Math.max(...map_y);
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const w = canvas.clientWidth;
    const h = 360;
    const scale = Math.min((w - pad * 2) / rangeX, (h - pad * 2) / rangeY);
    const offX = (w - rangeX * scale) / 2;
    const offY = (h - rangeY * scale) / 2;

    // Find closest sector
    let bestSector: number | null = null;
    let bestDist = 30; // pixel threshold
    for (const s of sectors) {
      for (let i = 0; i < dist.length; i++) {
        if (dist[i] >= s.start && dist[i] <= s.end) {
          const sx = offX + (map_x[i] - minX) * scale;
          const sy = offY + (maxY - map_y[i]) * scale;
          const d = Math.sqrt((mx - sx) ** 2 + (my - sy) ** 2);
          if (d < bestDist) {
            bestDist = d;
            bestSector = s.id;
          }
        }
      }
    }

    onSectorSelect(bestSector === activeSector ? null : bestSector);
  };

  return (
    <div ref={containerRef} className="w-full">
      <canvas
        ref={canvasRef}
        className="w-full cursor-pointer"
        style={{ height: 360 }}
        onClick={handleClick}
      />
    </div>
  );
}
