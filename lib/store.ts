import { create } from "zustand";
import type { AnalysisResponse, ParsedSession } from "./types";

interface AnalysisStore {
  data: AnalysisResponse | null;
  parsedUser: ParsedSession | null;
  parsedRef: ParsedSession | null;
  userLapIndex: number;
  refLapIndex: number;
  comparing: boolean;
  activeSector: number | null;
  showUser: boolean;
  showRef: boolean;
  markerDist: number | null;
  setData: (data: AnalysisResponse) => void;
  setParsed: (user: ParsedSession, ref: ParsedSession) => void;
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
  activeSector: null,
  showUser: true,
  showRef: true,
  markerDist: null,
  setData: (data) => set({ data, activeSector: null, markerDist: null }),
  setParsed: (user, ref) =>
    set({
      parsedUser: user,
      parsedRef: ref,
      userLapIndex: user.best_index,
      refLapIndex: ref.best_index,
    }),
  setUserLapIndex: (i) => set({ userLapIndex: i }),
  setRefLapIndex: (i) => set({ refLapIndex: i }),
  recompare: async () => {
    const { parsedUser, parsedRef, userLapIndex, refLapIndex } = get();
    if (!parsedUser || !parsedRef) return;
    set({ comparing: true });
    try {
      const res = await fetch("/api/analyze/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_lap: parsedUser,
          ref_lap: parsedRef,
          user_lap_index: userLapIndex,
          ref_lap_index: refLapIndex,
        }),
      });
      if (!res.ok) throw new Error("Compare failed");
      const data: AnalysisResponse = await res.json();
      set({ data, activeSector: null, markerDist: null, comparing: false });
    } catch {
      set({ comparing: false });
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
      activeSector: null,
      showUser: true,
      showRef: true,
      markerDist: null,
    }),
}));
