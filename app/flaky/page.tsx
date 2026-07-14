"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import axios from "axios";
import FlakyTestTable from "@/components/FlakyTestTable";
import FilterBar from "@/components/FilterBar";
import { FlakyApiResponse, FlakyTestData } from "@/lib/types";
import { Loader2, Bug, ShieldAlert, TrendingUp, Search } from "lucide-react";
import { clsx } from "clsx";

export default function FlakyPage() {
  const [data, setData] = useState<FlakyApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const [branch, setBranch] = useState("master");
  const [filterMode, setFilterMode] = useState<"flaky" | "always-failing" | "all">("flaky");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get<FlakyApiResponse>(
        `/api/flaky?days=${days}&branch=${branch}&testBranch=master&devBranch=master`
      );
      setData(res.data);
    } catch (err: any) {
      console.error("Failed to fetch flaky data:", err);
      setError(err.response?.data?.error || "Failed to load flaky test data");
    } finally {
      setLoading(false);
    }
  }, [days, branch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /*
   * Tab counts iterate the entire `data.tests` array; without memoization
   * we re-run all three filters on every keystroke in the search input
   * (the input lives in this component's state). Memoizing on `data.tests`
   * alone keeps typing snappy even when the response holds thousands of tests.
   */
  const tabCounts = useMemo(() => {
    if (!data) return { flaky: 0, alwaysFailing: 0, all: 0 };
    let flaky = 0;
    let alwaysFailing = 0;
    let all = 0;
    for (const t of data.tests) {
      if (t.isFlaky) flaky++;
      if (t.flakyScore > 0.8 && t.totalRuns >= 3) alwaysFailing++;
      if (t.failureCount > 0) all++;
    }
    return { flaky, alwaysFailing, all };
  }, [data]);

  const filteredTests = useMemo<FlakyTestData[]>(() => {
    if (!data) return [];
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch = (t: FlakyTestData) =>
      !q || t.testName.toLowerCase().includes(q);

    switch (filterMode) {
      case "flaky":
        return data.tests.filter((t) => t.isFlaky && matchesSearch(t));
      case "always-failing":
        return data.tests.filter(
          (t) =>
            t.flakyScore > 0.8 && t.totalRuns >= 3 && matchesSearch(t)
        );
      case "all":
        return data.tests.filter(
          (t) => t.failureCount > 0 && matchesSearch(t)
        );
    }
  }, [data, filterMode, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">
              Flaky Test Analysis
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Identify unreliable tests and failure patterns
            </p>
          </div>
          <FilterBar
            days={days}
            branch={branch}
            onDaysChange={setDays}
            onBranchChange={setBranch}
            onRefresh={fetchData}
            loading={loading}
            hideBranch={true}
          />
        </div>

        {/* Test Category Tabs & Search */}
        {data && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
            <div className="flex p-1 bg-slate-900/80 rounded-xl border border-slate-800/60 w-fit">
              {[
                {
                  id: "flaky" as const,
                  label: "Flaky Tests",
                  icon: Bug,
                  count: tabCounts.flaky,
                  color: "text-amber-400",
                },
                {
                  id: "always-failing" as const,
                  label: "Always Failing",
                  icon: ShieldAlert,
                  count: tabCounts.alwaysFailing,
                  color: "text-rose-400",
                },
                {
                  id: "all" as const,
                  label: "All Failures",
                  icon: TrendingUp,
                  count: tabCounts.all,
                  color: "text-blue-400",
                },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilterMode(tab.id)}
                  className={clsx(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                    // `text-slate-50` (not `text-white`) so the inverted
                    // palette renders dark text on the light raised pill
                    // in light mode while staying near-white in dark mode.
                    filterMode === tab.id
                      ? "bg-slate-800 text-slate-50 shadow-lg ring-1 ring-slate-700/60"
                      : "text-slate-400 hover:text-slate-200"
                  )}
                >
                  <tab.icon className={clsx("w-3.5 h-3.5", filterMode === tab.id ? tab.color : "")} />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span
                    className={clsx(
                      "text-xs px-1.5 py-0.5 rounded-full",
                      filterMode === tab.id
                        ? "bg-slate-700 text-slate-300"
                        : "bg-slate-800/50 text-slate-600"
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-auto shrink-0">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input 
                type="text"
                placeholder="Search test names..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-slate-950/50 border border-slate-800 rounded-lg py-2 pl-9 pr-4 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50 w-full sm:w-[350px] lg:w-[450px] transition-all"
              />
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="glass-card p-6 border-rose-500/20 bg-rose-500/5 animate-fade-in">
          <p className="text-rose-400 text-sm">{error}</p>
          <button
            onClick={fetchData}
            className="mt-2 text-xs text-blue-400 hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Flaky Test Table */}
      <FlakyTestTable 
        tests={filteredTests} 
        loading={loading} 
        title={
          filterMode === "flaky" ? "All Flaky Tests" : 
          filterMode === "always-failing" ? "Always Failing Tests" : 
          "All Test Failures"
        }
      />

      {/* Footer */}
      {data && (
        <div className="text-center text-xs text-slate-600 pb-4">
          Analyzed {data.meta.buildsAnalyzed} builds from the last {days} day
          {days > 1 ? "s" : ""} • {data.tests.length} unique tests found
        </div>
      )}
    </div>
  );
}
