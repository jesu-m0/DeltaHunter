import type { ParsedLap, ParsedSession } from "./types";

export function formatLapTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toFixed(3).padStart(6, "0")}`;
}

/** Laps slower than best × this factor are excluded from stats (offs, traffic). */
export const VALID_LAP_FACTOR = 1.07;

/**
 * Split a lap into nSegments equal-distance microsectors and integrate the
 * time spent in each from the speed trace (t = Δdist / v). Times are scaled
 * so they sum exactly to the recorded lap_time, which makes segment times
 * comparable across laps of the same session.
 */
export function segmentTimes(lap: ParsedLap, nSegments: number): number[] | null {
  const dist = lap.dist;
  let speed = lap.speed;
  const n = dist.length;
  if (n < 10 || speed.length < 2 || lap.lap_time <= 0) return null;

  // Channels can be logged at different frequencies — resample speed onto
  // the distance sample count so indices line up (mirrors the backend).
  if (speed.length !== n) {
    const src = speed;
    speed = new Array<number>(n);
    for (let i = 0; i < n; i++) {
      const pos = (i / (n - 1)) * (src.length - 1);
      const lo = Math.floor(pos);
      const hi = Math.min(lo + 1, src.length - 1);
      speed[i] = src[lo] + (src[hi] - src[lo]) * (pos - lo);
    }
  }

  const total = dist[n - 1];
  if (total <= 0) return null;

  const times = new Array<number>(nSegments).fill(0);
  for (let i = 1; i < n; i++) {
    const dd = dist[i] - dist[i - 1];
    if (dd <= 0) continue;
    const v = Math.max((speed[i] + speed[i - 1]) / 2, 1) / 3.6; // kph -> m/s
    const mid = (dist[i] + dist[i - 1]) / 2;
    const seg = Math.min(nSegments - 1, Math.max(0, Math.floor((mid / total) * nSegments)));
    times[seg] += dd / v;
  }

  const sum = times.reduce((a, b) => a + b, 0);
  if (sum <= 0) return null;
  const scale = lap.lap_time / sum;
  return times.map((t) => t * scale);
}

export interface SessionStats {
  lapCount: number;
  bestIndex: number;
  bestTime: number;
  /** Median of valid laps. */
  medianTime: number | null;
  /** Std deviation of valid lap times; null with < 2 valid laps. */
  stdDev: number | null;
  /** Best microsectors of all valid laps combined; null with < 2 valid laps. */
  theoreticalBest: number | null;
  /** Per lap: within VALID_LAP_FACTOR of the session best. */
  validLap: boolean[];
  /** Per lap: gap to session best. */
  deltaToBest: number[];
}

export function computeSessionStats(
  session: ParsedSession,
  nSegments = 12
): SessionStats {
  const laps = session.laps;
  const times = laps.map((l) => l.lap_time);

  let bestIndex = 0;
  for (let i = 1; i < times.length; i++) {
    if (times[i] < times[bestIndex]) bestIndex = i;
  }
  const bestTime = times[bestIndex];

  const validLap = times.map((t) => t <= bestTime * VALID_LAP_FACTOR);
  const valid = times.filter((_, i) => validLap[i]);

  let medianTime: number | null = null;
  if (valid.length > 0) {
    const sorted = [...valid].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    medianTime =
      sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  let stdDev: number | null = null;
  if (valid.length >= 2) {
    const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
    stdDev = Math.sqrt(
      valid.reduce((a, t) => a + (t - mean) ** 2, 0) / valid.length
    );
  }

  let theoreticalBest: number | null = null;
  const perLapSegments: number[][] = [];
  laps.forEach((lap, i) => {
    if (!validLap[i]) return;
    const segs = segmentTimes(lap, nSegments);
    if (segs) perLapSegments.push(segs);
  });
  if (perLapSegments.length >= 2) {
    let sum = 0;
    for (let s = 0; s < nSegments; s++) {
      let min = Infinity;
      for (const segs of perLapSegments) min = Math.min(min, segs[s]);
      sum += min;
    }
    theoreticalBest = sum;
  }

  return {
    lapCount: laps.length,
    bestIndex,
    bestTime,
    medianTime,
    stdDev,
    theoreticalBest,
    validLap,
    deltaToBest: times.map((t) => t - bestTime),
  };
}
