"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { setupCanvas, clearCanvas, speedToColor, COLORS, hexToRgba } from "@/lib/chartUtils";
import type { HdData, SectorData } from "@/lib/types";

interface Props {
  hd: HdData;
  sector: SectorData;
  showUser: boolean;
  showRef: boolean;
  markerDist: number | null;
  onMarkerPlace: (dist: number | null) => void;
}

const HEIGHT = 480;

export default function RacingLineMap({ hd, sector, showUser, showRef, markerDist, onMarkerPlace }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);

  // Zoom & pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  // Store computed data for click handler
  const drawDataRef = useRef<{
    dist: number[];
    ux: number[]; uy: number[]; rx: number[]; ry: number[];
    toScreen: (x: number, y: number) => [number, number];
  } | null>(null);

  // Reset zoom when sector changes
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [sector.id]);

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

    // Store for click handler (updated below with toScreen)
    drawDataRef.current = { dist, ux, uy, rx, ry, toScreen: (x, y) => [0, 0] };

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
    const baseScale = Math.min(scaleX, scaleY);
    const scale = baseScale * zoom;
    const centerX = w / 2 + pan.x;
    const centerY = h / 2 + pan.y;
    const dataCenterX = (minX + maxX) / 2;
    const dataCenterY = (minY + maxY) / 2;

    const toScreen = (x: number, y: number): [number, number] => [
      centerX + (x - dataCenterX) * scale,
      centerY - (y - dataCenterY) * scale,
    ];

    // Update toScreen in ref
    if (drawDataRef.current) drawDataRef.current.toScreen = toScreen;

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
    ctx.lineWidth = Math.max(12, 28 * (scale / 2));
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

    // Line widths scale with zoom
    const outlineW = Math.max(3, Math.min(8, 5 * zoom));
    const lineW = Math.max(2, Math.min(6, 3 * zoom));

    // Helper: draw a racing line colored by speed with an outline
    const drawRacingLine = (
      xs: number[],
      ys: number[],
      speeds: number[],
      outlineColor: string,
    ) => {
      // Outline
      ctx.beginPath();
      ctx.strokeStyle = hexToRgba(outlineColor, 0.3);
      ctx.lineWidth = outlineW;
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
        ctx.lineWidth = lineW;
        ctx.lineCap = "round";
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
    };

    // Draw reference line first (behind), then user line
    if (showRef) drawRacingLine(rx, ry, rSpd, COLORS.ref);
    if (showUser) drawRacingLine(ux, uy, uSpd, COLORS.user);

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

      const markerR = Math.max(4, Math.min(8, 5 * zoom));
      const fontSize = Math.max(9, Math.min(13, 10 * zoom));

      if (brkIdx >= 0 && brkIdx < xs.length) {
        const [bx, by] = toScreen(xs[brkIdx], ys[brkIdx]);
        ctx.beginPath();
        ctx.arc(bx, by, markerR, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.font = `600 ${fontSize}px "JetBrains Mono", monospace`;
        ctx.fillStyle = color;
        ctx.textAlign = labelSide > 0 ? "left" : "right";
        ctx.textBaseline = "middle";
        ctx.fillText("BRK", bx + labelSide * (markerR + 5), by);
      }

      if (gasIdx >= 0 && gasIdx < xs.length) {
        const [gx, gy] = toScreen(xs[gasIdx], ys[gasIdx]);
        ctx.beginPath();
        ctx.arc(gx, gy, markerR, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.font = `600 ${fontSize}px "JetBrains Mono", monospace`;
        ctx.fillStyle = color;
        ctx.textAlign = labelSide > 0 ? "left" : "right";
        ctx.textBaseline = "middle";
        ctx.fillText("GAS", gx + labelSide * (markerR + 5), gy);
      }

      // Min speed annotation
      if (minIdx >= 0 && minIdx < xs.length) {
        const [mx, my] = toScreen(xs[minIdx], ys[minIdx]);
        ctx.font = `500 ${fontSize}px "JetBrains Mono", monospace`;
        ctx.fillStyle = color;
        ctx.textAlign = "center";
        ctx.textBaseline = labelSide > 0 ? "bottom" : "top";
        ctx.fillText(`${minSpd.toFixed(0)}`, mx, my + labelSide * -(markerR + 9));
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

    // Distance marker
    if (markerDist !== null) {
      // Find closest index in this sector slice
      let mIdx = -1;
      let mBest = Infinity;
      for (let i = 0; i < dist.length; i++) {
        const dd = Math.abs(dist[i] - markerDist);
        if (dd < mBest) { mBest = dd; mIdx = i; }
      }
      if (mIdx >= 0 && mBest < 20) {
        const markerR = Math.max(5, Math.min(10, 7 * zoom));
        // Draw on user line
        if (showUser && mIdx < ux.length) {
          const [mx, my] = toScreen(ux[mIdx], uy[mIdx]);
          ctx.beginPath();
          ctx.arc(mx, my, markerR, 0, Math.PI * 2);
          ctx.fillStyle = COLORS.txt;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(mx, my, markerR - 2, 0, Math.PI * 2);
          ctx.fillStyle = COLORS.user;
          ctx.fill();
        }
        // Draw on ref line
        if (showRef && mIdx < rx.length) {
          const [mx, my] = toScreen(rx[mIdx], ry[mIdx]);
          ctx.beginPath();
          ctx.arc(mx, my, markerR, 0, Math.PI * 2);
          ctx.fillStyle = COLORS.txt;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(mx, my, markerR - 2, 0, Math.PI * 2);
          ctx.fillStyle = COLORS.ref;
          ctx.fill();
        }
        // Label
        const labelIdx = showUser ? mIdx : mIdx;
        const labelXs = showUser ? ux : rx;
        const labelYs = showUser ? uy : ry;
        if (labelIdx < labelXs.length) {
          const [lx, ly] = toScreen(labelXs[labelIdx], labelYs[labelIdx]);
          ctx.font = `600 ${Math.max(9, Math.min(12, 10 * zoom))}px "JetBrains Mono", monospace`;
          ctx.fillStyle = COLORS.txt;
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.fillText(`${markerDist.toFixed(0)}m`, lx, ly - markerR - 4);
        }
      }
    }

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

    // Zoom level indicator (when zoomed)
    if (zoom > 1.05) {
      ctx.font = '500 10px "JetBrains Mono", monospace';
      ctx.fillStyle = hexToRgba(COLORS.txtDim, 0.5);
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`${zoom.toFixed(1)}x`, 8, 8);
    }
  }, [hd, sector, showUser, showRef, hover, zoom, pan, markerDist]);

  useEffect(() => {
    draw();
    const handleResize = () => draw();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [draw]);

  // Ctrl+Wheel to zoom (normal scroll passes through to the page)
  // Use native event listener so we can conditionally preventDefault
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return; // let page scroll normally
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom((z) => Math.max(0.5, Math.min(20, z * factor)));
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  const stepZoom = useCallback((dir: 1 | -1) => {
    setZoom((z) => Math.max(0.5, Math.min(20, z * (dir > 0 ? 1.3 : 1 / 1.3))));
  }, []);

  // Drag to pan (with click detection for marker placement)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragRef.current) {
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPan({ x: dragRef.current.panX + dx, y: dragRef.current.panY + dy });
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setHover({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  }, []);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (dragRef.current) {
      const dx = Math.abs(e.clientX - dragRef.current.startX);
      const dy = Math.abs(e.clientY - dragRef.current.startY);
      // If barely moved, treat as click → place marker
      if (dx < 4 && dy < 4 && drawDataRef.current) {
        const rect = e.currentTarget.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const { dist, ux, uy, rx, ry, toScreen } = drawDataRef.current;
        let closestIdx = -1;
        let closestD = 25;
        const check = (xs: number[], ys: number[]) => {
          for (let i = 0; i < xs.length; i++) {
            const [sx, sy] = toScreen(xs[i], ys[i]);
            const d = Math.sqrt((mx - sx) ** 2 + (my - sy) ** 2);
            if (d < closestD) { closestD = d; closestIdx = i; }
          }
        };
        if (showUser) check(ux, uy);
        if (showRef) check(rx, ry);
        if (closestIdx >= 0) {
          const d = dist[closestIdx];
          onMarkerPlace(markerDist !== null && Math.abs(markerDist - d) < 12 ? null : d);
        }
      }
    }
    dragRef.current = null;
  }, [showUser, showRef, markerDist, onMarkerPlace]);

  const isZoomed = zoom > 1.05 || Math.abs(pan.x) > 1 || Math.abs(pan.y) > 1;

  const btnClass =
    "w-7 h-7 flex items-center justify-center rounded-md bg-surface2 border border-border text-txt-dim hover:text-txt hover:bg-surface2/80 transition-colors text-sm font-mono font-semibold";

  return (
    <div ref={containerRef} className="w-full relative">
      <canvas
        ref={canvasRef}
        className={`w-full ${dragRef.current ? "cursor-grabbing" : "cursor-grab"}`}
        style={{ height: HEIGHT }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          setHover(null);
          dragRef.current = null;
        }}
      />
      {/* Zoom controls */}
      <div className="absolute top-2 right-2 flex items-center gap-1">
        <button onClick={() => stepZoom(1)} className={btnClass} title="Zoom in">+</button>
        <button onClick={() => stepZoom(-1)} className={btnClass} title="Zoom out">&minus;</button>
        {isZoomed && (
          <button
            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
            className="h-7 px-2 flex items-center justify-center rounded-md
              bg-surface2 border border-border text-txt-dim hover:text-txt hover:bg-surface2/80
              transition-colors text-[10px] font-medium"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
