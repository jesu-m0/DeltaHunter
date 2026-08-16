"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PlaybackApi } from "@/lib/usePlayback";
import DriverToggle from "./DriverToggle";

interface Props {
  pb: PlaybackApi;
  markerDist: number | null;
  showUser: boolean;
  showRef: boolean;
  userLabel: string;
  refLabel: string;
  onToggleUser: () => void;
  onToggleRef: () => void;
}

/** Scrub track shared by the collapsed row and the expanded board. */
function Scrub({
  pb,
  markerDist,
  thumb,
}: {
  pb: PlaybackApi;
  markerDist: number | null;
  thumb: string;
}) {
  return (
    // Generous vertical padding gives the range input a ~24px touch band while
    // the track itself stays visually slim.
    <div className="flex-1 min-w-0 relative py-2.5 -my-2.5">
      <div className="h-1.5 rounded-full bg-surface2 overflow-hidden">
        <div
          className="h-full bg-user rounded-full transition-[width] duration-75"
          style={{ width: `${pb.progress}%` }}
        />
      </div>
      <div
        className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full bg-user
          pointer-events-none ${thumb}`}
        style={{ left: `${pb.progress}%` }}
      />
      <input
        type="range"
        min={pb.minDist}
        max={pb.maxDist}
        step={6}
        value={markerDist ?? pb.minDist}
        onChange={pb.scrub}
        aria-label="Playback position"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
    </div>
  );
}

/**
 * Mobile layout (<sm): a mini-player that pulls up into a full control board.
 *
 * The sheet is [grabber][mini row][board] anchored to the bottom. Collapsed it
 * is translated down by the board's measured height, so only the grabber and
 * the mini row stay on screen; opening animates back to translateY(0).
 */
export default function PlaybackSheet({
  pb,
  markerDist,
  showUser,
  showRef,
  userLabel,
  refLabel,
  onToggleUser,
  onToggleRef,
}: Props) {
  const [open, setOpen] = useState(false);
  const [boardH, setBoardH] = useState(0);
  const [dragY, setDragY] = useState<number | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startT: number; moved: boolean; y: number } | null>(
    null
  );

  // Driver names can wrap, so the board height is measured rather than fixed.
  useLayoutEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const measure = () => setBoardH(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Escape closes, same pattern as ChartCard's fullscreen mode
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const onDragStart = useCallback(
    (e: React.PointerEvent) => {
      const startT = open ? 0 : boardH;
      dragRef.current = { startY: e.clientY, startT, moved: false, y: startT };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [open, boardH]
  );

  const onDragMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const delta = e.clientY - d.startY;
      if (Math.abs(delta) > 4) d.moved = true;
      d.y = Math.min(boardH, Math.max(0, d.startT + delta));
      setDragY(d.y);
    },
    [boardH]
  );

  const onDragEnd = useCallback(() => {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    // A tap (no meaningful movement) toggles; a drag snaps to the nearer edge.
    setOpen(d.moved ? d.y < boardH / 2 : !open);
    setDragY(null);
  }, [boardH, open]);

  const translate = dragY ?? (open ? 0 : boardH);

  const iconBtn =
    "w-11 h-11 shrink-0 flex items-center justify-center rounded-xl bg-surface2 text-txt-dim active:bg-border transition-colors";

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onPointerDown={() => setOpen(false)}
          aria-hidden
        />
      )}

      <div
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface/95 backdrop-blur-md
          rounded-t-2xl overflow-hidden"
        style={{
          transform: `translateY(${translate}px)`,
          transition: dragY !== null ? "none" : "transform 300ms cubic-bezier(.32,.72,0,1)",
          // Keep the board off-screen until it has been measured
          visibility: boardH === 0 ? "hidden" : undefined,
        }}
      >
        {/* Grabber — the only drag surface, so it never steals the scrub's touch */}
        <div
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          style={{ touchAction: "none" }}
          role="button"
          tabIndex={0}
          aria-expanded={open}
          aria-label={open ? "Collapse playback controls" : "Expand playback controls"}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setOpen((o) => !o);
            }
          }}
          className="h-7 flex items-center justify-center cursor-grab active:cursor-grabbing"
        >
          <div className="w-10 h-1 rounded-full bg-txt-dim/40" />
        </div>

        {/* Collapsed mini row: play + scrub + elapsed */}
        <div className="flex items-center gap-3 px-4 pb-3">
          <button
            onClick={pb.playing ? pb.pause : pb.play}
            aria-label={pb.playing ? "Pause" : "Play"}
            className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl bg-user/20 text-user
              active:bg-user/30 transition-colors"
          >
            {pb.playing ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <Scrub pb={pb} markerDist={markerDist} thumb="w-3 h-3" />

          <span className="font-mono text-xs text-txt-dim tabular-nums shrink-0">
            {pb.formatTime(pb.currentTime)}
          </span>
        </div>

        {/* Expanded board */}
        <div ref={boardRef} className="px-4 pb-safe space-y-4 border-t border-border pt-4">
          <DriverToggle
            fullWidth
            showUser={showUser}
            showRef={showRef}
            userLabel={userLabel}
            refLabel={refLabel}
            onToggleUser={onToggleUser}
            onToggleRef={onToggleRef}
          />

          <div>
            <div className="flex items-center justify-between font-mono text-xs tabular-nums mb-2">
              <span className="text-txt">{pb.formatTime(pb.currentTime)}</span>
              <span className="text-user font-semibold">
                {(markerDist ?? 0).toFixed(0)}m
              </span>
              <span className="text-txt-dim">{pb.formatTime(pb.totalTime)}</span>
            </div>
            <Scrub pb={pb} markerDist={markerDist} thumb="w-4 h-4 ring-4 ring-user/25" />
          </div>

          {/* Transport */}
          <div className="flex items-center justify-center gap-4">
            <button onClick={pb.stop} aria-label="Stop" className={iconBtn}>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="1" />
              </svg>
            </button>

            <button onClick={() => pb.skip(-100)} aria-label="Back 100m" className={iconBtn}>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" />
              </svg>
            </button>

            <button
              onClick={pb.playing ? pb.pause : pb.play}
              aria-label={pb.playing ? "Pause" : "Play"}
              className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl bg-user/20 text-user
                active:bg-user/30 transition-colors"
            >
              {pb.playing ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            <button onClick={() => pb.skip(100)} aria-label="Forward 100m" className={iconBtn}>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" />
              </svg>
            </button>
          </div>

          {/* Speed stepper */}
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => pb.setSpeedIdx((i) => Math.max(0, i - 1))}
              disabled={pb.speedIdx === 0}
              aria-label="Slower"
              className={`${iconBtn} disabled:opacity-30`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="w-14 text-center font-mono text-sm text-txt tabular-nums">
              {pb.playbackSpeed}x
            </span>
            <button
              onClick={() => pb.setSpeedIdx((i) => Math.min(pb.speedCount - 1, i + 1))}
              disabled={pb.speedIdx === pb.speedCount - 1}
              aria-label="Faster"
              className={`${iconBtn} disabled:opacity-30`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
