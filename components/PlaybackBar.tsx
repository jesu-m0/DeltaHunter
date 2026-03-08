"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { ChartData } from "@/lib/types";

interface Props {
  chart: ChartData;
  markerDist: number | null;
  onMarkerPlace: (dist: number | null) => void;
}

const SPEEDS = [0.25, 0.5, 1, 2, 4, 8];

export default function PlaybackBar({ chart, markerDist, onMarkerPlace }: Props) {
  const [playing, setPlaying] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(2); // 1x
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const distRef = useRef<number>(0);

  const maxDist = chart.dist[chart.dist.length - 1] ?? 0;
  const minDist = chart.dist[0] ?? 0;
  const playbackSpeed = SPEEDS[speedIdx];

  // Get the user's speed (kph) at a given distance for real-time playback
  const getSpeedAtDist = useCallback(
    (d: number): number => {
      // Binary-ish search for closest index
      let lo = 0;
      let hi = chart.dist.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (chart.dist[mid] < d) lo = mid + 1;
        else hi = mid;
      }
      const speed = chart.user_speed[lo] ?? 100;
      return Math.max(speed, 10); // minimum 10 kph to avoid stalling
    },
    [chart]
  );

  const tick = useCallback(
    (timestamp: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const dtReal = (timestamp - lastTimeRef.current) / 1000; // seconds
      lastTimeRef.current = timestamp;

      // speed in kph at current position -> m/s
      const speedKph = getSpeedAtDist(distRef.current);
      const speedMs = speedKph / 3.6;

      // distance traveled = speed * dt * playback multiplier
      const dd = speedMs * dtReal * playbackSpeed;
      distRef.current += dd;

      if (distRef.current >= maxDist) {
        distRef.current = maxDist;
        onMarkerPlace(maxDist);
        setPlaying(false);
        return;
      }

      onMarkerPlace(distRef.current);
      rafRef.current = requestAnimationFrame(tick);
    },
    [getSpeedAtDist, maxDist, onMarkerPlace, playbackSpeed]
  );

  useEffect(() => {
    if (playing) {
      lastTimeRef.current = 0;
      rafRef.current = requestAnimationFrame(tick);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, tick]);

  // Keep distRef in sync with external marker changes
  useEffect(() => {
    if (markerDist !== null && !playing) {
      distRef.current = markerDist;
    }
  }, [markerDist, playing]);

  const handlePlay = () => {
    if (markerDist === null || markerDist >= maxDist - 10) {
      distRef.current = minDist;
      onMarkerPlace(minDist);
    }
    setPlaying(true);
  };

  const handlePause = () => {
    setPlaying(false);
  };

  const handleStop = () => {
    setPlaying(false);
    onMarkerPlace(null);
    distRef.current = minDist;
  };

  const handleSkip = (delta: number) => {
    const current = markerDist ?? minDist;
    const next = Math.max(minDist, Math.min(maxDist, current + delta));
    distRef.current = next;
    onMarkerPlace(next);
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const d = parseFloat(e.target.value);
    distRef.current = d;
    onMarkerPlace(d);
  };

  const progress = markerDist !== null ? ((markerDist - minDist) / (maxDist - minDist)) * 100 : 0;

  // Compute elapsed time at marker position
  const getTimeAtDist = (targetDist: number): number => {
    let t = 0;
    for (let i = 1; i < chart.dist.length; i++) {
      if (chart.dist[i] > targetDist) break;
      const dd = chart.dist[i] - chart.dist[i - 1];
      const speed = Math.max(chart.user_speed[i], 10) / 3.6;
      t += dd / speed;
    }
    return t;
  };

  const currentTime = markerDist !== null ? getTimeAtDist(markerDist) : 0;
  const totalTime = getTimeAtDist(maxDist);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toFixed(1).padStart(4, "0")}`;
  };

  return (
    <div className="bg-surface rounded-xl border border-border px-4 py-3">
      <div className="flex items-center gap-3">
        {/* Play/Pause */}
        <button
          onClick={playing ? handlePause : handlePlay}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-user/20 text-user
            hover:bg-user/30 transition-colors"
        >
          {playing ? (
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
          onClick={handleStop}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-surface2 text-txt-dim
            hover:text-txt transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="1" />
          </svg>
        </button>

        {/* Skip back */}
        <button
          onClick={() => handleSkip(-100)}
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
          onClick={() => handleSkip(100)}
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
          {formatTime(currentTime)} / {formatTime(totalTime)}
        </span>

        {/* Scrub bar */}
        <div className="flex-1 relative">
          <div className="h-1.5 rounded-full bg-surface2 overflow-hidden">
            <div
              className="h-full bg-user/60 rounded-full transition-[width] duration-75"
              style={{ width: `${progress}%` }}
            />
          </div>
          <input
            type="range"
            min={minDist}
            max={maxDist}
            step={6}
            value={markerDist ?? minDist}
            onChange={handleScrub}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>

        {/* Distance */}
        <span className="font-mono text-[10px] text-txt-dim w-14 text-right">
          {(markerDist ?? 0).toFixed(0)}m
        </span>

        {/* Speed selector */}
        <button
          onClick={() => setSpeedIdx((i) => (i + 1) % SPEEDS.length)}
          className="px-2 py-1 rounded-lg bg-surface2 text-xs font-mono text-txt-dim
            hover:text-txt transition-colors min-w-[3rem] text-center"
          title="Playback speed"
        >
          {playbackSpeed}x
        </button>
      </div>
    </div>
  );
}
