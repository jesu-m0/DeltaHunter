import { useContext } from "react";
import { ChartHeightContext } from "./chartHeightContext";

/**
 * Returns the chart's pixel height: the enclosing ChartCard's height if the
 * chart is wrapped in one, otherwise the chart's natural base height.
 */
export function useChartHeight(base: number): number {
  const override = useContext(ChartHeightContext);
  return override ?? base;
}
