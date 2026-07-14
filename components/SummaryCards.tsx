import {
  PlayCircle,
  TestTube2,
  XCircle,
  Bug,
} from "lucide-react";
import { clsx } from "clsx";
import { DashboardSummary } from "@/lib/types";

interface SummaryCardsProps {
  summary: DashboardSummary | null;
  loading?: boolean;
}

export default function SummaryCards({ summary, loading }: SummaryCardsProps) {
  const cards = [
    {
      label: "Builds Analyzed",
      value: summary?.totalBuilds ?? 0,
      icon: PlayCircle,
      gradient: "from-blue-500 to-cyan-400",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
      glow: "shadow-blue-500/5",
    },
    {
      label: "Success Rate",
      value: summary?.successRate ?? 0,
      suffix: "%",
      icon: TestTube2,
      gradient: "from-emerald-500 to-teal-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
      glow: "shadow-emerald-500/5",
    },
    {
      label: "Flaky Tests",
      value: summary?.flakyTestCount ?? 0,
      icon: Bug,
      gradient: "from-amber-500 to-orange-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
      glow: "shadow-amber-500/5",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((card, i) => (
        <div
          key={card.label}
          className={clsx(
            "relative glass-card p-6 border overflow-hidden animate-fade-in group hover:scale-[1.02] transition-transform duration-300",
            card.border,
            `shadow-xl ${card.glow}`
          )}
          style={{ animationDelay: `${i * 80}ms` }}
        >
          {/* Gradient accent line */}
          <div
            className={clsx(
              "absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r",
              card.gradient
            )}
          />

          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-400 font-medium">
              {card.label}
            </span>
            <div
              className={clsx(
                "p-2.5 rounded-xl transition-colors duration-300",
                card.bg,
                "group-hover:scale-110"
              )}
            >
              <card.icon
                className={clsx(
                  "w-5 h-5 bg-clip-text",
                  `text-transparent bg-gradient-to-r ${card.gradient}`
                )}
                style={{
                  color: card.gradient.includes("blue")
                    ? "#3b82f6"
                    : card.gradient.includes("violet")
                    ? "#8b5cf6"
                    : card.gradient.includes("rose")
                    ? "#f43f5e"
                    : "#f59e0b",
                }}
              />
            </div>
          </div>

          {loading ? (
            <div className="h-9 w-20 bg-slate-800/60 rounded-lg animate-pulse" />
          ) : (
            <div className="text-3xl font-bold tracking-tight">
              {card.value.toLocaleString()}
              {card.suffix && (
                <span className="text-lg font-medium text-slate-500 ml-1">
                  {card.suffix}
                </span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
