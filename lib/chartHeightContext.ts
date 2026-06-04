import { createContext } from "react";

/**
 * When a chart is rendered inside a resizable ChartCard, the card supplies its
 * current pixel height through this context. Outside a card the value is null
 * and charts fall back to their natural base height.
 */
export const ChartHeightContext = createContext<number | null>(null);
