"use client";

import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { ChartHeightContext } from "@/lib/chartHeightContext";

interface Props {
  title: ReactNode;
  description?: ReactNode;
  defaultHeight: number;
  storageKey: string;
  children: ReactNode;
}

const MIN_H = 140;
const MAX_H = 900;

export default function ChartCard({
  title,
  description,
  defaultHeight,
  storageKey,
  children,
}: Props) {
  const [height, setHeight] = useState(defaultHeight);
  const [fullscreen, setFullscreen] = useState(false);
  const [fsHeight, setFsHeight] = useState(600);
  const heightRef = useRef(height);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  const lsKey = `dh-chart-h:${storageKey}`;

  // Restore persisted height
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(lsKey);
      if (saved) {
        const v = parseInt(saved, 10);
        if (!Number.isNaN(v)) {
          const clamped = Math.min(MAX_H, Math.max(MIN_H, v));
          heightRef.current = clamped;
          setHeight(clamped);
        }
      }
    } catch {
      /* localStorage unavailable — keep default */
    }
  }, [lsKey]);

  // Fullscreen: track viewport height, exit on Esc
  useEffect(() => {
    if (!fullscreen) return;
    const compute = () => setFsHeight(Math.max(220, window.innerHeight - 180));
    compute();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("resize", compute);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("keydown", onKey);
    };
  }, [fullscreen]);

  const onDragStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      dragRef.current = { startY: e.clientY, startH: heightRef.current };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    []
  );

  const onDragMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const next = Math.min(
      MAX_H,
      Math.max(MIN_H, dragRef.current.startH + (e.clientY - dragRef.current.startY))
    );
    heightRef.current = next;
    setHeight(next);
  }, []);

  const onDragEnd = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    try {
      window.localStorage.setItem(lsKey, String(heightRef.current));
    } catch {
      /* ignore */
    }
  }, [lsKey]);

  const effectiveHeight = fullscreen ? fsHeight : height;

  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-30 bg-bg p-4 pb-28 overflow-auto"
          : "relative bg-surface rounded-xl border border-border p-4 group"
      }
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <h2 className="text-xs font-semibold text-txt-dim uppercase tracking-wider">
            {title}
          </h2>
          {description && (
            <p className="text-[11px] text-txt-dim/70 mt-1">{description}</p>
          )}
        </div>
        <button
          onClick={() => setFullscreen((f) => !f)}
          title={fullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}
          className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-md text-txt-dim
            hover:text-txt hover:bg-surface2 transition ${
              fullscreen ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus:opacity-100"
            }`}
        >
          {fullscreen ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5 5.25 5.25"
              />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9m11.25-5.25h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15M3.75 20.25h4.5m-4.5 0v-4.5m0 4.5L9 15"
              />
            </svg>
          )}
        </button>
      </div>

      <ChartHeightContext.Provider value={effectiveHeight}>
        {children}
      </ChartHeightContext.Provider>

      {!fullscreen && (
        <div
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          title="Drag to resize"
          style={{ touchAction: "none" }}
          className="absolute left-0 right-0 -bottom-1 h-3 flex items-center justify-center cursor-ns-resize group/handle"
        >
          <div className="w-10 h-1 rounded-full bg-border group-hover:bg-txt-dim/40 group-hover/handle:bg-user transition-colors" />
        </div>
      )}
    </div>
  );
}
