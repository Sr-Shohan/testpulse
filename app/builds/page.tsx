"use client";

import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import BuildsTable from "@/components/BuildsTable";
import FilterBar from "@/components/FilterBar";
import FullScreenLoader from "@/components/FullScreenLoader";
import { BuildsApiResponse, BuildInfo } from "@/lib/types";

export default function BuildsPage() {
  const [builds, setBuilds] = useState<BuildInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const [branch, setBranch] = useState("master");

  const fetchBuilds = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get<BuildsApiResponse>(
        `/api/builds?days=${days}&branch=${branch}&testBranch=master&devBranch=master`
      );
      setBuilds(res.data.builds);
    } catch (err: any) {
      console.error("Failed to fetch builds:", err);
      setError(err.response?.data?.error || "Failed to load build history");
    } finally {
      // Small artificial delay to let the AI-vibe loader finish its transition smoothly
      setTimeout(() => setLoading(false), 800);
    }
  }, [days, branch]);

  useEffect(() => {
    fetchBuilds();
  }, [fetchBuilds]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Build History</h1>
          <p className="text-sm text-slate-500 mt-1">
            View build results and drill into individual test failures
          </p>
        </div>
        <FilterBar
          days={days}
          branch={branch}
          onDaysChange={setDays}
          onBranchChange={setBranch}
          onRefresh={fetchBuilds}
          loading={loading}
          hideBranch={true}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="glass-card p-6 border-rose-500/20 bg-rose-500/5 animate-fade-in">
          <p className="text-rose-400 text-sm">{error}</p>
          <button
            onClick={fetchBuilds}
            className="mt-2 text-xs text-blue-400 hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Builds Table */}
      <BuildsTable builds={builds} branch={branch} loading={loading} />

      {/* Summary */}
      {builds.length > 0 && (
        <div className="text-center text-xs text-slate-600 pb-4">
          Showing {builds.length} builds from the last {days} day
          {days > 1 ? "s" : ""} on <code className="text-blue-400">{branch}</code>
        </div>
      )}
    </div>
  );
}
