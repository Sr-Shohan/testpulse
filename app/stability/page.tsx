"use client";

import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import StabilityDNAMatrix from "@/components/StabilityDNAMatrix";
import FilterBar from "@/components/FilterBar";
import FullScreenLoader from "@/components/FullScreenLoader";
import { FlakyApiResponse } from "@/lib/types";
import { Activity, ShieldCheck, Microscope, RotateCcw } from "lucide-react";

export default function StabilityPage() {
  const [data, setData] = useState<FlakyApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7); // Default to 7 days to match FilterBar options
  const [branch, setBranch] = useState("master");
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
      console.error("Failed to fetch stability data:", err);
      setError(err.response?.data?.error || "Failed to load stability data");
    } finally {
      setLoading(false);
    }
  }, [days, branch]);

  const handleResetAndRefresh = useCallback(() => {
    setSearchQuery("");
    setDays(7);
    setBranch("master");
    // If we're already at 7 days/master, the useEffect won't trigger, so we force-refresh here
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter tests based on search query
  const filteredTests = data?.tests.filter((t) =>
    t.testName.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6">
      {/* Error state */}
      {error && (
        <div className="glass-card p-6 border-rose-500/20 bg-rose-500/5 animate-fade-in text-center">
          <p className="text-rose-400 text-sm">{error}</p>
          <button onClick={fetchData} className="mt-2 text-xs text-blue-400 hover:underline">
            Try again
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && !data && <FullScreenLoader />}

      {/* Main Analysis View */}
      {data && (
        <div className="animate-fade-in space-y-6">
          {/* Quick Insights Summary (Live Intelligence) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             {/* Card 1: Stability Score */}
             <div className="glass-card p-4 flex items-center gap-3 border-emerald-500/10 transition-all hover:bg-emerald-500/5 group">
                <div className="p-2 bg-emerald-500/10 rounded-lg group-hover:bg-emerald-500/20 transition-colors">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="text-[11px]">
                   <span className="text-slate-200 font-bold block text-xs underline decoration-emerald-500/30 underline-offset-4">Stability Score</span>
                   <span className="text-emerald-400/80 font-mono font-bold leading-none mt-1 inline-block">
                     {Math.round(((data.tests.filter(t => t.failureCount === 0).length) / data.summary.totalTests) * 100)}% Perfectly Stable
                   </span>
                   <p className="text-slate-500 text-[9px] mt-0.5">
                     {data.tests.filter(t => t.failureCount === 0).length} of {data.summary.totalTests} tests green
                   </p>
                </div>
             </div>

             {/* Card 2: Active Flakiness */}
             <div className="glass-card p-4 flex items-center gap-3 border-blue-500/10 transition-all hover:bg-blue-500/5 group">
                <div className="p-2 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                  <Activity className="w-5 h-5 text-blue-400" />
                </div>
                <div className="text-[11px]">
                   <span className="text-slate-200 font-bold block text-xs underline decoration-blue-500/30 underline-offset-4">Active Flakiness</span>
                   <span className="text-blue-400/80 font-mono font-bold leading-none mt-1 inline-block">
                     {data.summary.flakyTestCount} Oscillating Patterns
                   </span>
                   <p className="text-slate-500 text-[9px] mt-0.5">
                     Tests switching between pass and fail
                   </p>
                </div>
             </div>

             {/* Card 3: Hard Blocks */}
             <div className="glass-card p-4 flex items-center gap-3 border-rose-500/10 transition-all hover:bg-rose-500/5 group">
                <div className="p-2 bg-rose-500/10 rounded-lg group-hover:bg-rose-500/20 transition-colors">
                   <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                </div>
                <div className="text-[11px]">
                   <span className="text-slate-200 font-bold block text-xs underline decoration-rose-500/30 underline-offset-4">Hard Blocks</span>
                   <span className="text-rose-400/80 font-mono font-bold leading-none mt-1 inline-block">
                     {data.summary.alwaysFailingCount} Persistent Failures
                   </span>
                   <p className="text-slate-500 text-[9px] mt-0.5">
                     Tests failing in consecutive builds
                   </p>
                </div>
             </div>
          </div>

          <StabilityDNAMatrix 
            tests={filteredTests} 
            builds={data.builds} 
            days={days}
            branch={branch}
            searchQuery={searchQuery}
            loading={loading}
            onDaysChange={setDays}
            onBranchChange={setBranch}
            onSearchChange={setSearchQuery}
            onRefresh={handleResetAndRefresh}
          />
        </div>
      )}
    </div>
  );
}
