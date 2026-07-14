"use client";

import {
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import { format, parseISO, eachDayOfInterval, subDays, startOfDay, eachHourOfInterval, subHours, startOfHour } from "date-fns";
import { BuildInfo } from "@/lib/types";
import { TrendingUp } from "lucide-react";
import { useChartPalette } from "@/lib/chartColors";

interface TrendChartProps {
  builds: BuildInfo[];
  days: number;
}

interface DayData {
  day: string;
  date: Date;
  passed: number;
  failed: number;
  unstable: number;
  total: number;
  successRate: number | null;
  failedTests: number;
}

// Custom tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;

  const d = payload[0]?.payload as DayData;

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-4 min-w-[200px]">
      <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
        {label}
      </p>
      <div className="space-y-2">
        {d.passed > 0 && (
          <div className="flex justify-between items-center gap-4">
            <span className="flex items-center gap-1.5 text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              Passed
            </span>
            <span className="text-emerald-500 font-bold text-sm">{d.passed}</span>
          </div>
        )}
        {d.failed > 0 && (
          <div className="flex justify-between items-center gap-4">
            <span className="flex items-center gap-1.5 text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
              Failed
            </span>
            <span className="text-rose-500 font-bold text-sm">{d.failed}</span>
          </div>
        )}
        {d.unstable > 0 && (
          <div className="flex justify-between items-center gap-4">
            <span className="flex items-center gap-1.5 text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
              Unstable
            </span>
            <span className="text-amber-500 font-bold text-sm">{d.unstable}</span>
          </div>
        )}
        <div className="border-t border-slate-700/60 pt-2 mt-1 flex justify-between items-center gap-4">
          <span className="text-xs text-slate-400">Total Builds</span>
          <span className="text-slate-200 font-bold text-sm">{d.total}</span>
        </div>
        {d.successRate !== null && (
          <div className="flex justify-between items-center gap-4">
            <span className="text-xs text-slate-400">Success Rate</span>
            <span
              className={`font-bold text-sm ${
                d.successRate >= 80
                  ? "text-emerald-500"
                  : d.successRate >= 50
                  ? "text-amber-500"
                  : "text-rose-500"
              }`}
            >
              {d.successRate.toFixed(0)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default function TrendChart({ builds, days }: TrendChartProps) {
  const palette = useChartPalette();
  const isHourly = days === 1;
  const now = new Date();
  
  // Define time intervals based on granularity
  const intervals = isHourly 
    ? eachHourOfInterval({ start: subHours(now, 23), end: now })
    : eachDayOfInterval({ start: subDays(startOfDay(now), days - 1), end: startOfDay(now) });

  const formatKey = isHourly ? "ha" : "MMM dd";
  const labelFormat = isHourly ? "hh:mm a" : "MMM dd";

  const dayMap: Record<string, DayData> = {};
  for (const d of intervals) {
    const key = isHourly ? format(d, "HH:00") : format(d, "MMM dd");
    const displayLabel = format(d, formatKey);
    dayMap[key] = {
      day: displayLabel,
      date: d,
      passed: 0,
      failed: 0,
      unstable: 0,
      total: 0,
      successRate: null,
      failedTests: 0,
    };
  }

  // Merge actual build data
  for (const build of builds) {
    const buildDate = new Date(build.timestamp);
    const key = isHourly ? format(buildDate, "HH:00") : format(buildDate, "MMM dd");
    
    if (!dayMap[key]) continue;
    const entry = dayMap[key];
    entry.total += 1;
    if (build.result === "SUCCESS") entry.passed += 1;
    else if (build.result === "FAILURE") entry.failed += 1;
    else if (build.result === "UNSTABLE") entry.unstable += 1;
    entry.failedTests += build.failedTestCount;
  }

  // Compute success rate (null if no builds)
  const data: DayData[] = Object.values(dayMap).sort((a,b) => a.date.getTime() - b.date.getTime()).map((d) => ({
    ...d,
    successRate:
      d.total > 0 ? Math.round((d.passed / d.total) * 100) : null,
  }));

  const hasData = builds.length > 0;

  return (
    <div
      className="glass-card p-6 h-[380px] animate-fade-in"
      style={{ animationDelay: "200ms" }}
    >
      <div className="flex items-center gap-2 mb-5">
        <TrendingUp className="w-4 h-4 text-blue-400" />
        <h2 className="text-base font-semibold text-slate-200">
          {isHourly ? "Last 24 Hours Trend" : "Build Failure Trend"}
        </h2>
        <span className="ml-auto text-xs text-slate-600 bg-slate-800/60 px-2 py-0.5 rounded-full">
          {isHourly ? "24-Hour Resolve" : `Last ${days} days`} • {builds.length} builds
        </span>
      </div>

      {!hasData ? (
        <div className="flex items-center justify-center h-[80%] text-slate-600 text-sm italic">
          No build data for this time range.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="85%">
          <ComposedChart data={data} margin={{ top: 4, right: 40, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="passGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="failGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} vertical={false} />

            <XAxis
              dataKey="day"
              stroke={palette.axis}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tick={{ fill: palette.tick }}
            />
            {/* Left Y — build counts */}
            <YAxis
              yAxisId="left"
              stroke={palette.axis}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              tick={{ fill: palette.tick }}
            />
            {/* Right Y — success rate % */}
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, 100]}
              stroke={palette.axis}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
              tick={{ fill: palette.tick }}
            />

            <Tooltip content={<CustomTooltip />} cursor={{ fill: palette.cursor }} />

            <Legend
              wrapperStyle={{ paddingTop: "12px", fontSize: "11px", color: palette.tick }}
              iconType="circle"
              iconSize={8}
            />

            {/* Reference line at 80% success */}
            <ReferenceLine
              yAxisId="right"
              y={80}
              stroke="#3b82f6"
              strokeDasharray="4 4"
              strokeOpacity={0.4}
              label={{ value: "80%", position: "right", fill: "#3b82f6", fontSize: 10 }}
            />

            {/* Stacked areas for pass/fail */}
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="passed"
              name="Passed"
              stackId="builds"
              stroke="#10b981"
              fill="url(#passGrad)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#10b981", strokeWidth: 0 }}
            />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="failed"
              name="Failed"
              stackId="builds"
              stroke="#f43f5e"
              fill="url(#failGrad)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#f43f5e", strokeWidth: 0 }}
            />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="unstable"
              name="Unstable"
              stackId="builds"
              stroke="#f59e0b"
              fill="rgba(245,158,11,0.1)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#f59e0b", strokeWidth: 0 }}
            />

            {/* Success rate line */}
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="successRate"
              name="Success Rate %"
              stroke="#3b82f6"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "#3b82f6", strokeWidth: 0 }}
              activeDot={{ r: 5, fill: "#3b82f6", strokeWidth: 2, stroke: "#1d4ed8" }}
              connectNulls
              strokeDasharray="0"
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
