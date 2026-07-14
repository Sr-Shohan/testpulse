"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from "recharts";
import { FlakyTestData, BuildInfo } from "@/lib/types";
import { BarChart2, Target, Zap } from "lucide-react";
import { useChartPalette } from "@/lib/chartColors";

interface FailureInsightsProps {
  tests: FlakyTestData[];
  builds: BuildInfo[];
}

// ─── Stability Gauge ─────────────────────────────────────────
function StabilityGauge({ builds }: { builds: BuildInfo[] }) {
  const palette = useChartPalette();
  const total = builds.length;
  const passed = builds.filter((b) => b.result === "SUCCESS").length;
  const rate = total > 0 ? Math.round((passed / total) * 100) : 0;

  const color =
    rate >= 80 ? "#10b981" : rate >= 50 ? "#f59e0b" : "#f43f5e";
  const label =
    rate >= 80 ? "Healthy" : rate >= 50 ? "Degraded" : "Critical";

  const gaugeData = [{ value: rate, fill: color }];

  return (
    <div className="glass-card p-5 animate-fade-in" style={{ animationDelay: "100ms" }}>
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-4 h-4 text-blue-400" />
        <h3 className="text-sm font-semibold text-slate-200">
          Build Success Rate
        </h3>
      </div>
      <div className="relative flex items-center justify-center" style={{ height: 160, minHeight: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            innerRadius="65%"
            outerRadius="90%"
            data={gaugeData}
            startAngle={210}
            endAngle={-30}
          >
            <PolarAngleAxis
              type="number"
              domain={[0, 100]}
              angleAxisId={0}
              tick={false}
            />
            {/* Background track */}
            <RadialBar
              background={{ fill: palette.trackMuted }}
              dataKey="value"
              cornerRadius={8}
              angleAxisId={0}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-3xl font-bold tabular-nums"
            style={{ color }}
          >
            {rate}%
          </span>
          <span
            className="text-xs font-semibold mt-0.5"
            style={{ color }}
          >
            {label}
          </span>
          <span className="text-[10px] text-slate-600 mt-1">
            {passed}/{total} builds
          </span>
        </div>
      </div>
    </div>
  );
}
// ─── Flaky vs Always-Failing Breakdown ───────────────────────
function TestHealthBreakdown({ tests }: { tests: FlakyTestData[] }) {
  const total = tests.filter((t) => t.totalRuns > 0).length;
  const alwaysPassing = tests.filter(
    (t) => t.failureCount === 0 && t.totalRuns > 0
  ).length;
  const flaky = tests.filter((t) => t.isFlaky).length;
  const alwaysFailing = tests.filter(
    (t) => t.flakyScore > 0.8 && t.failureCount > 0
  ).length;

  const segments = [
    { label: "Always Passing", count: alwaysPassing, color: "#10b981" },
    { label: "Flaky", count: flaky, color: "#f59e0b" },
    { label: "Always Failing", count: alwaysFailing, color: "#f43f5e" },
  ];

  return (
    <div
      className="glass-card p-5 animate-fade-in"
      style={{ animationDelay: "400ms" }}
    >
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-4 h-4 text-amber-400" />
        <h3 className="text-sm font-semibold text-slate-200">
          Test Health Distribution
        </h3>
        <span className="ml-auto text-[10px] text-slate-500">
          {total} total tests
        </span>
      </div>

      {/* Stacked bar */}
      <div className="h-5 w-full rounded-full overflow-hidden flex mb-4 bg-slate-800/60">
        {segments.map((s) => {
          const pct = total > 0 ? (s.count / total) * 100 : 0;
          if (pct === 0) return null;
          return (
            <div
              key={s.label}
              style={{ width: `${pct}%`, backgroundColor: s.color }}
              className="transition-all duration-500"
              title={`${s.label}: ${s.count} (${pct.toFixed(0)}%)`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="space-y-2">
        {segments.map((s) => {
          const pct = total > 0 ? ((s.count / total) * 100).toFixed(0) : "0";
          return (
            <div key={s.label} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-sm inline-block"
                  style={{ backgroundColor: s.color }}
                />
                <span className="text-slate-400">{s.label}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="font-bold" style={{ color: s.color }}>
                  {s.count}
                </span>
                <span className="text-slate-600 w-8 text-right">{pct}%</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
// ─── Main Export ──────────────────────────────────────────────
export default function FailureInsights({ tests, builds }: FailureInsightsProps) {
  return (
    <div className="space-y-4">
      <StabilityGauge builds={builds} />
      <TestHealthBreakdown tests={tests} />
    </div>
  );
}
