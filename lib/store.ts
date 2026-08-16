import { create } from "zustand";
import { describeNetworkError, describeResponseError, readJson } from "./apiError";
import type { AnalysisResponse, ParsedSession } from "./types";

/**
 * Build the /compare payload for one driver: only the selected lap plus
 * session meta, instead of the whole parsed session. Long sessions produce
 * multi-MB JSON, which is slow and can exceed the API's request size limit.
 */
export function lapPayload(session: ParsedSession, lapIndex: number) {
  const idx =
    lapIndex >= 0 && lapIndex < session.laps.length
      ? lapIndex
      : session.best_index;
  return {
    ...session.laps[idx],
    driver: session.driver,
    car: session.car,
    track: session.track,
  };
}

interface AnalysisStore {
  data: AnalysisResponse | null;
  parsedUser: ParsedSession | null;
  parsedRef: ParsedSession | null;
  userLapIndex: number;
  refLapIndex: number;
  comparing: boolean;
  error: string | null;
  activeSector: number | null;
  showUser: boolean;
  showRef: boolean;
  markerDist: number | null;
  setData: (data: AnalysisResponse) => void;
  setParsed: (user: ParsedSession, ref: ParsedSession, userLapIndex?: number, refLapIndex?: number) => void;
  setUserLapIndex: (i: number) => void;
  setRefLapIndex: (i: number) => void;
  recompare: () => Promise<void>;
  setActiveSector: (id: number | null) => void;
  setShowUser: (v: boolean) => void;
  setShowRef: (v: boolean) => void;
  setMarkerDist: (d: number | null) => void;
  reset: () => void;
}

export const useAnalysisStore = create<AnalysisStore>((set, get) => ({
  data: null,
  parsedUser: null,
  parsedRef: null,
  userLapIndex: -1,
  refLapIndex: -1,
  comparing: false,
  error: null,
  activeSector: null,
  showUser: true,
  showRef: true,
  markerDist: null,
  setData: (data) =>
    set({ data, activeSector: null, markerDist: null, error: null }),
  setParsed: (user, ref, userLapIndex, refLapIndex) =>
    set({
      parsedUser: user,
      parsedRef: ref,
      userLapIndex: userLapIndex ?? user.best_index,
      refLapIndex: refLapIndex ?? ref.best_index,
    }),
  setUserLapIndex: (i) => set({ userLapIndex: i }),
  setRefLapIndex: (i) => set({ refLapIndex: i }),
  recompare: async () => {
    const { parsedUser, parsedRef, userLapIndex, refLapIndex } = get();
    if (!parsedUser || !parsedRef) return;
    set({ comparing: true, error: null });
    const step = "Comparing the selected laps";
    try {
      let res: Response;
      try {
        res = await fetch("/api/analyze/compare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_lap: lapPayload(parsedUser, userLapIndex),
            ref_lap: lapPayload(parsedRef, refLapIndex),
          }),
        });
      } catch (e) {
        throw new Error(describeNetworkError(e, step));
      }
      if (!res.ok) throw new Error(await describeResponseError(res, step));

      const data = await readJson<AnalysisResponse>(res, step);
      set({ data, activeSector: null, markerDist: null, comparing: false });
    } catch (e) {
      set({
        comparing: false,
        error: e instanceof Error ? e.message : "Compare failed",
      });
    }
  },
  setActiveSector: (id) => set({ activeSector: id, markerDist: null }),
  setShowUser: (v) => set({ showUser: v }),
  setShowRef: (v) => set({ showRef: v }),
  setMarkerDist: (d) => set({ markerDist: d }),
  reset: () =>
    set({
      data: null,
      parsedUser: null,
      parsedRef: null,
      userLapIndex: -1,
      refLapIndex: -1,
      comparing: false,
      error: null,
      activeSector: null,
      showUser: true,
      showRef: true,
      markerDist: null,
    }),
}));
