"use client";

import React, { useState } from "react";
import { format } from "date-fns";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ArrowUpDown,
  Search,
} from "lucide-react";
import { clsx } from "clsx";
import axios from "axios";
import { BuildInfo, TestCaseResult } from "@/lib/types";

interface BuildsTableProps {
  builds: BuildInfo[];
  branch: string;
  loading?: boolean;
}

type SortKey = "buildNumber" | "timestamp" | "result" | "failedTestCount";
type SortDir = "asc" | "desc";

export default function BuildsTable({ builds, branch, loading }: BuildsTableProps) {
  const [expandedBuild, setExpandedBuild] = useState<number | null>(null);
  const [testReports, setTestReports] = useState<
    Record<number, TestCaseResult[]>
  >({});
  const [loadingBuild, setLoadingBuild] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("buildNumber");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showOnlyFailures, setShowOnlyFailures] = useState(false);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sortedBuilds = [...builds].sort((a, b) => {
    const multiplier = sortDir === "asc" ? 1 : -1;
    if (sortKey === "result") {
      return multiplier * a.result.localeCompare(b.result);
    }
    return multiplier * ((a[sortKey] as number) - (b[sortKey] as number));
  });

  const filteredBuilds = sortedBuilds.filter((b) => {
    // Filter by failure toggle
    if (showOnlyFailures && b.result !== "FAILURE" && b.result !== "UNSTABLE") {
      return false;
    }

    // Filter by search query (Build Number or Result)
    const query = searchQuery.toLowerCase();
    if (!query) return true;

    return (
      String(b.buildNumber).includes(query) ||
      b.result.toLowerCase().includes(query) ||
      b.failedTestNames.some((name) => name.toLowerCase().includes(query))
    );
  });

  const toggleExpand = async (buildNumber: number) => {
    if (expandedBuild === buildNumber) {
      setExpandedBuild(null);
      return;
    }

    setExpandedBuild(buildNumber);

    if (!testReports[buildNumber]) {
      setLoadingBuild(buildNumber);
      try {
        const res = await axios.get(
          `/api/builds/${buildNumber}/tests?branch=${branch}`
        );
        setTestReports((prev) => ({ ...prev, [buildNumber]: res.data }));
      } catch (err) {
        console.error("Failed to fetch test report", err);
      } finally {
        setLoadingBuild(null);
      }
    }
  };

  const getResultStyle = (result: string) => {
    switch (result) {
      case "SUCCESS":
        return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
      case "FAILURE":
        return "text-rose-400 bg-rose-400/10 border-rose-400/20";
      case "UNSTABLE":
        return "text-amber-400 bg-amber-400/10 border-amber-400/20";
      default:
        return "text-slate-400 bg-slate-400/10 border-slate-400/20";
    }
  };

  const getResultIcon = (result: string) => {
    switch (result) {
      case "SUCCESS":
        return <CheckCircle2 className="w-3.5 h-3.5" />;
      case "FAILURE":
        return <XCircle className="w-3.5 h-3.5" />;
      case "UNSTABLE":
        return <AlertCircle className="w-3.5 h-3.5" />;
      default:
        return null;
    }
  };

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

  return (
    <div className="glass-card animate-fade-in relative overflow-hidden" style={{ animationDelay: "300ms" }}>
      {/* Table Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 z-10 bg-slate-950/40 backdrop-blur-[2px] animate-fade-in">
          <div className="sticky top-[40vh] flex flex-col items-center justify-center">
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 rounded-full border-2 border-blue-500/20 animate-[spin_3s_linear_infinite]" />
              <div className="absolute inset-2 rounded-full border-2 border-violet-500/20 animate-[spin_2s_linear_infinite_reverse]" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 animate-pulse blur-sm" />
                <div className="absolute w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_10px_#60a5fa] animate-[orbit_2s_linear_infinite]" />
              </div>
            </div>
            <p className="mt-4 text-[10px] font-bold tracking-[0.3em] text-blue-400/80 uppercase animate-pulse">
              Neural Scan Active
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

      {/* Table Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-4 border-b border-slate-800/60">
        <div className="relative flex-1 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
          <input
            type="text"
            placeholder="Search build #, status, or test name..."
            className="w-full bg-slate-950/50 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600/40 transition-all placeholder:text-slate-600"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button
          onClick={() => setShowOnlyFailures(!showOnlyFailures)}
          className={clsx(
            "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-all",
            showOnlyFailures
              ? "bg-rose-500/15 border-rose-500/40 text-rose-400"
              : "bg-slate-900/50 border-slate-800 text-slate-400 hover:text-slate-200"
          )}
        >
          <div
            className={clsx(
              "w-2 h-2 rounded-full",
              showOnlyFailures ? "bg-rose-500 animate-pulse" : "bg-slate-600"
            )}
          />
          Only Failures
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-800/60 bg-slate-900/30">
              <th className="px-4 py-3 w-10"></th>
              <th className="px-4 py-3">
                <SortHeader label="Build #" field="buildNumber" />
              </th>
              <th className="px-4 py-3">
                <SortHeader label="Timestamp" field="timestamp" />
              </th>
              <th className="px-4 py-3">
                <SortHeader label="Result" field="result" />
              </th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Branch / Stage
              </th>
              <th className="px-4 py-3">
                <SortHeader label="Failed Tests" field="failedTestCount" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40">
            {filteredBuilds.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-12 text-center text-slate-500 text-sm italic"
                >
                  No builds found for the selected filters.
                </td>
              </tr>
            ) : (
              filteredBuilds.map((build) => (
                <React.Fragment key={build.buildNumber}>
                  <tr
                    className="hover:bg-slate-800/20 transition-colors cursor-pointer"
                    onClick={() => toggleExpand(build.buildNumber)}
                  >
                    <td className="px-4 py-3.5 text-slate-500">
                      {expandedBuild === build.buildNumber ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </td>
                    <td className="px-4 py-3.5 font-mono font-medium text-blue-400 text-sm">
                      #{build.buildNumber}
                    </td>
                    <td className="px-4 py-3.5 text-slate-300 text-sm">
                      {format(
                        new Date(build.timestamp),
                        "MMM dd, yyyy HH:mm"
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={clsx(
                          "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border",
                          getResultStyle(build.result)
                        )}
                      >
                        {getResultIcon(build.result)}
                        {build.result}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-slate-200 truncate max-w-[150px]" title={build.devBranch}>
                          {(() => {
                            const dev = build.devBranch;
                            const stage = build.dashboardStage?.toLowerCase();
                            const isHash = /^[a-f0-9]{40}$/.test(dev) || /^[a-f0-9]{7,12}$/.test(dev);
                            
                            if (stage === "qa") return "QA";
                            if (dev === "master") return "master";
                            if (isHash) return `master (${dev.substring(0, 7)})`;
                            return dev || "N/A";
                          })()}
                        </span>
                        {build.dashboardStage && build.dashboardStage.toLowerCase() !== "qa" && (
                          <span className="text-[10px] text-slate-500 uppercase tracking-tighter">
                            {build.dashboardStage}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      {build.failedTestCount > 0 ? (
                        <span className="text-rose-400 font-medium text-sm">
                          {build.failedTestCount}
                        </span>
                      ) : (
                        <span className="text-slate-600 text-sm">0</span>
                      )}
                      <span className="text-slate-600 text-xs ml-1">
                        / {build.totalTestCount}
                      </span>
                    </td>
                  </tr>

                  {/* Expanded Row */}
                  {expandedBuild === build.buildNumber && (
                    <tr className="bg-slate-900/20">
                      <td colSpan={5} className="px-0 py-0">
                        <div className="p-4 pl-14">
                          {loadingBuild === build.buildNumber ? (
                            <div className="flex items-center gap-2 text-slate-400 py-6 justify-center">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span className="text-sm">
                                Loading test results...
                              </span>
                            </div>
                          ) : testReports[build.buildNumber] ? (
                            <TestResultsPanel
                              tests={testReports[build.buildNumber]}
                              searchQuery={searchQuery}
                              buildNumber={build.buildNumber}
                            />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TestResultsPanel({
  tests,
  searchQuery,
  buildNumber,
}: {
  tests: TestCaseResult[];
  searchQuery: string;
  buildNumber: number;
}) {
  const failures = tests.filter(
    (t) =>
      t.status !== "PASSED" && t.status !== "FIXED" && t.status !== "SKIPPED"
  );

  if (tests.length === 0) {
    return (
      <div className="py-8 text-slate-500 text-sm italic text-center border border-dashed border-slate-800 rounded-xl">
        No test results recorded for this build.
      </div>
    );
  }

  if (failures.length === 0) {
    return (
      <div className="flex items-center gap-3 text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 p-4 rounded-xl">
        <div className="p-2 bg-emerald-400/20 rounded-lg">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <div>
          <p className="font-bold">All Tests Passed</p>
          <p className="text-xs text-emerald-400/70">
            Verified {tests.length} test cases successfully.
          </p>
        </div>
      </div>
    );
  }

  const displayed = failures.filter((tc) => {
    const query = searchQuery.toLowerCase();
    if (!query) return true;
    
    // If the query is just the build number, don't filter the tests themselves
    if (query === String(buildNumber)) return true;
    
    return tc.name.toLowerCase().includes(query);
  });

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-slate-400 flex items-center gap-2">
        <XCircle className="w-4 h-4 text-rose-500" />
        Failed Test Cases ({failures.length})
      </h4>
      <div className="divide-y divide-slate-800/50 bg-slate-950/30 rounded-xl border border-slate-800/50 overflow-hidden">
        {displayed.map((tc, idx) => (
          <div
            key={idx}
            className="p-4 flex flex-col gap-1.5 hover:bg-slate-800/15 transition-colors"
          >
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-slate-200 font-medium truncate">
                {tc.name}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                {tc.duration !== undefined && (
                  <span className="text-xs text-slate-600">
                    {tc.duration.toFixed(1)}s
                  </span>
                )}
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  {tc.status}
                </span>
              </div>
            </div>
            {tc.errorDetails && (
              <pre className="mt-1.5 p-3 bg-slate-950/60 rounded-lg text-[11px] text-rose-300/75 overflow-x-auto border border-rose-500/10 font-mono max-h-40 overflow-y-auto">
                {tc.errorDetails}
              </pre>
            )}
          </div>
        ))}
        {failures.length > 0 && displayed.length === 0 && (
          <div className="p-8 text-slate-500 text-sm italic text-center">
            No failed tests match &quot;{searchQuery}&quot;
          </div>
        )}
      </div>
    </div>
  );
}
