"use client";

import type { PlaybackApi } from "@/lib/usePlayback";

interface Props {
  pb: PlaybackApi;
  markerDist: number | null;
}

/** Desktop layout (sm+): every control on a single row. */
export default function PlaybackBar({ pb, markerDist }: Props) {
  return (
    <div className="w-full min-w-0">
      <div className="flex items-center gap-3">
        {/* Play/Pause */}
        <button
          onClick={pb.playing ? pb.pause : pb.play}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-user/20 text-user
            hover:bg-user/30 transition-colors"
        >
          {pb.playing ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Stop */}
        <button
          onClick={pb.stop}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-surface2 text-txt-dim
            hover:text-txt transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="1" />
          </svg>
        </button>

        {/* Skip back */}
        <button
          onClick={() => pb.skip(-100)}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-surface2 text-txt-dim
            hover:text-txt transition-colors"
          title="-100m"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" />
          </svg>
        </button>

        {/* Skip forward */}
        <button
          onClick={() => pb.skip(100)}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-surface2 text-txt-dim
            hover:text-txt transition-colors"
          title="+100m"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" />
          </svg>
        </button>

        {/* Time display */}
        <span className="font-mono text-xs text-txt-dim w-24 text-center">
          {pb.formatTime(pb.currentTime)} / {pb.formatTime(pb.totalTime)}
        </span>

        {/* Scrub bar */}
        <div className="flex-1 relative">
          <div className="h-1.5 rounded-full bg-surface2 overflow-hidden">
            <div
              className="h-full bg-user/60 rounded-full transition-[width] duration-75"
              style={{ width: `${pb.progress}%` }}
            />
          </div>
          <input
            type="range"
            min={pb.minDist}
            max={pb.maxDist}
            step={6}
            value={markerDist ?? pb.minDist}
            onChange={pb.scrub}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>

        {/* Distance */}
        <span className="font-mono text-[10px] text-txt-dim w-14 text-right">
          {(markerDist ?? 0).toFixed(0)}m
        </span>

        {/* Speed: step slower/faster, each arrow disabled at its limit */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => pb.setSpeedIdx((i) => Math.max(0, i - 1))}
            disabled={pb.speedIdx === 0}
            title="Slower"
            className="w-7 h-8 flex items-center justify-center rounded-lg bg-surface2 text-txt-dim
              hover:text-txt transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-txt-dim"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="w-10 text-center font-mono text-xs text-txt tabular-nums">
            {pb.playbackSpeed}x
          </span>
          <button
            onClick={() => pb.setSpeedIdx((i) => Math.min(pb.speedCount - 1, i + 1))}
            disabled={pb.speedIdx === pb.speedCount - 1}
            title="Faster"
            className="w-7 h-8 flex items-center justify-center rounded-lg bg-surface2 text-txt-dim
              hover:text-txt transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-txt-dim"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
