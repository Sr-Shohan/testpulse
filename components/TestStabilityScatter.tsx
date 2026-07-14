"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  ZAxis,
  Label,
} from "recharts";
import { FlakyTestData } from "@/lib/types";
import { Crosshair } from "lucide-react";
import { useChartPalette } from "@/lib/chartColors";

interface TestStabilityScatterProps {
  tests: FlakyTestData[];
}

interface ScatterPoint {
  x: number;       // total runs
  y: number;       // failure rate %
  z: number;       // bubble size (failure count)
  name: string;
  fullName: string;
  failures: number;
  passes: number;
  total: number;
  isFlaky: boolean;
  actualX: number;
  actualY: number;
  category: "healthy" | "flaky" | "critical";
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d: ScatterPoint = payload[0]?.payload;
  if (!d) return null;

  const copyToClipboard = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(d.fullName);
  };

  const catColor =
    d.category === "healthy"
      ? "#10b981"
      : d.category === "flaky"
      ? "#f59e0b"
      : "#f43f5e";
  const catLabel =
    d.category === "healthy"
      ? "Stable"
      : d.category === "flaky"
      ? "Flaky"
      : "Critical";

  return (
    <div className="bg-slate-900/95 border border-slate-700/50 rounded-xl shadow-2xl p-4 max-w-[280px] backdrop-blur-md z-50 pointer-events-auto ring-1 ring-white/10 group/tooltip">
      <div className="flex items-center justify-between gap-4 mb-2">
        <p
          className="text-[10px] font-bold uppercase tracking-tight"
          style={{ color: catColor }}
        >
          {catLabel}
        </p>
        <button
          onClick={copyToClipboard}
          className="p-1 hover:bg-slate-800 rounded-md transition-colors group/copy"
          title="Copy test name"
        >
          <Crosshair className="w-3 h-3 text-slate-500 group-hover/copy:text-blue-400 rotate-45" />
        </button>
      </div>
      <p className="text-slate-100 text-[11px] font-medium mb-3 leading-relaxed break-all border-b border-slate-800 pb-2 selection:bg-blue-500/30">
        {d.fullName}
      </p>
      <div className="space-y-2">
        <div className="flex justify-between gap-4">
          <span className="text-slate-500 text-[10px] uppercase">Total Runs</span>
          <span className="text-slate-200 font-bold text-xs">{d.total}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-500 text-[10px] uppercase">Failures</span>
          <span className="text-rose-400 font-bold text-xs">{d.failures}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-500 text-[10px] uppercase">Passes</span>
          <span className="text-emerald-400 font-bold text-xs">{d.passes}</span>
        </div>
        <div className="flex justify-between gap-4 pt-1 border-t border-slate-800">
          <span className="text-slate-500 text-[10px] uppercase">Fail Rate</span>
          <span className="font-bold text-xs" style={{ color: catColor }}>
            {d.actualY.toFixed(0)}%
          </span>
        </div>
      </div>
    </div>
  );
};

export default function TestStabilityScatter({
  tests,
}: TestStabilityScatterProps) {
  const palette = useChartPalette();
  // Build scatter data only from tests that have runs
  const points: ScatterPoint[] = tests
    .map((t) => {
      const failRate = Math.round(t.flakyScore * 100);
      
      // Stable pseudo-random jitter based on test name
      // This prevents bubbles from overlapping perfectly
      let hash = 0;
      for (let i = 0; i < t.testName.length; i++) {
        hash = t.testName.charCodeAt(i) + ((hash << 5) - hash);
      }
      const jitterX = ((Math.abs(hash % 100) / 100) - 0.5) * 0.8;
      const jitterY = ((Math.abs((hash >> 5) % 100) / 100) - 0.5) * 3;

      const category: ScatterPoint["category"] =
        failRate < 10
          ? "healthy"
          : failRate <= 80
          ? "flaky"
          : "critical";

      return {
        x: t.totalRuns + jitterX,
        y: failRate + jitterY,
        actualX: t.totalRuns,
        actualY: failRate,
        z: Math.max(t.failureCount * 12, 60), // Larger bubble base
        name:
          t.testName.length > 28
            ? "…" + t.testName.slice(-26)
            : t.testName,
        fullName: t.testName,
        failures: t.failureCount,
        passes: t.passCount,
        total: t.totalRuns,
        isFlaky: t.isFlaky,
        category,
      };
    });

  const healthy = points.filter((p) => p.category === "healthy");
  const flaky = points.filter((p) => p.category === "flaky");
  const critical = points.filter((p) => p.category === "critical");

  const actualXValues = points.map((p) => (p as any).actualX);
  const maxRuns = Math.max(...actualXValues, 1);

  return (
    <div
      className="glass-card p-6 min-h-[480px] h-full animate-fade-in flex flex-col"
      style={{ animationDelay: "200ms" }}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <div className="flex items-center gap-2">
          <Crosshair className="w-4 h-4 text-blue-400" />
          <h2 className="text-base font-semibold text-slate-200">
            Test Stability Map
          </h2>
        </div>
        <div className="ml-auto flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
            <span className="text-slate-500 whitespace-nowrap">Stable ({healthy.length})</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]" />
            <span className="text-slate-500 whitespace-nowrap">Flaky ({flaky.length})</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.3)]" />
            <span className="text-slate-500 whitespace-nowrap">Critical ({critical.length})</span>
          </span>
        </div>
      </div>
      <p className="text-[11px] text-slate-500 mb-6 italic">
        Viewing {points.length} unique tests plotted by confidence and stability
      </p>

      {points.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-600 text-sm italic">
          No test data for this time range.
        </div>
      ) : (
        <div className="flex-1 min-h-[340px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 40, bottom: 40, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} vertical={true} opacity={0.6} />

              <XAxis
                type="number"
                dataKey="x"
                domain={[0, maxRuns * 1.1 + 2]}
                stroke={palette.axis}
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tick={{ fill: palette.tick }}
                allowDecimals={false}
              >
                <Label
                  value="← Lower Confidence (Fewer Runs)  |  Higher Confidence (More Runs) →"
                  offset={-25}
                  position="insideBottom"
                  style={{ fill: palette.axis, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.025em' }}
                />
              </XAxis>

              <YAxis
                type="number"
                dataKey="y"
                domain={[-5, 110]}
                stroke={palette.axis}
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => (v >= 0 && v <= 100 ? `${v}%` : "")}
                tick={{ fill: palette.tick }}
              >
                <Label
                  value="FAILURE RATE %"
                  angle={-90}
                  position="insideLeft"
                  offset={0}
                  style={{ fill: palette.tick, fontSize: 10, fontWeight: 600, letterSpacing: '0.025em' }}
                />
              </YAxis>

              <ZAxis type="number" dataKey="z" range={[60, 600]} />

              <Tooltip
                content={<CustomTooltip />}
                cursor={{ strokeDasharray: "3 3", stroke: palette.axis }}
                wrapperStyle={{ 
                  zIndex: 1000, 
                  pointerEvents: 'auto',
                  outline: 'none'
                }}
                isAnimationActive={false}
                offset={15}
              />

              <ReferenceLine y={10} stroke="#10b981" strokeDasharray="4 4" strokeOpacity={0.2} label={{ position: 'right', value: 'STABLE', fill: '#10b981', fontSize: 8, opacity: 0.5 }} />
              <ReferenceLine y={80} stroke="#f43f5e" strokeDasharray="4 4" strokeOpacity={0.2} label={{ position: 'right', value: 'CRITICAL', fill: '#f43f5e', fontSize: 8, opacity: 0.5 }} />

              <Scatter name="Stable" data={healthy}>
                {healthy.map((entry: any, i) => (
                  <Cell 
                    key={i} 
                    fill="#10b981" 
                    fillOpacity={0.5} 
                    stroke="#10b981"
                    strokeWidth={1}
                    className="hover:fill-opacity-100 transition-all duration-300 pointer-events-auto"
                  />
                ))}
              </Scatter>

              <Scatter name="Flaky" data={flaky}>
                {flaky.map((entry: any, i) => (
                  <Cell 
                    key={i} 
                    fill="#f59e0b" 
                    fillOpacity={0.7} 
                    stroke="#f59e0b"
                    strokeWidth={1}
                    className="hover:fill-opacity-100 transition-all duration-300 pointer-events-auto"
                  />
                ))}
              </Scatter>

              <Scatter name="Critical" data={critical}>
                {critical.map((entry: any, i) => (
                  <Cell 
                    key={i} 
                    fill="#f43f5e" 
                    fillOpacity={0.8} 
                    stroke="#f43f5e"
                    strokeWidth={1}
                    className="hover:fill-opacity-100 transition-all duration-300 pointer-events-auto"
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
