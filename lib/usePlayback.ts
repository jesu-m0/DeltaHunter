"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import type { ChartData } from "@/lib/types";

const SPEEDS = [0.25, 0.5, 1, 2, 4, 8];

export interface PlaybackApi {
  playing: boolean;
  speedIdx: number;
  playbackSpeed: number;
  speedCount: number;
  minDist: number;
  maxDist: number;
  progress: number;
  currentTime: number;
  totalTime: number;
  play: () => void;
  pause: () => void;
  stop: () => void;
  skip: (delta: number) => void;
  scrub: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setSpeedIdx: (fn: (i: number) => number) => void;
  formatTime: (s: number) => string;
}

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toFixed(1).padStart(4, "0")}`;
};

/**
 * Playback state + the requestAnimationFrame loop that drives the marker.
 * Lives in a hook so a single instance can feed several layouts (the desktop
 * row and the mobile sheet) without duplicating the loop or losing playback
 * when one of them unmounts.
 */
export function usePlayback(
  chart: ChartData,
  markerDist: number | null,
  onMarkerPlace: (dist: number | null) => void
): PlaybackApi {
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

  const play = useCallback(() => {
    if (markerDist === null || markerDist >= maxDist - 10) {
      distRef.current = minDist;
      onMarkerPlace(minDist);
    }
    setPlaying(true);
  }, [markerDist, maxDist, minDist, onMarkerPlace]);

  const pause = useCallback(() => {
    setPlaying(false);
  }, []);

  const stop = useCallback(() => {
    setPlaying(false);
    onMarkerPlace(null);
    distRef.current = minDist;
  }, [minDist, onMarkerPlace]);

  const skip = useCallback(
    (delta: number) => {
      const current = markerDist ?? minDist;
      const next = Math.max(minDist, Math.min(maxDist, current + delta));
      distRef.current = next;
      onMarkerPlace(next);
    },
    [markerDist, maxDist, minDist, onMarkerPlace]
  );

  const scrub = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const d = parseFloat(e.target.value);
      distRef.current = d;
      onMarkerPlace(d);
    },
    [onMarkerPlace]
  );

  const progress =
    markerDist !== null ? ((markerDist - minDist) / (maxDist - minDist)) * 100 : 0;

  // Precompute cumulative elapsed-time at each sample once per chart, so the
  // playback readout is O(log n) per frame instead of O(n) every render.
  const cumTime = useMemo(() => {
    const t = new Array<number>(chart.dist.length);
    t[0] = 0;
    for (let i = 1; i < chart.dist.length; i++) {
      const dd = chart.dist[i] - chart.dist[i - 1];
      const speed = Math.max(chart.user_speed[i], 10) / 3.6;
      t[i] = t[i - 1] + dd / speed;
    }
    return t;
  }, [chart]);

  const timeIndexAt = (targetDist: number): number => {
    let lo = 0;
    let hi = chart.dist.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (chart.dist[mid] < targetDist) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };

  const totalTime = cumTime[cumTime.length - 1] ?? 0;
  const currentTime =
    markerDist !== null ? cumTime[timeIndexAt(markerDist)] ?? 0 : 0;

  return {
    playing,
    speedIdx,
    playbackSpeed,
    speedCount: SPEEDS.length,
    minDist,
    maxDist,
    progress,
    currentTime,
    totalTime,
    play,
    pause,
    stop,
    skip,
    scrub,
    setSpeedIdx,
    formatTime,
  };
}
