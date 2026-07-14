"use client";

import { useTheme } from "@/components/ThemeProvider";

export interface ChartPalette {
  grid: string;
  axis: string;
  tick: string;
  tooltipBg: string;
  tooltipBorder: string;
  cursor: string;
  trackMuted: string;
}

const DARK: ChartPalette = {
  grid: "#1e293b",          // slate-800
  axis: "#475569",          // slate-600
  tick: "#64748b",          // slate-500
  tooltipBg: "rgb(15 23 42)",
  tooltipBorder: "rgb(51 65 85)",
  cursor: "rgba(255,255,255,0.03)",
  trackMuted: "#1e293b",
};

const LIGHT: ChartPalette = {
  grid: "#e2e8f0",          // slate-200
  axis: "#94a3b8",          // slate-400
  tick: "#64748b",          // slate-500 (unchanged in inversion)
  tooltipBg: "rgb(255 255 255)",
  tooltipBorder: "rgb(226 232 240)",
  cursor: "rgba(15,23,42,0.04)",
  trackMuted: "#e2e8f0",
};

export function useChartPalette(): ChartPalette {
  const { theme } = useTheme();
  return theme === "dark" ? DARK : LIGHT;
}
