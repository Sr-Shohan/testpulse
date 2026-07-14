"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import {
  Clock,
  GitBranch,
  ChevronDown,
  RotateCcw,
} from "lucide-react";
import { clsx } from "clsx";
import { BranchInfo } from "@/lib/types";

interface FilterBarProps {
  days: number;
  branch: string;
  onDaysChange: (days: number) => void;
  onBranchChange: (branch: string) => void;
  onRefresh: () => void;
  loading?: boolean;
  hideBranch?: boolean;
}

const timeRanges = [
  { value: 1, label: "24 Hours" },
  { value: 7, label: "7 Days" },
  { value: 15, label: "15 Days" },
];

export default function FilterBar({
  days,
  branch,
  onDaysChange,
  onBranchChange,
  onRefresh,
  loading = false,
  hideBranch = false,
}: FilterBarProps) {
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (hideBranch) return;
    axios
      .get("/api/branches")
      .then((res) => setBranches(res.data))
      .catch((err) => console.error("Failed to fetch branches:", err));
  }, [hideBranch]);

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 animate-fade-in">
      {/* Time Range */}
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-slate-500 shrink-0" />
        <div className="flex p-1 bg-slate-900/80 rounded-lg border border-slate-800/60">
          {timeRanges.map((t) => (
            <button
              key={t.value}
              onClick={() => onDaysChange(t.value)}
              className={clsx(
                "px-3.5 py-1.5 text-xs font-medium rounded-md transition-all duration-200",
                (mounted && days === t.value)
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/20"
                  : "text-slate-400 hover:text-slate-100"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Branch Selector */}
      {!hideBranch && (
        <div className="relative">
          <button
            onClick={() => setShowBranchDropdown(!showBranchDropdown)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900/80 border border-slate-800/60 rounded-lg text-sm text-slate-300 hover:text-slate-50 hover:border-slate-700 transition-all w-full sm:w-auto"
          >
            <GitBranch className="w-4 h-4 text-indigo-400" />
            <span className="font-medium">{branch}</span>
            <ChevronDown
              className={clsx(
                "w-3.5 h-3.5 text-slate-500 ml-auto transition-transform duration-200",
                showBranchDropdown && "rotate-180"
              )}
            />
          </button>

          {showBranchDropdown && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowBranchDropdown(false)}
              />
              <div className="absolute top-full left-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl shadow-black/30 z-50 max-h-60 overflow-y-auto animate-slide-down">
                {branches.map((b) => (
                  <button
                    key={b.name}
                    onClick={() => {
                      onBranchChange(b.name);
                      setShowBranchDropdown(false);
                    }}
                    className={clsx(
                      "w-full text-left px-4 py-2.5 text-sm transition-colors",
                      b.name === branch
                        ? "bg-blue-600/10 text-blue-400"
                        : "text-slate-400 hover:bg-slate-800 hover:text-slate-50"
                    )}
                  >
                    {b.name}
                  </button>
                ))}
                {branches.length === 0 && (
                  <div className="px-4 py-6 text-sm text-slate-500 text-center">
                    Loading branches...
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Refresh */}
      <button
        onClick={onRefresh}
        disabled={loading}
        className="p-2.5 bg-slate-900/80 border border-slate-800/60 rounded-lg text-slate-400 hover:text-blue-400 hover:border-blue-500/30 transition-all disabled:opacity-50 self-stretch sm:self-auto flex items-center justify-center"
        title="Refresh Data"
      >
        <RotateCcw
          className={clsx("w-4 h-4", loading && "animate-spin")}
        />
      </button>
    </div>
  );
}
