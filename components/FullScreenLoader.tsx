"use client";

import { useEffect, useState } from "react";

const STEPS = [
  { message: "Connecting to Jenkins...", sub: "Authenticating with Jenkins API" },
  { message: "Fetching build history...", sub: "Scanning last builds for matching branches" },
  { message: "Filtering by TEST_BRANCH = master...", sub: "Removing ABORTED and in-progress builds" },
  { message: "Loading test reports...", sub: "Reading test case results per build" },
  { message: "Aggregating test results...", sub: "Counting passes, failures, and skips" },
  { message: "Calculating flaky scores...", sub: "Identifying inconsistent test behaviour" },
  { message: "Detecting failure patterns...", sub: "Grouping error messages by similarity" },
  { message: "Building stability map...", sub: "Plotting tests by run frequency and fail rate" },
  { message: "Almost ready...", sub: "Preparing your dashboard" },
];

export default function FullScreenLoader() {
  const [stepIndex, setStepIndex] = useState(0);
  const [dots, setDots] = useState(0);
  const [progress, setProgress] = useState(0);

  // Cycle through steps
  useEffect(() => {
    const interval = setInterval(() => {
      setStepIndex((i) => {
        const next = i < STEPS.length - 1 ? i + 1 : i;
        setProgress(Math.round(((next + 1) / STEPS.length) * 92)); // cap at 92%
        return next;
      });
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  // Animated dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((d) => (d + 1) % 4);
    }, 420);
    return () => clearInterval(interval);
  }, []);

  const step = STEPS[stepIndex];
  const dotStr = ".".repeat(dots);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 overflow-hidden">

      {/* Background ambient blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl"
          style={{
            background: "radial-gradient(circle, #3b82f6, transparent)",
            animation: "blob1 8s ease-in-out infinite",
          }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-10 blur-3xl"
          style={{
            background: "radial-gradient(circle, #8b5cf6, transparent)",
            animation: "blob2 10s ease-in-out infinite",
          }}
        />
        <div
          className="absolute top-1/2 right-1/3 w-64 h-64 rounded-full opacity-8 blur-3xl"
          style={{
            background: "radial-gradient(circle, #06b6d4, transparent)",
            animation: "blob1 12s ease-in-out infinite reverse",
          }}
        />
      </div>

      {/* Grid lines overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(#94a3b8 1px, transparent 1px), linear-gradient(90deg, #94a3b8 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Center content */}
      <div className="relative z-10 flex flex-col items-center gap-10 px-6 max-w-lg w-full">

        {/* Animated orb cluster */}
        <div className="relative flex items-center justify-center" style={{ width: 140, height: 140 }}>
          {/* Outer ring */}
          <div
            className="absolute inset-0 rounded-full border border-blue-500/20"
            style={{ animation: "spin 8s linear infinite" }}
          />
          {/* Middle ring */}
          <div
            className="absolute inset-4 rounded-full border border-violet-500/25"
            style={{ animation: "spin 5s linear infinite reverse" }}
          />

          {/* Orbiting dots */}
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-full"
              style={{
                background: ["#3b82f6", "#8b5cf6", "#06b6d4", "#10b981"][i],
                animation: `orbit${i} ${3 + i * 0.5}s linear infinite`,
                top: "50%",
                left: "50%",
                transformOrigin: `${30 + i * 8}px 0px`,
                marginTop: -4,
                marginLeft: -4,
              }}
            />
          ))}

          {/* Core pulsing orb */}
          <div className="absolute inset-8 rounded-full bg-gradient-to-br from-blue-500/30 to-violet-500/30 blur-sm" style={{ animation: "pulse-core 2s ease-in-out infinite" }} />
          <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center shadow-2xl shadow-blue-500/30" style={{ animation: "pulse-core 2s ease-in-out infinite" }}>
            {/* QA icon */}
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="opacity-90">
              <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="white" strokeWidth="1.5" strokeOpacity="0.6" />
              <path d="M21 21l-4.35-4.35" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-violet-400 to-cyan-400">
            TestPulse
          </h1>
          <p className="text-slate-500 text-sm">Analyzing your CI pipeline</p>
        </div>

        {/* Thinking message */}
        <div className="w-full glass-card p-5 text-center space-y-2 min-h-[88px] flex flex-col justify-center" style={{ borderColor: "rgba(59,130,246,0.2)" }}>
          <p className="text-slate-100 text-sm font-medium">
            {step.message}
            <span className="text-blue-400 inline-block w-6 text-left">{dotStr}</span>
          </p>
          <p className="text-slate-500 text-xs">{step.sub}</p>
        </div>

        {/* Progress bar */}
        <div className="w-full space-y-2">
          <div className="h-1 w-full bg-slate-800/80 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 via-violet-500 to-cyan-500 transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-600">
            <span>Step {stepIndex + 1} of {STEPS.length}</span>
            <span>{progress}%</span>
          </div>
        </div>

        {/* Completed steps */}
        <div className="w-full space-y-1.5">
          {STEPS.slice(0, stepIndex).map((s, i) => (
            <div key={i} className="flex items-center gap-2.5 animate-fade-in">
              <div className="w-4 h-4 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                  <path d="M1.5 4l2 2 3-3" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="text-xs text-slate-600">{s.message.replace("...", "")}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Keyframe styles */}
      <style>{`
        @keyframes blob1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -20px) scale(1.1); }
          66% { transform: translate(-20px, 15px) scale(0.95); }
        }
        @keyframes blob2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-25px, 20px) scale(1.05); }
          66% { transform: translate(20px, -15px) scale(0.98); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse-core {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.06); opacity: 0.85; }
        }
        @keyframes orbit0 {
          from { transform: rotate(0deg) translateX(30px); }
          to { transform: rotate(360deg) translateX(30px); }
        }
        @keyframes orbit1 {
          from { transform: rotate(90deg) translateX(38px); }
          to { transform: rotate(450deg) translateX(38px); }
        }
        @keyframes orbit2 {
          from { transform: rotate(180deg) translateX(46px); }
          to { transform: rotate(540deg) translateX(46px); }
        }
        @keyframes orbit3 {
          from { transform: rotate(270deg) translateX(54px); }
          to { transform: rotate(630deg) translateX(54px); }
        }
      `}</style>
    </div>
  );
}
