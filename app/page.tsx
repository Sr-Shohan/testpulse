"use client";

import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import SummaryCards from "@/components/SummaryCards";
import TrendChart from "@/components/TrendChart";
import FlakyTestTable from "@/components/FlakyTestTable";
import FilterBar from "@/components/FilterBar";
import FailureInsights from "@/components/FailureInsights";
import FullScreenLoader from "@/components/FullScreenLoader";
import { FlakyApiResponse } from "@/lib/types";
import { Info } from "lucide-react";

export default function DashboardPage() {
  const [data, setData] = useState<FlakyApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const [branch, setBranch] = useState("master");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get<FlakyApiResponse>(
        `/api/flaky?days=${days}&branch=${branch}&testBranch=master&devBranch=master`
      );
      setData(res.data);
    } catch (err: any) {
      console.error("Failed to fetch dashboard data:", err);
      setError(err.response?.data?.error || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [days, branch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <FilterBar
        days={days}
        branch={branch}
        onDaysChange={setDays}
        onBranchChange={setBranch}
        onRefresh={fetchData}
        loading={loading}
        hideBranch={true}
      />

      {/* Error State */}
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

      {/* Full-screen AI loader — only on initial load */}
      {loading && !data && <FullScreenLoader />}

      {/* Dashboard Content */}
      {data && (
        <>
          {/* Summary Cards */}
          <SummaryCards summary={data.summary} loading={loading} />

          {/* Row 1: Trend Chart (wide) + Context Panel */}
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            <div className="xl:col-span-3">
              <TrendChart builds={data.builds} days={days} />
            </div>
            <div>
              <div
                className="glass-card p-5 animate-fade-in"
                style={{ animationDelay: "300ms" }}
              >
                <div className="flex items-center gap-2 mb-4 text-slate-200">
                  <Info className="w-4 h-4 text-blue-400" />
                  <h3 className="font-semibold text-sm">Analysis Context</h3>
                </div>
                <div className="space-y-3 text-xs">
                  {[
                    { label: "Branch", value: data.meta.branch, cls: "text-blue-400 font-mono" },
                    { label: "Time Range", value: `${data.meta.days} days`, cls: "text-slate-300" },
                    { label: "TEST_BRANCH", value: data.meta.testBranch, cls: "text-emerald-400 font-mono" },
                    { label: "DEV_BRANCH", value: data.meta.devBranch, cls: "text-emerald-400 font-mono" },
                    { label: "Builds Analyzed", value: String(data.meta.buildsAnalyzed), cls: "text-slate-200 font-bold" },
                    { label: "Cached At", value: new Date(data.meta.cachedAt).toLocaleTimeString(), cls: "text-slate-500" },
                  ].map(({ label, value, cls }) => (
                    <div key={label} className="flex justify-between items-center gap-2">
                      <span className="text-slate-500 shrink-0">{label}</span>
                      <span className={`${cls} truncate max-w-[100px] text-right`}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Failure Insights (sidebar) + Flaky Tests Table */}
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            {/* Right analytics column */}
            <div className="xl:col-span-1 xl:order-last">
              <FailureInsights tests={data.tests} builds={data.builds} />
            </div>
            {/* Flaky tests table */}
            <div className="xl:col-span-3 xl:order-first">
              <FlakyTestTable tests={data.summary.topFlakyTests} limit={10} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
