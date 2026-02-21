"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { setupCanvas, clearCanvas, speedToColor, COLORS, hexToRgba } from "@/lib/chartUtils";
import type { HdData, SectorData } from "@/lib/types";

interface Props {
  hd: HdData;
  sector: SectorData;
  showUser: boolean;
  showRef: boolean;
}

const HEIGHT = 480;

export default function RacingLineMap({ hd, sector, showUser, showRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const w = container.clientWidth;
    const h = HEIGHT;
    const ctx = setupCanvas(canvas, w, h);
    clearCanvas(ctx, w, h);

    // Extract sector slice from HD data
    const margin = 60;
    const sStart = sector.start - margin;
    const sEnd = sector.end + margin;

    const indices: number[] = [];
    for (let i = 0; i < hd.dist.length; i++) {
      if (hd.dist[i] >= sStart && hd.dist[i] <= sEnd) indices.push(i);
    }
    if (indices.length < 2) return;

    const ux = indices.map((i) => hd.user_x[i]);
    const uy = indices.map((i) => hd.user_y[i]);
    const rx = indices.map((i) => hd.ref_x[i]);
    const ry = indices.map((i) => hd.ref_y[i]);
    const uSpd = indices.map((i) => hd.user_speed[i]);
    const rSpd = indices.map((i) => hd.ref_speed[i]);
    const uBrk = indices.map((i) => hd.user_brake[i]);
    const rBrk = indices.map((i) => hd.ref_brake[i]);
    const uThr = indices.map((i) => hd.user_throttle[i]);
    const rThr = indices.map((i) => hd.ref_throttle[i]);
    const dist = indices.map((i) => hd.dist[i]);

    // Bounding box of all coords
    const allX = [...(showUser ? ux : []), ...(showRef ? rx : [])];
    const allY = [...(showUser ? uy : []), ...(showRef ? ry : [])];
    if (allX.length === 0) return;

    const minX = Math.min(...allX);
    const maxX = Math.max(...allX);
    const minY = Math.min(...allY);
    const maxY = Math.max(...allY);
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;

    const pad = 60;
    const scaleX = (w - pad * 2) / rangeX;
    const scaleY = (h - pad * 2) / rangeY;
    const scale = Math.min(scaleX, scaleY);
    const offX = (w - rangeX * scale) / 2;
    const offY = (h - rangeY * scale) / 2;

    const toScreen = (x: number, y: number): [number, number] => [
      offX + (x - minX) * scale,
      offY + (maxY - y) * scale,
    ];

    // Speed range for coloring
    const allSpeeds = [
      ...(showUser ? uSpd : []),
      ...(showRef ? rSpd : []),
    ];
    const spdMin = Math.min(...allSpeeds);
    const spdMax = Math.max(...allSpeeds);

    // Draw track surface (wide gray line using user coords as baseline)
    ctx.beginPath();
    ctx.strokeStyle = hexToRgba(COLORS.txt, 0.04);
    ctx.lineWidth = 28 * (scale / 2);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let i = 0; i < ux.length; i++) {
      const [sx, sy] = toScreen(ux[i], uy[i]);
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();

    // Track edges
    ctx.beginPath();
    ctx.strokeStyle = hexToRgba(COLORS.txt, 0.08);
    ctx.lineWidth = 1;
    for (let i = 0; i < ux.length; i++) {
      const [sx, sy] = toScreen(ux[i], uy[i]);
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();

    // Helper: draw a racing line colored by speed with an outline
    const drawRacingLine = (
      xs: number[],
      ys: number[],
      speeds: number[],
      outlineColor: string,
      label: string
    ) => {
      // Outline
      ctx.beginPath();
      ctx.strokeStyle = hexToRgba(outlineColor, 0.3);
      ctx.lineWidth = 5;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      for (let i = 0; i < xs.length; i++) {
        const [sx, sy] = toScreen(xs[i], ys[i]);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();

      // Speed-colored segments
      for (let i = 1; i < xs.length; i++) {
        const [x0, y0] = toScreen(xs[i - 1], ys[i - 1]);
        const [x1, y1] = toScreen(xs[i], ys[i]);
        ctx.beginPath();
        ctx.strokeStyle = speedToColor(speeds[i], spdMin, spdMax);
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
    };

    // Draw reference line first (behind), then user line
    if (showRef) drawRacingLine(rx, ry, rSpd, COLORS.ref, "Ref");
    if (showUser) drawRacingLine(ux, uy, uSpd, COLORS.user, "You");

    // Find braking and gas points
    const drawMarker = (
      xs: number[],
      ys: number[],
      brk: number[],
      thr: number[],
      speeds: number[],
      color: string,
      labelSide: number
    ) => {
      // Brake point: first point where brake > 15%
      let brkIdx = -1;
      for (let i = 0; i < brk.length; i++) {
        if (brk[i] > 15) { brkIdx = i; break; }
      }

      // Gas point: after brake zone, first point where throttle > 50%
      let gasIdx = -1;
      if (brkIdx >= 0) {
        for (let i = brkIdx; i < thr.length; i++) {
          if (thr[i] > 50 && brk[i] < 10) { gasIdx = i; break; }
        }
      }

      // Min speed point
      let minIdx = 0;
      let minSpd = Infinity;
      for (let i = 0; i < speeds.length; i++) {
        if (speeds[i] < minSpd) { minSpd = speeds[i]; minIdx = i; }
      }

      if (brkIdx >= 0 && brkIdx < xs.length) {
        const [bx, by] = toScreen(xs[brkIdx], ys[brkIdx]);
        ctx.beginPath();
        ctx.arc(bx, by, 5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.font = '600 10px "JetBrains Mono", monospace';
        ctx.fillStyle = color;
        ctx.textAlign = labelSide > 0 ? "left" : "right";
        ctx.textBaseline = "middle";
        ctx.fillText("BRK", bx + labelSide * 10, by);
      }

      if (gasIdx >= 0 && gasIdx < xs.length) {
        const [gx, gy] = toScreen(xs[gasIdx], ys[gasIdx]);
        ctx.beginPath();
        ctx.arc(gx, gy, 5, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.font = '600 10px "JetBrains Mono", monospace';
        ctx.fillStyle = color;
        ctx.textAlign = labelSide > 0 ? "left" : "right";
        ctx.textBaseline = "middle";
        ctx.fillText("GAS", gx + labelSide * 10, gy);
      }

      // Min speed annotation
      if (minIdx >= 0 && minIdx < xs.length) {
        const [mx, my] = toScreen(xs[minIdx], ys[minIdx]);
        ctx.font = '500 10px "JetBrains Mono", monospace';
        ctx.fillStyle = color;
        ctx.textAlign = "center";
        ctx.textBaseline = labelSide > 0 ? "bottom" : "top";
        ctx.fillText(`${minSpd.toFixed(0)}`, mx, my + labelSide * -14);
      }
    };

    if (showUser) drawMarker(ux, uy, uBrk, uThr, uSpd, COLORS.user, 1);
    if (showRef) drawMarker(rx, ry, rBrk, rThr, rSpd, COLORS.ref, -1);

    // Entry/Exit markers
    const drawEntryExit = (xs: number[], ys: number[]) => {
      if (xs.length < 2) return;
      const [ex, ey] = toScreen(xs[0], ys[0]);
      ctx.font = '500 9px "Outfit", sans-serif';
      ctx.fillStyle = COLORS.txtDim;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText("ENTRY", ex, ey - 16);

      const [ox, oy] = toScreen(xs[xs.length - 1], ys[ys.length - 1]);
      ctx.fillText("EXIT", ox, oy - 16);

      // Direction arrow at ~25% of the line
      const ai = Math.floor(xs.length * 0.25);
      if (ai > 0 && ai < xs.length) {
        const [ax, ay] = toScreen(xs[ai], ys[ai]);
        const [px, py] = toScreen(xs[ai - 1], ys[ai - 1]);
        const angle = Math.atan2(ay - py, ax - px);
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(-4, -4);
        ctx.lineTo(-4, 4);
        ctx.closePath();
        ctx.fillStyle = hexToRgba(COLORS.txt, 0.3);
        ctx.fill();
        ctx.restore();
      }
    };

    if (showUser) drawEntryExit(ux, uy);

    // Hover tooltip
    if (hover) {
      let closestIdx = -1;
      let closestD = 20;

      const checkLine = (xs: number[], ys: number[]) => {
        for (let i = 0; i < xs.length; i++) {
          const [sx, sy] = toScreen(xs[i], ys[i]);
          const d = Math.sqrt((hover.x - sx) ** 2 + (hover.y - sy) ** 2);
          if (d < closestD) {
            closestD = d;
            closestIdx = i;
          }
        }
      };

      if (showUser) checkLine(ux, uy);
      if (showRef) checkLine(rx, ry);

      if (closestIdx >= 0) {
        const lines = [`${dist[closestIdx].toFixed(0)}m`];
        if (showUser) lines.push(`You: ${uSpd[closestIdx].toFixed(0)} kph`);
        if (showRef) lines.push(`Ref: ${rSpd[closestIdx].toFixed(0)} kph`);
        if (showUser && showRef)
          lines.push(`Delta: ${(uSpd[closestIdx] - rSpd[closestIdx]).toFixed(0)} kph`);

        // Draw tooltip
        ctx.font = '11px "JetBrains Mono", monospace';
        const lineH = 16;
        const padX = 8;
        const padY = 6;
        let maxW = 0;
        for (const l of lines) {
          const m = ctx.measureText(l);
          if (m.width > maxW) maxW = m.width;
        }
        const boxW = maxW + padX * 2;
        const boxH = lines.length * lineH + padY * 2;
        let tx = hover.x + 12;
        let ty = hover.y - boxH / 2;
        if (tx + boxW > w - 4) tx = hover.x - boxW - 12;
        if (ty < 4) ty = 4;
        if (ty + boxH > h - 4) ty = h - boxH - 4;

        ctx.fillStyle = "rgba(17, 20, 26, 0.92)";
        ctx.strokeStyle = COLORS.border;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(tx, ty, boxW, boxH, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = COLORS.txt;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        for (let i = 0; i < lines.length; i++) {
          ctx.fillText(lines[i], tx + padX, ty + padY + i * lineH);
        }
      }
    }
  }, [hd, sector, showUser, showRef, hover]);

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
