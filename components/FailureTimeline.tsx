"use client";

import { format } from "date-fns";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MessageSquare,
} from "lucide-react";
import { clsx } from "clsx";
import { FlakyTestData } from "@/lib/types";

interface FailureTimelineProps {
  test: FlakyTestData;
}

const isFailureStatus = (status: string) =>
  status !== "PASSED" && status !== "FIXED" && status !== "SKIPPED";

export default function FailureTimeline({ test }: FailureTimelineProps) {
  // Count occurrences from full build history (errorMessages is deduplicated in the API)
  const errorPatterns = test.history.reduce(
    (
      acc: Record<
        string,
        { count: number; sample: string; builds: Set<number> }
      >,
      h
    ) => {
      if (!isFailureStatus(h.status) || !h.errorDetails) return acc;
      const key = h.errorDetails.substring(0, 80);
      if (!acc[key]) {
        acc[key] = { count: 0, sample: h.errorDetails, builds: new Set() };
      }
      acc[key].count++;
      acc[key].builds.add(h.buildNumber);
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Stats Row */}
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/60 border border-slate-800/50 rounded-lg">
          <span className="text-xs text-slate-500">Pass Rate</span>
          <span className="text-sm font-bold text-emerald-400">
            {Math.round(
              ((test.totalRuns - test.failureCount) / test.totalRuns) * 100
            )}
            %
          </span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/60 border border-slate-800/50 rounded-lg">
          <span className="text-xs text-slate-500">Fail Rate</span>
          <span className="text-sm font-bold text-rose-400">
            {Math.round(test.flakyScore * 100)}%
          </span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/60 border border-slate-800/50 rounded-lg">
          <span className="text-xs text-slate-500">Consecutive Fails</span>
          <span
            className={clsx(
              "text-sm font-bold",
              test.consecutiveFailures >= 3
                ? "text-rose-400"
                : test.consecutiveFailures >= 1
                ? "text-amber-400"
                : "text-emerald-400"
            )}
          >
            {test.consecutiveFailures}
          </span>
        </div>
      </div>

      {/* Timeline */}
      <div>
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
          Build History
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {[...test.history]
            .sort((a, b) => b.timestamp - a.timestamp)
            .map((h, i) => {
              const isPassed =
                h.status === "PASSED" || h.status === "FIXED";
              const isSkipped = h.status === "SKIPPED";

              return (
                <div
                  key={i}
                  className="group relative"
                  title={`Build #${h.buildNumber} — ${h.status}\n${format(
                    new Date(h.timestamp),
                    "MMM dd, HH:mm"
                  )}`}
                >
                  <div
                    className={clsx(
                      "w-7 h-7 rounded-md flex items-center justify-center transition-all duration-200 cursor-default",
                      isPassed
                        ? "bg-emerald-500/15 border border-emerald-500/25 hover:bg-emerald-500/25"
                        : isSkipped
                        ? "bg-slate-700/30 border border-slate-700/40 hover:bg-slate-700/50"
                        : "bg-rose-500/15 border border-rose-500/25 hover:bg-rose-500/25"
                    )}
                  >
                    {isPassed ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    ) : isSkipped ? (
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                    ) : (
                      <XCircle className="w-3 h-3 text-rose-400" />
                    )}
                  </div>
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                    <div className="font-medium text-slate-200">
                      Build #{h.buildNumber}
                    </div>
                    <div
                      className={clsx(
                        "font-bold",
                        isPassed ? "text-emerald-400" : "text-rose-400"
                      )}
                    >
                      {h.status}
                    </div>
                    <div className="text-slate-500">
                      {format(new Date(h.timestamp), "MMM dd, HH:mm")}
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Error Patterns */}
      {Object.keys(errorPatterns).length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <MessageSquare className="w-3 h-3" />
            Error Patterns ({Object.keys(errorPatterns).length})
          </h4>
          <div className="space-y-3">
            {Object.entries(errorPatterns)
              .sort(([, a], [, b]) => b.count - a.count)
              .slice(0, 5)
              .map(([key, data], idx) => (
                <div
                  key={idx}
                  className="bg-slate-950/40 border border-slate-800/50 rounded-xl overflow-hidden"
                >
                  <div className="border-b border-slate-800/50 bg-slate-900/40 px-4 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Pattern #{idx + 1}
                      </span>
                      <span className="shrink-0 rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-[10px] font-bold text-rose-400/90">
                        {data.count}× occurrences
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Builds
                      </span>
                      {[...data.builds]
                        .sort((a, b) => b - a)
                        .map((bn) => (
                          <span
                            key={bn}
                            className="inline-flex rounded border border-slate-700/80 bg-slate-800/80 px-2 py-0.5 font-mono text-[11px] text-slate-300"
                          >
                            #{bn}
                          </span>
                        ))}
                    </div>
                  </div>
                  <div className="p-3">
                    <pre className="text-[11px] text-rose-300/80 font-mono max-h-48 overflow-y-auto p-3 bg-slate-950/60 rounded-lg border border-rose-500/5 whitespace-pre-wrap break-all [overflow-wrap:anywhere] scrollbar-thin scrollbar-thumb-rose-500/20 scrollbar-track-transparent">
                      {data.sample}
                    </pre>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
