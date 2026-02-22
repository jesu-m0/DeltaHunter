import { create } from "zustand";
import type { AnalysisResponse } from "./types";

interface AnalysisStore {
  data: AnalysisResponse | null;
  activeSector: number | null;
  showUser: boolean;
  showRef: boolean;
  markerDist: number | null;
  setData: (data: AnalysisResponse) => void;
  setActiveSector: (id: number | null) => void;
  setShowUser: (v: boolean) => void;
  setShowRef: (v: boolean) => void;
  setMarkerDist: (d: number | null) => void;
  reset: () => void;
}

export const useAnalysisStore = create<AnalysisStore>((set) => ({
  data: null,
  activeSector: null,
  showUser: true,
  showRef: true,
  markerDist: null,
  setData: (data) => set({ data, activeSector: null, markerDist: null }),
  setActiveSector: (id) => set({ activeSector: id, markerDist: null }),
  setShowUser: (v) => set({ showUser: v }),
  setShowRef: (v) => set({ showRef: v }),
  setMarkerDist: (d) => set({ markerDist: d }),
  reset: () => set({ data: null, activeSector: null, showUser: true, showRef: true, markerDist: null }),
}));
