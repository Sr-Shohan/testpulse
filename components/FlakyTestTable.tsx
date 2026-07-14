"use client";

import React, { useState } from "react";
import { format } from "date-fns";
import {
  ChevronDown,
  ChevronRight,
  ArrowUpDown,
  Bug,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { clsx } from "clsx";
import { FlakyTestData } from "@/lib/types";
import FailureTimeline from "./FailureTimeline";

interface FlakyTestTableProps {
  tests: FlakyTestData[];
  limit?: number;
  loading?: boolean;
  title?: string;
}

type SortKey = "flakyScore" | "failureCount" | "totalRuns" | "lastFailedAt";

export default function FlakyTestTable({
  tests,
  limit,
  loading,
  title,
}: FlakyTestTableProps) {
  const [expandedTest, setExpandedTest] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("flakyScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sorted = [...tests].sort((a, b) => {
    const multiplier = sortDir === "asc" ? 1 : -1;
    const aVal = a[sortKey] ?? 0;
    const bVal = b[sortKey] ?? 0;
    return multiplier * ((aVal as number) - (bVal as number));
  });

  const displayed = limit ? sorted.slice(0, limit) : sorted;

  const SortHeader = ({
    label,
    field,
  }: {
    label: string;
    field: SortKey;
  }) => (
    <button
      onClick={() => toggleSort(field)}
      className="flex items-center gap-1 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-200 transition-colors"
    >
      {label}
      <ArrowUpDown
        className={clsx(
          "w-3 h-3",
          sortKey === field ? "text-blue-400" : "text-slate-600"
        )}
      />
    </button>
  );

  const getScoreColor = (score: number) => {
    if (score >= 0.6) return "from-rose-500 to-red-600";
    if (score >= 0.3) return "from-amber-500 to-orange-500";
    return "from-yellow-500 to-amber-400";
  };

  const getScoreTextColor = (score: number) => {
    if (score >= 0.6) return "text-rose-400";
    if (score >= 0.3) return "text-amber-400";
    return "text-yellow-400";
  };

  return (
    <div
      className="glass-card animate-fade-in overflow-hidden relative min-h-[400px]"
      style={{ animationDelay: "200ms" }}
    >
      {/* Table Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 z-10 bg-slate-950/40 backdrop-blur-[2px] animate-fade-in">
          <div className="sticky top-[40vh] flex flex-col items-center justify-center">
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 rounded-full border-2 border-amber-500/20 animate-[spin_3s_linear_infinite]" />
              <div className="absolute inset-2 rounded-full border-2 border-orange-500/20 animate-[spin_2s_linear_infinite_reverse]" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 animate-pulse blur-sm" />
                <div className="absolute w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_10px_#fbbf24] animate-[orbit_2s_linear_infinite]" />
              </div>
            </div>
            <p className="mt-4 text-[10px] font-bold tracking-[0.3em] text-amber-500/80 uppercase animate-pulse">
              Analyzing Patterns
            </p>
          </div>
          <style>{`
            @keyframes orbit {
              from { transform: rotate(0deg) translateX(28px) rotate(0deg); }
              to { transform: rotate(360deg) translateX(28px) rotate(-360deg); }
            }
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}

      <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-800/60">
        <Bug className="w-4 h-4 text-amber-400" />
        <h2 className="text-lg font-semibold text-slate-200">
          {title || (limit ? `Top ${limit} Flaky Tests` : "All Flaky Tests")}
        </h2>
        <span className="ml-auto text-xs text-slate-500 bg-slate-800/60 px-2.5 py-1 rounded-full">
          {tests.length} total
        </span>
      </div>

      <div className="overflow-x-auto">
        {/* `table-fixed` makes column widths come from the <thead> (or
            <col>) widths only, never from cell content. That's what
            keeps the expanded <td colSpan={6}> locked to the table's
            width — long error traces or build-history grids inside
            can't push the table wider. */}
        <table className="w-full text-left table-fixed">
          <thead>
            <tr className="border-b border-slate-800/60 bg-slate-900/30">
              <th className="px-4 py-3 w-10"></th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Test Name
              </th>
              <th className="px-4 py-3 w-20 sm:w-24">
                <SortHeader label="Failures" field="failureCount" />
              </th>
              <th className="px-4 py-3 w-24">
                <SortHeader label="Total Runs" field="totalRuns" />
              </th>
              <th className="px-4 py-3 w-40 sm:w-44">
                <SortHeader label="Flaky Score" field="flakyScore" />
              </th>
              <th className="hidden md:table-cell px-4 py-3 w-32">
                <SortHeader label="Last Failed" field="lastFailedAt" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40">
            {displayed.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-24 text-center">
                  <Bug className="w-12 h-12 text-slate-700 mx-auto mb-3 opacity-50" />
                  <p className="text-slate-400 font-medium">No tests found</p>
                  <p className="text-slate-600 text-sm mt-1">
                    Try adjusting your search or filter criteria.
                  </p>
                </td>
              </tr>
            ) : (
              displayed.map((test) => (
                <React.Fragment key={test.testName}>
                <tr
                  className="hover:bg-slate-800/20 transition-colors cursor-pointer"
                  onClick={() =>
                    setExpandedTest(
                      expandedTest === test.testName
                        ? null
                        : test.testName
                    )
                  }
                >
                  <td className="px-4 py-3.5 align-top text-slate-500">
                    {expandedTest === test.testName ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </td>
                  <td className="min-w-0 px-4 py-3.5 align-top">
                    <div className="flex flex-wrap items-start gap-2">
                      <span
                        className="min-w-0 text-sm font-medium text-slate-200 break-words [overflow-wrap:anywhere]"
                        title={test.testName}
                      >
                        {test.testName}
                      </span>
                      {test.consecutiveFailures >= 3 && (
                        <span
                          className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          title={`${test.consecutiveFailures} consecutive failures`}
                        >
                          <TrendingDown className="w-2.5 h-2.5" />
                          {test.consecutiveFailures}×
                        </span>
                      )}
                      {test.consecutivePasses >= 3 && (
                        <span
                          className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          title={`${test.consecutivePasses} consecutive passes`}
                        >
                          <TrendingUp className="w-2.5 h-2.5" />
                          {test.consecutivePasses}×
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 align-top">
                    <span className="text-rose-400 font-medium text-sm">
                      {test.failureCount}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 align-top text-sm text-slate-300">
                    {test.totalRuns}
                  </td>
                  <td className="px-4 py-3.5 align-top">
                    <div className="flex items-center gap-2.5">
                      {/* Progress bar */}
                      <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={clsx(
                            "h-full rounded-full bg-gradient-to-r transition-all duration-500",
                            getScoreColor(test.flakyScore)
                          )}
                          style={{
                            width: `${Math.round(test.flakyScore * 100)}%`,
                          }}
                        />
                      </div>
                      <span
                        className={clsx(
                          "text-sm font-bold tabular-nums",
                          getScoreTextColor(test.flakyScore)
                        )}
                      >
                        {Math.round(test.flakyScore * 100)}%
                      </span>
                    </div>
                  </td>
                  <td className="hidden md:table-cell whitespace-nowrap px-4 py-3.5 align-top text-sm text-slate-400">
                    {test.lastFailedAt
                      ? format(
                          new Date(test.lastFailedAt),
                          "MMM dd, HH:mm"
                        )
                      : "—"}
                  </td>
                </tr>

                {/* Expanded Detail.
                    With `table-fixed` on the table, this td is locked
                    to the table width regardless of inner content. */}
                {expandedTest === test.testName && (
                  <tr className="bg-slate-900/20">
                    <td colSpan={6} className="p-0">
                      <div className="overflow-hidden">
                        <div className="p-3 sm:p-4 sm:pl-14 space-y-4">
                          <FailureTimeline test={test} />
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            )))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
