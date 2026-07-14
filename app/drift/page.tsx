"use client";

import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { DriftApiResponse, DriftTest } from "@/lib/types";
import FullScreenLoader from "@/components/FullScreenLoader";
import { 
  GitBranch, 
  Search, 
  Map as MapIcon, 
  ArrowRightLeft, 
  ChevronDown,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Microscope,
  Info
} from "lucide-react";
import { clsx } from "clsx";

export default function DriftPage() {
  const [stages, setStages] = useState<string[]>([]);
  const [targetStage, setTargetStage] = useState("staging-amj");
  const [baselineStage, setBaselineStage] = useState("qa");
  const [days, setDays] = useState(7);
  const [branch, setBranch] = useState("master");
  
  const [data, setData] = useState<DriftApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [expandedTest, setExpandedTest] = useState<string | null>(null);

  // 1. Fetch available stages on mount
  useEffect(() => {
    const fetchStages = async () => {
      try {
        const res = await axios.get<{ stages: string[] }>(`/api/stages?branch=${branch}`);
        setStages(res.data.stages);
        
        // Auto-select defaults if available
        if (res.data.stages.includes('staging-amj')) setTargetStage('staging-amj');
        else if (res.data.stages.length > 0) setTargetStage(res.data.stages[0]);
        
        if (res.data.stages.includes('qa')) setBaselineStage('qa');
        else if (res.data.stages.length > 1) setBaselineStage(res.data.stages[1]);
        
      } catch (err) {
        console.error("Failed to fetch stages", err);
      }
    };
    fetchStages();
  }, [branch]);

  // 2. Fetch Drift Data
  const fetchDriftData = useCallback(async () => {
    if (!targetStage || !baselineStage) return;
    
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get<DriftApiResponse>(
        `/api/drift?branch=${branch}&targetStage=${encodeURIComponent(targetStage)}&baselineStage=${encodeURIComponent(baselineStage)}&days=${days}`
      );
      setData(res.data);
    } catch (err: any) {
      console.error("Failed to fetch drift data:", err);
      setError(err.response?.data?.error || "Failed to load environment drift");
    } finally {
      setLoading(false);
    }
  }, [branch, targetStage, baselineStage, days]);

  useEffect(() => {
    fetchDriftData();
  }, [fetchDriftData]);

  const filteredTests = data?.driftedTests.filter(t => 
    t.testName.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="glass-card p-6 bg-slate-900/40 relative overflow-hidden group">
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl group-hover:bg-blue-500/10 transition-colors pointer-events-none" />
        
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <MapIcon className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                Environment Drift Matrix
              </h1>
              <p className="text-xs text-slate-400 mt-1 max-w-lg">
                Identify environmental bugs running the same test suite. Compares the baseline environment against your deployment target.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
             {/* Branch Selector */}
             <div className="relative">
                <GitBranch className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="Job branch (master)"
                  className="bg-slate-950/50 border border-slate-800 rounded-lg py-2 pl-9 pr-4 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-40"
                />
             </div>

             {/* Days Selector */}
             <div className="flex items-center bg-slate-950/50 border border-slate-800 rounded-lg p-1">
              {[1, 7, 15].map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={clsx(
                    "px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
                    days === d
                      ? "bg-blue-600/20 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.1)]"
                      : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
                  )}
                >
                  {d === 1 ? "24H" : `${d}D`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Environment Selection Gateway */}
        <div className="mt-8 flex flex-col md:flex-row items-center justify-center gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800/50">
          <div className="flex-1 w-full max-w-xs space-y-1.5">
             <label className="text-[10px] uppercase font-bold tracking-wider text-emerald-500/80 ml-1">Baseline Environment (Stable)</label>
             <div className="relative">
               <select 
                 value={baselineStage}
                 onChange={(e) => setBaselineStage(e.target.value)}
                 className="w-full appearance-none bg-slate-900 border border-slate-700 rounded-lg py-2.5 pl-4 pr-10 text-sm text-slate-200 font-mono focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
               >
                 {stages.map(s => <option key={s} value={s}>{s}</option>)}
                 {!stages.includes(baselineStage) && <option value={baselineStage}>{baselineStage}</option>}
               </select>
               <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
             </div>
          </div>

          <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0 z-10 mx-[-10px]">
             <ArrowRightLeft className="w-4 h-4 text-slate-400" />
          </div>

          <div className="flex-1 w-full max-w-xs space-y-1.5">
             <label className="text-[10px] uppercase font-bold tracking-wider text-rose-500/80 ml-1">Target Environment (Drifting)</label>
             <div className="relative">
               <select 
                 value={targetStage}
                 onChange={(e) => setTargetStage(e.target.value)}
                 className="w-full appearance-none bg-slate-900 border border-slate-700 rounded-lg py-2.5 pl-4 pr-10 text-sm text-slate-200 font-mono focus:outline-none focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/20"
               >
                 {stages.map(s => <option key={s} value={s}>{s}</option>)}
                 {!stages.includes(targetStage) && <option value={targetStage}>{targetStage}</option>}
               </select>
               <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
             </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="glass-card p-6 border-rose-500/20 bg-rose-500/5 text-center">
          <p className="text-rose-400 text-sm">{error}</p>
          <button onClick={fetchDriftData} className="mt-2 text-xs text-blue-400 hover:underline">Try again</button>
        </div>
      )}

      {loading && !data && <FullScreenLoader />}

      {data && (
        <div className="space-y-6 animate-fade-in">
           {/* Drift Summary Cards */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="glass-card p-4 flex items-center gap-4">
                <div className="p-2.5 bg-emerald-500/10 rounded-xl">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Baseline Builds</span>
                  <p className="text-xl font-bold font-mono text-slate-200">{data.baselineBuildCount}</p>
                </div>
              </div>
              <div className="glass-card p-4 flex items-center gap-4">
                <div className="p-2.5 bg-rose-500/10 rounded-xl">
                  <XCircle className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Target Builds</span>
                  <p className="text-xl font-bold font-mono text-slate-200">{data.targetBuildCount}</p>
                </div>
              </div>
              <div className="glass-card p-4 flex items-center gap-4 border-l-4 border-l-amber-500/50">
                <div className="p-2.5 bg-amber-500/10 rounded-xl">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Environmental Bugs</span>
                  <p className="text-xl font-bold font-mono text-amber-400">{data.driftedTests.length}</p>
                </div>
              </div>
           </div>

           {/* The Drift Matrix */}
           <div className="glass-card flex flex-col h-[600px]">
             <div className="p-4 border-b border-slate-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
               <h3 className="text-sm font-bold text-slate-200 uppercase tracking-widest flex items-center gap-2">
                 <Activity className="w-4 h-4 text-slate-500" />
                 Environmental Regressions
               </h3>
               
               <div className="relative">
                 <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                 <input 
                   type="text"
                   placeholder="Search test signatures..."
                   value={searchQuery}
                   onChange={e => setSearchQuery(e.target.value)}
                   className="bg-slate-950/50 border border-slate-800 rounded-lg py-1.5 pl-9 pr-4 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50 min-w-[260px]"
                 />
               </div>
             </div>

             <div className="flex-1 overflow-auto custom-scrollbar relative">
                {filteredTests.length === 0 ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-3">
                    <CheckCircle2 className="w-12 h-12 text-emerald-500/20" />
                    <p className="text-sm font-medium">No environmental drift detected!</p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                     <thead className="bg-slate-900/60 backdrop-blur-sm sticky top-0 z-20">
                       <tr>
                         <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-[40%]">Test Signature</th>
                         <th className="p-4 text-[10px] font-bold text-emerald-400/80 uppercase tracking-widest bg-emerald-500/5">Baseline ({baselineStage})</th>
                         <th className="p-4 text-[10px] font-bold text-rose-400/80 uppercase tracking-widest bg-rose-500/5">Target ({targetStage})</th>
                         <th className="p-4 text-[10px] font-bold text-amber-400/80 uppercase tracking-widest text-center">Drift Severity</th>
                         <th className="p-4 w-12"></th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-800/30">
                       {filteredTests.map((test) => {
                         const driftPercent = Math.round(test.driftScore * 100);
                         const isExpanded = expandedTest === test.testName;
                         
                         return (
                           <React.Fragment key={test.testName}>
                             <tr 
                               className="hover:bg-white/[0.02] transition-colors cursor-pointer group"
                               onClick={() => setExpandedTest(isExpanded ? null : test.testName)}
                             >
                               <td className="p-4">
                                  <div className="text-xs font-bold text-slate-200 font-mono tracking-tight break-all">
                                    {test.testName}
                                  </div>
                               </td>
                               <td className="p-4 bg-emerald-500/[0.02]">
                                  <div className="flex flex-col">
                                    <span className="text-emerald-400 font-bold text-sm">
                                      {Math.round(test.baselinePassRate * 100)}% Pass
                                    </span>
                                    <span className="text-[9px] text-slate-500 uppercase tracking-wide">
                                      {test.baselineRuns} Runs
                                    </span>
                                  </div>
                               </td>
                               <td className="p-4 bg-rose-500/[0.02]">
                                  <div className="flex flex-col">
                                    <span className="text-rose-400 font-bold text-sm">
                                      {Math.round(test.targetPassRate * 100)}% Pass
                                    </span>
                                    <span className="text-[9px] text-slate-500 uppercase tracking-wide">
                                      {test.targetRuns} Runs
                                    </span>
                                  </div>
                               </td>
                               <td className="p-4 text-center">
                                  <span className={clsx(
                                    "px-2.5 py-1 rounded-md text-xs font-bold inline-flex items-center gap-1.5 shadow-lg",
                                    driftPercent > 50 ? "bg-rose-500/20 text-rose-400 shadow-rose-500/10" 
                                    : driftPercent > 20 ? "bg-amber-500/20 text-amber-400 shadow-amber-500/10"
                                    : "bg-slate-800 text-slate-300"
                                  )}>
                                    <AlertTriangle className="w-3 h-3" />
                                    -{driftPercent}%
                                  </span>
                               </td>
                               <td className="p-4 text-center">
                                 <ChevronDown className={clsx(
                                   "w-4 h-4 text-slate-500 transition-transform duration-300",
                                   isExpanded && "rotate-180"
                                 )} />
                               </td>
                             </tr>

                             {/* Expandable Error View */}
                             {isExpanded && (
                               <tr className="bg-slate-900/40">
                                 <td colSpan={5} className="p-0 border-b-2 border-slate-800/40">
                                    <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in shadow-inner">
                                       <div className="space-y-3">
                                          <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-400/80 uppercase tracking-widest">
                                            <Info className="w-3.5 h-3.5" /> Baseline Errors (if any)
                                          </div>
                                          {test.baselineErrors.length === 0 ? (
                                            <div className="bg-slate-950/40 border border-slate-800/50 rounded-lg p-3 text-xs text-slate-500 italic text-center">
                                              No errors observed in baseline.
                                            </div>
                                          ) : (
                                            <div className="space-y-2">
                                              {test.baselineErrors.map((err, i) => (
                                                <div key={i} className="bg-emerald-950/20 border border-emerald-900/30 rounded-lg p-3 text-[10px] font-mono text-emerald-200/80 break-all">
                                                  {err.substring(0, 300)}{err.length > 300 && '...'}
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                       </div>

                                       <div className="space-y-3">
                                          <div className="flex items-center gap-2 text-[10px] font-bold text-rose-400/80 uppercase tracking-widest">
                                            <Activity className="w-3.5 h-3.5 animate-pulse" /> Target Errors (Environmental)
                                          </div>
                                          {test.targetErrors.length === 0 ? (
                                            <div className="bg-slate-950/40 border border-slate-800/50 rounded-lg p-3 text-xs text-slate-500 italic text-center">
                                              No specific errors saved.
                                            </div>
                                          ) : (
                                            <div className="space-y-2">
                                              {test.targetErrors.map((err, i) => (
                                                <div key={i} className="bg-rose-950/30 border border-rose-900/30 rounded-lg p-3 text-[10px] font-mono text-rose-200/80 break-all leading-relaxed">
                                                  {err.substring(0, 300)}{err.length > 300 && '...'}
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                       </div>
                                    </div>
                                 </td>
                               </tr>
                             )}
                           </React.Fragment>
                         )
                       })}
                     </tbody>
                  </table>
                )}
             </div>
           </div>
        </div>
      )}
    </div>
  );
}
