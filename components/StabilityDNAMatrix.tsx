"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { FlakyTestData, BuildInfo } from "@/lib/types";
import { Activity, Info, Copy, CheckCircle2, XCircle, Minus, Microscope, RotateCcw } from "lucide-react";
import { clsx } from "clsx";
import FilterBar from "./FilterBar";

interface StabilityDNAMatrixProps {
  tests: FlakyTestData[];
  builds: BuildInfo[];
  days: number;
  branch: string;
  searchQuery: string;
  loading: boolean;
  onDaysChange: (days: number) => void;
  onBranchChange: (branch: string) => void;
  onSearchChange: (query: string) => void;
  onRefresh: () => void;
}

export default function StabilityDNAMatrix({
  tests,
  builds,
  days,
  branch,
  searchQuery,
  loading,
  onDaysChange,
  onBranchChange,
  onSearchChange,
  onRefresh,
}: StabilityDNAMatrixProps) {
  type SelectedCell = {
    testName: string;
    buildNumber: number;
    status: string;
    timestamp: number;
    error: string | null;
  };

  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [panelAnchor, setPanelAnchor] = useState({ x: 0, y: 0 });
  const buildInsightPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedCell) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedCell(null);
    };
    const panel = () => buildInsightPanelRef.current;
    const isInsidePanel = (target: EventTarget | null) =>
      target instanceof Node && !!panel()?.contains(target);

    const dismissIfOutsidePanel = (e: Event) => {
      if (isInsidePanel(e.target)) return;
      setSelectedCell(null);
    };

    window.addEventListener("keydown", onKey);
    const scrollOpts = { capture: true, passive: true } as const;
    window.addEventListener("wheel", dismissIfOutsidePanel, scrollOpts);
    window.addEventListener("touchmove", dismissIfOutsidePanel, scrollOpts);
    document.addEventListener("scroll", dismissIfOutsidePanel, scrollOpts);

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", dismissIfOutsidePanel, true);
      window.removeEventListener("touchmove", dismissIfOutsidePanel, true);
      document.removeEventListener("scroll", dismissIfOutsidePanel, true);
    };
  }, [selectedCell]);

  const getPanelPosition = (anchor: { x: number; y: number }) => {
    const panelW = 320;
    const estH = 300;
    const m = 12;
    let left = anchor.x - panelW / 2;
    let top = anchor.y + 8;
    if (typeof window === "undefined") return { left: 0, top: 0 };
    if (left < m) left = m;
    if (left + panelW > window.innerWidth - m) {
      left = window.innerWidth - m - panelW;
    }
    if (top + estH > window.innerHeight - m) {
      top = anchor.y - estH - 8;
    }
    if (top < m) top = m;
    return { left, top };
  };

  const toggleCellDetail = (
    anchorEl: HTMLElement,
    detail: SelectedCell
  ) => {
    if (detail.status === "NOT_RUN") return;
    const rect = anchorEl.getBoundingClientRect();
    setPanelAnchor({
      x: rect.left + rect.width / 2,
      y: rect.bottom,
    });
    setSelectedCell((prev) => {
      if (
        prev?.testName === detail.testName &&
        prev?.buildNumber === detail.buildNumber
      ) {
        return null;
      }
      return detail;
    });
  };

  // 1. Get all builds in the provided range to form our columns
  const recentBuilds = useMemo(
    () => [...builds].sort((a, b) => b.buildNumber - a.buildNumber),
    [builds]
  );

  // 2. Identify tests to display (Problematic by default, or Search Results)
  const displayedTests = useMemo(() => {
    if (searchQuery.trim().length > 0) {
      // If searching, show the tests already filtered by the parent
      // but prioritize showing the MOST BROKEN ones at the top
      return [...tests].sort((a, b) => {
        // Primary sort: Failure Rate % (highest first)
        if (b.flakyScore !== a.flakyScore) return b.flakyScore - a.flakyScore;
        // Secondary sort: Recency
        const aLastFail = a.lastFailedAt ?? 0;
        const bLastFail = b.lastFailedAt ?? 0;
        return bLastFail - aLastFail;
      }).slice(0, 50); // Limit to 50 for performance during search
    }

    // Default: Show top 20 problematic tests
    return [...tests]
      .filter((t) => t.failureCount > 0)
      .sort((a, b) => {
        // Primary sort: Failure Rate % (highest first)
        if (b.flakyScore !== a.flakyScore) return b.flakyScore - a.flakyScore;
        // Secondary sort: Recency (most recent failure first)
        const aLastFail = a.lastFailedAt ?? 0;
        const bLastFail = b.lastFailedAt ?? 0;
        return bLastFail - aLastFail;
      })
      .slice(0, 20);
  }, [tests, searchQuery]);

  /*
   * Pre-index each displayed test's history by buildNumber. Without this we
   * call `test.history.find(...)` for every (test × build) cell on every
   * render — that's up to 50 × 100 × 100 ≈ 500k linear scans per repaint
   * (search keystroke, hover, scroll, theme toggle, etc.). The Map lookup
   * collapses cell rendering to O(N × B).
   */
  const historyByTest = useMemo(() => {
    const m = new Map<
      string,
      Map<number, { buildNumber: number; timestamp: number; status: string; errorDetails: string | null }>
    >();
    for (const t of displayedTests) {
      const inner = new Map<
        number,
        { buildNumber: number; timestamp: number; status: string; errorDetails: string | null }
      >();
      for (const h of t.history) inner.set(h.buildNumber, h);
      m.set(t.testName, inner);
    }
    return m;
  }, [displayedTests]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (displayedTests.length === 0) {
    return (
      <div className="glass-card p-12 flex flex-col items-center justify-center text-slate-500 gap-4">
        <Activity className="w-12 h-12 opacity-20" />
        <p className="italic text-sm text-center max-w-xs">
          {searchQuery ? `No tests matching "${searchQuery}"` : "Your pipeline is currently a oasis of stability. No failing or flaky tests detected!"}
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 min-h-[500px] h-full animate-fade-in flex flex-col relative overflow-hidden">
      {/* Unified Command Header */}
      <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-6 mb-8 bg-slate-900/40 -mx-6 -mt-6 p-6 border-b border-slate-800/50">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
            <Microscope className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100">Stability DNA Matrix</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-xl">
              Analyzing patterns across {recentBuilds.length} builds. Use search to drill into trends.
              {" "}
              <span className="text-slate-600">
                Jenkins runs with <span className="font-mono text-slate-500">STABILITY_TEST</span> enabled
                are excluded—they repeat targeted tests for pass/fail consistency and would skew this view.
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          {/* Search Input */}
          <div className="relative group min-w-[300px]">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Microscope className="w-4 h-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
            </div>
            <input
              type="text"
              placeholder="Search test case name..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all font-mono"
            />
            {searchQuery && (
              <button 
                onClick={() => onSearchChange("")}
                className="absolute inset-y-0 right-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                title="Clear search"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <FilterBar
            days={days}
            branch={branch}
            onDaysChange={onDaysChange}
            onBranchChange={onBranchChange}
            onRefresh={onRefresh}
            loading={loading}
            hideBranch={true}
          />
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
           <Activity className="w-4 h-4 text-slate-500" />
           <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">
             {searchQuery ? `Results for "${searchQuery}"` : "Global Stability Map"}
           </span>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.2)]" />
            <span>Passed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-rose-500/80 shadow-[0_0_8px_rgba(244,63,94,0.2)]" />
            <span>Failed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-slate-800" />
            <span>Not Run</span>
          </div>
          <span className="text-[10px] font-normal normal-case tracking-normal text-slate-600">
            Click pass/fail icon to see build details
          </span>
        </div>
      </div>

      {/* Grid Container */}
      <div className="relative overflow-x-auto custom-scrollbar rounded-xl border border-slate-800/50">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-900/40">
              <th className="sticky left-0 z-20 min-w-[12rem] max-w-lg bg-slate-900/90 backdrop-blur-md p-4 text-left align-top text-[10px] font-bold uppercase tracking-widest text-slate-400 border-b border-slate-800">
                Test Name
              </th>
              {recentBuilds.map((build) => (
                <th
                  key={build.buildNumber}
                  className="min-w-[60px] border-b border-slate-800 p-4 align-top text-center text-[10px] font-bold uppercase tracking-widest text-slate-500"
                >
                  #{build.buildNumber}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/30">
            {displayedTests.map((test: FlakyTestData) => (
              <tr key={test.testName} className="group hover:bg-white/[0.02] transition-colors">
                <td className="sticky left-0 z-10 min-w-0 max-w-lg bg-slate-900/90 backdrop-blur-md p-3 align-top border-r border-slate-800/50">
                  <div className="flex flex-col">
                    <div className="mb-1 flex items-start gap-2">
                      <span
                        className="min-w-0 flex-1 text-[11px] font-bold leading-snug text-slate-200 break-words [overflow-wrap:anywhere]"
                        title={test.testName}
                      >
                        {test.testName}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(test.testName)}
                        className="shrink-0 rounded p-1 opacity-0 transition-all hover:bg-slate-800 group-hover:opacity-100"
                        aria-label="Copy test name"
                      >
                        <Copy className="h-2.5 w-2.5 text-slate-500" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={clsx(
                        "text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase",
                        test.flakyScore > 0.8 ? "bg-rose-500/10 text-rose-400" : "bg-amber-500/10 text-amber-400"
                      )}>
                        {test.flakyScore > 0.8 ? 'Broken' : 'Flaky'}
                      </span>
                      <span className="text-[9px] text-slate-600 font-medium italic">
                        {Math.round(test.flakyScore * 100)}% fail rate
                      </span>
                    </div>
                  </div>
                </td>
                
                {recentBuilds.map((build: BuildInfo) => {
                  const historyItem = historyByTest.get(test.testName)?.get(build.buildNumber);
                  const status = historyItem ? historyItem.status : 'NOT_RUN';
                  const isFailed = status !== 'PASSED' && status !== 'FIXED' && status !== 'SKIPPED' && status !== 'NOT_RUN';
                  const isPassed = status === 'PASSED' || status === 'FIXED';
                  const cellSelected =
                    selectedCell?.testName === test.testName &&
                    selectedCell?.buildNumber === build.buildNumber;

                  return (
                    <td
                      key={build.buildNumber}
                      role={status === "NOT_RUN" ? undefined : "button"}
                      tabIndex={status === "NOT_RUN" ? undefined : 0}
                      aria-label={
                        status === "NOT_RUN"
                          ? undefined
                          : `${status} build ${build.buildNumber} for this test`
                      }
                      aria-pressed={cellSelected}
                      className={clsx(
                        "rounded-lg p-1 text-center align-top outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
                        status !== "NOT_RUN" && "cursor-pointer"
                      )}
                      onClick={(e) => {
                        if (status === "NOT_RUN") return;
                        e.stopPropagation();
                        toggleCellDetail(e.currentTarget, {
                          testName: test.testName,
                          buildNumber: build.buildNumber,
                          status,
                          timestamp: build.timestamp,
                          error: historyItem?.errorDetails ?? null,
                        });
                      }}
                      onKeyDown={(e) => {
                        if (status === "NOT_RUN") return;
                        if (e.key !== "Enter" && e.key !== " ") return;
                        e.preventDefault();
                        toggleCellDetail(e.currentTarget, {
                          testName: test.testName,
                          buildNumber: build.buildNumber,
                          status,
                          timestamp: build.timestamp,
                          error: historyItem?.errorDetails ?? null,
                        });
                      }}
                    >
                      <div
                        className={clsx(
                          "mx-auto flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-300 group-hover:scale-[1.05]",
                          isPassed &&
                            "border border-emerald-500/30 bg-emerald-500/20 shadow-[inset_0_0_12px_rgba(16,185,129,0.1)]",
                          isFailed &&
                            "animate-pulse-subtle border border-rose-500/40 bg-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.15)]",
                          status === "NOT_RUN" &&
                            "border border-slate-700/20 bg-slate-800/40 opacity-50",
                          cellSelected &&
                            "ring-2 ring-blue-500/80 ring-offset-2 ring-offset-slate-950"
                        )}
                      >
                        <div className="flex h-full w-full items-center justify-center">
                          {isPassed && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                          {isFailed && <XCircle className="h-4 w-4 text-rose-500" />}
                          {status === "NOT_RUN" && <Minus className="h-3 w-3 text-slate-600" />}
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Build detail — click cell to open; click backdrop / Close / Esc / same cell again to close */}
      {selectedCell && typeof window !== "undefined" && createPortal(
        <>
          <div
            role="presentation"
            className="fixed inset-0 z-[9998] cursor-default bg-transparent"
            onClick={() => setSelectedCell(null)}
          />
          <div
            ref={buildInsightPanelRef}
          className="pointer-events-auto fixed z-[9999] w-80 animate-in fade-in rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] duration-150 zoom-in-95"
          style={getPanelPosition(panelAnchor)}
        >
          <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Build Insight
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setSelectedCell(null)}
              className="rounded px-2 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-800 hover:text-slate-300"
            >
              Close
            </button>
          </div>
          <div className="space-y-2">
            <p className="break-words rounded-md border border-slate-800/80 bg-slate-950/50 px-2.5 py-2 text-xs font-medium leading-snug tracking-tight text-slate-100 [overflow-wrap:anywhere]">
              {selectedCell.testName}
            </p>
            <div className="flex items-center justify-between rounded-md bg-white/[0.02] px-2 py-1">
              <span className="text-[10px] font-bold uppercase text-slate-500">
                Build
              </span>
              <span className="font-mono text-xs font-bold text-slate-200">
                #{selectedCell.buildNumber}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-md bg-white/[0.02] px-2 py-1">
              <span className="text-[10px] font-bold uppercase text-slate-500">
                Date
              </span>
              <span className="text-[10px] font-medium text-slate-300">
                {new Date(selectedCell.timestamp).toLocaleDateString()}{" "}
                {new Date(selectedCell.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-md bg-white/[0.02] px-2 py-1">
              <span className="text-[10px] font-bold uppercase text-slate-500">
                Status
              </span>
              <span
                className={clsx(
                  "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase",
                  selectedCell.status.includes("PASSED")
                    ? "bg-emerald-500/20 text-emerald-400"
                    : selectedCell.status.includes("NOT_RUN")
                      ? "bg-slate-800 text-slate-500"
                      : "bg-rose-500/20 text-rose-500 shadow-lg shadow-rose-500/10"
                )}
              >
                {selectedCell.status}
              </span>
            </div>
            {selectedCell.error && (
              <div className="mt-2 pt-2 border-t border-slate-800/50">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[9px] font-bold text-rose-500 uppercase flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-rose-500 animate-pulse" />
                    Failure Analysis
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(selectedCell.error!)}
                    className="flex cursor-pointer items-center gap-1 rounded bg-slate-800 px-2 py-1 text-[9px] font-semibold text-slate-500 transition-colors hover:bg-slate-700/80 hover:text-slate-300"
                  >
                    <Copy className="h-3 w-3" /> Copy Full Trace
                  </button>
                </div>
                <p className="max-h-40 overflow-y-auto break-words text-sm font-medium italic leading-relaxed text-rose-300/80 [overflow-wrap:anywhere]">
                  {selectedCell.error.substring(0, 200)}
                  {selectedCell.error.length > 200 && "..."}
                </p>
              </div>
            )}
          </div>
        </div>
        </>,
        document.body
      )}
    </div>
  );
}
