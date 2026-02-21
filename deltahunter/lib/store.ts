import { create } from "zustand";
import type { AnalysisResponse } from "./types";

interface AnalysisStore {
  data: AnalysisResponse | null;
  activeSector: number | null;
  showUser: boolean;
  showRef: boolean;
  setData: (data: AnalysisResponse) => void;
  setActiveSector: (id: number | null) => void;
  setShowUser: (v: boolean) => void;
  setShowRef: (v: boolean) => void;
  reset: () => void;
}

export const useAnalysisStore = create<AnalysisStore>((set) => ({
  data: null,
  activeSector: null,
  showUser: true,
  showRef: true,
  setData: (data) => set({ data, activeSector: null }),
  setActiveSector: (id) => set({ activeSector: id }),
  setShowUser: (v) => set({ showUser: v }),
  setShowRef: (v) => set({ showRef: v }),
  reset: () => set({ data: null, activeSector: null, showUser: true, showRef: true }),
}));
