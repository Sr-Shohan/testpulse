"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import {
  CompareBuildsApiResponse,
  CompareBranchHistoryApiResponse,
  CompareBranchHistoryItem,
  CompareBuildsBothFailed,
  FailedTestDetail,
} from "@/lib/types";
import {
  ArrowRightLeft,
  GitBranch,
  ChevronDown,
  ChevronRight,
  Layers,
  Gauge,
  GitCompare,
  ListOrdered,
  Search,
} from "lucide-react";
import { clsx } from "clsx";
import {
  COMPARE_BRANCH_HISTORY_TABLE_PAGE_SIZE,
  COMPARE_PAGE_JOB_FOLDER,
  COMPARE_PAGE_JENKINS_BUILD_FETCH_LIMIT,
} from "./constants";

function formatBuildTime(ms: number) {
  try {
    return format(new Date(ms), "MMM d, yyyy HH:mm", { locale: enUS });
  } catch {
    return "—";
  }
}

function isMasterCanonical(dev: string): boolean {
  return dev.trim().toLowerCase() === "master";
}

function dedupeInts(nums: number[]): number[] {
  return [...new Set(nums.filter((n) => Number.isFinite(n)))];
}

function formatBuildPickLabel(b: CompareBranchHistoryItem) {
  const mod = (b.moduleRun ?? "").trim();
  const stage = b.dashboardStage?.trim() || "—";
  const tb = b.testBranch?.trim() || "—";
  const when = formatBuildTime(b.timestamp);
  const detail = mod
    ? `#${b.buildNumber} · ${when} · ${b.failedTestCount} failed · TEST_BRANCH=${tb} · ${mod} · environment ${stage}`
    : `#${b.buildNumber} · ${when} · ${b.failedTestCount} failed · TEST_BRANCH=${tb} · environment ${stage}`;
  return detail;
}

function buildPickSearchText(b: CompareBranchHistoryItem): string {
  const label = formatBuildPickLabel(b);
  const extra = [
    b.testBranch,
    b.moduleRun,
    b.dashboardStage,
    b.result,
    String(b.buildNumber),
    String(b.failedTestCount),
  ]
    .filter(Boolean)
    .join(" ");
  return `${label} ${extra}`.toLowerCase();
}

function SearchableBuildPickSelect({
  options,
  value,
  onChange,
  disabled,
  side,
}: {
  options: CompareBranchHistoryItem[];
  value: number | null;
  onChange: (buildNumber: number) => void;
  disabled?: boolean;
  side: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuRect, setMenuRect] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const [mounted, setMounted] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const filterInputRef = useRef<HTMLInputElement>(null);

  const triggerId = `build-pick-select-${side}`;
  const listboxId = `build-pick-listbox-${side}`;
  const filterInputId = `build-pick-filter-${side}`;

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((b) => buildPickSearchText(b).includes(q));
  }, [options, query]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateMenuRect = useCallback(() => {
    if (!open || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const gap = 4;
    const viewportPad = 16;
    const top = r.bottom + gap;
    const availableBelow = Math.max(0, window.innerHeight - top - viewportPad);
    const capPx = 40 * 16;
    const maxHeight = Math.min(capPx, availableBelow);
    setMenuRect({ top, left: r.left, width: r.width, maxHeight });
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuRect(null);
      return;
    }
    updateMenuRect();
    const onRelayout = () => updateMenuRect();
    window.addEventListener("resize", onRelayout);
    window.addEventListener("scroll", onRelayout, true);
    return () => {
      window.removeEventListener("resize", onRelayout);
      window.removeEventListener("scroll", onRelayout, true);
    };
  }, [open, updateMenuRect]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const t = requestAnimationFrame(() => filterInputRef.current?.focus());
    return () => cancelAnimationFrame(t);
  }, [open]);

  const empty = options.length === 0;
  const noMatches = !empty && filteredOptions.length === 0;

  const selectedItem =
    value != null ? options.find((b) => b.buildNumber === value) : undefined;
  const triggerLabel = selectedItem
    ? formatBuildPickLabel(selectedItem)
    : "Select build";

  const dropdown = open && mounted && menuRect && (
    <div
      ref={menuRef}
      id={listboxId}
      role="listbox"
      style={{
        position: "fixed",
        top: menuRect.top,
        left: menuRect.left,
        width: Math.max(menuRect.width, 280),
        maxHeight: menuRect.maxHeight,
        zIndex: 9_999,
      }}
      className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-800 bg-slate-950/95 shadow-xl shadow-black/40 backdrop-blur-sm ring-1 ring-slate-700/50"
    >
      <div className="shrink-0 border-b border-slate-800 p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            ref={filterInputRef}
            id={filterInputId}
            type="search"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search builds…"
            className={clsx(
              "w-full rounded-md border border-slate-800 bg-slate-900/80 py-2 pl-8 pr-3 text-xs font-mono text-slate-200 placeholder:text-slate-600",
              "focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            )}
            aria-label="Filter builds"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1 pb-2">
        {noMatches ? (
          <p className="px-3 py-6 text-center text-xs text-slate-500">
            No matches — try another search
          </p>
        ) : (
          filteredOptions.map((b) => {
            const selected = b.buildNumber === value;
            return (
              <button
                key={`${side}-b-${b.buildNumber}`}
                type="button"
                role="option"
                aria-selected={selected}
                className={clsx(
                  "flex w-full cursor-pointer px-3 py-2 text-left text-xs font-mono leading-snug transition-colors whitespace-normal break-words",
                  selected
                    ? "bg-blue-600/25 text-blue-200"
                    : "text-slate-200 hover:bg-slate-800/80"
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(b.buildNumber);
                  setOpen(false);
                  setQuery("");
                }}
              >
                {formatBuildPickLabel(b)}
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        id={triggerId}
        disabled={disabled || empty}
        title={triggerLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => !empty && setOpen((o) => !o)}
        className={clsx(
          "relative w-full flex items-center justify-between gap-2 text-left appearance-none bg-slate-950/60 border border-slate-800 rounded-lg pl-3 pr-10 py-2.5 text-xs font-mono text-slate-200",
          "focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50",
          open && "ring-2 ring-blue-500/30"
        )}
      >
        <span className="truncate">{empty ? "No builds loaded" : triggerLabel}</span>
        <ChevronDown
          className={clsx(
            "absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none transition-transform shrink-0",
            open && "rotate-180"
          )}
        />
      </button>

      {dropdown &&
        createPortal(dropdown, document.body)}
    </div>
  );
}

function BuildHistoryTableCard({
  devLabel,
  rows,
}: {
  devLabel: string;
  rows: CompareBranchHistoryItem[];
}) {
  const [shownCount, setShownCount] = useState(
    COMPARE_BRANCH_HISTORY_TABLE_PAGE_SIZE
  );

  useEffect(() => {
    setShownCount(COMPARE_BRANCH_HISTORY_TABLE_PAGE_SIZE);
  }, [rows]);

  if (rows.length === 0) return null;

  const visibleRows = rows.slice(0, shownCount);
  const hiddenCount = rows.length - shownCount;
  const hasMore = hiddenCount > 0;
  const nextChunk = Math.min(COMPARE_BRANCH_HISTORY_TABLE_PAGE_SIZE, hiddenCount);

  return (
    <div className="glass-card p-0 overflow-hidden border border-slate-800">
      <div className="px-5 py-3 border-b border-slate-800 flex flex-wrap items-center gap-x-2 gap-y-1 text-slate-300 bg-slate-950/40">
        <ListOrdered className="w-4 h-4 text-indigo-400 shrink-0" />
        <span className="text-sm font-bold">Build history ({devLabel})</span>
        <span className="text-xs text-slate-500 ml-auto shrink-0">
          {rows.length} build{rows.length !== 1 ? "s" : ""} in scan (≤{" "}
          {COMPARE_PAGE_JENKINS_BUILD_FETCH_LIMIT} newest for folder)
          {hasMore ? (
            <span className="text-slate-600">
              {" "}
              · showing newest {shownCount}
            </span>
          ) : null}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-800 bg-slate-950/80">
            <tr>
              <th className="px-4 py-2 font-bold">Build #</th>
              <th className="px-4 py-2 font-bold">Date</th>
              <th className="px-4 py-2 font-bold">Result</th>
              <th className="px-4 py-2 font-bold">Failures</th>
              <th className="px-4 py-2 font-bold">TEST_BRANCH</th>
              <th className="px-4 py-2 font-bold">Module run</th>
              <th className="px-4 py-2 font-bold">Environment</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((b) => (
              <tr
                key={`${devLabel}-${b.buildNumber}`}
                className="border-b border-slate-800/80 hover:bg-slate-900/50"
              >
                <td className="px-4 py-2 font-mono text-blue-300">
                  #{b.buildNumber}
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  {formatBuildTime(b.timestamp)}
                </td>
                <td className="px-4 py-2">{b.result}</td>
                <td className="px-4 py-2">{b.failedTestCount}</td>
                <td
                  className="px-4 py-2 max-w-[160px] font-mono truncate"
                  title={b.testBranch || ""}
                >
                  {(b.testBranch || "").trim() ? b.testBranch : "—"}
                </td>
                <td
                  className="px-4 py-2 max-w-[220px] truncate"
                  title={(b.moduleRun ?? "").trim() || undefined}
                >
                  {(b.moduleRun ?? "").trim() ? b.moduleRun : null}
                </td>
                <td className="px-4 py-2">{b.dashboardStage || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasMore ? (
        <div className="border-t border-slate-800 bg-slate-950/40 px-4 py-3 flex justify-center">
          <button
            type="button"
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 focus:outline-none focus:underline"
            onClick={() =>
              setShownCount((n) =>
                Math.min(n + COMPARE_BRANCH_HISTORY_TABLE_PAGE_SIZE, rows.length)
              )
            }
          >
            Show more ({nextChunk} more
            {hiddenCount > nextChunk ? `, ${hiddenCount - nextChunk} left` : ""})
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Normalize stack traces / assertion blobs so we compare “human meaning”, not invisible
 * bytes (ANSI colours, BOM, CRLF vs LF, NBSP, etc.).
 */
function normalizeComparableError(raw: string): string {
  let s = raw.normalize("NFKC");

  /* OSC sequences (hyperlink, etc.), terminated by BEL. */
  s = s.replace(/\u001b\][^\u0007]{0,2000}\u0007/g, "");

  /* CSI sequences: ESC [ … final byte @–~ per ECMA-48 */
  for (let i = 0; i < 64; i++) {
    const next = s.replace(/\u001b\[[^\u0040-\u007e]{0,200}[\u0040-\u007e]/g, "");
    if (next === s) break;
    s = next;
  }

  /* Two-byte ESC escapes (rare outside full-screen apps; cheap to strip). */
  s = s.replace(/\u001b([\u0080-\u009f])/g, "");

  s = s
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[\ufeff\u200b-\u200d\u2060]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return s;
}

/** Whether both-failed rows show the same failure text (green vs red dot). */
function bothFailedErrorsMatch(
  left: string | null | undefined,
  right: string | null | undefined
): boolean {
  const a = normalizeComparableError(left ?? "");
  const b = normalizeComparableError(right ?? "");
  if (a === b) return true;
  return false;
}

function SearchableDevBranchSelect({
  options,
  value,
  onChange,
  disabled,
  side,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  side: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuRect, setMenuRect] = useState<{
    top: number;
    left: number;
    width: number;
    /** Whole panel (search + list) must not extend past viewport bottom. */
    maxHeight: number;
  } | null>(null);
  const [mounted, setMounted] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const filterInputRef = useRef<HTMLInputElement>(null);

  const triggerId = `dev-branch-select-${side}`;
  const listboxId = `dev-branch-listbox-${side}`;
  const filterInputId = `dev-branch-filter-${side}`;

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((b) => b.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateMenuRect = useCallback(() => {
    if (!open || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const gap = 4;
    const viewportPad = 16;
    const top = r.bottom + gap;
    const availableBelow = Math.max(0, window.innerHeight - top - viewportPad);
    const capPx = 40 * 16; // 40rem cap; height also bounded by viewport
    const maxHeight = Math.min(capPx, availableBelow);
    setMenuRect({ top, left: r.left, width: r.width, maxHeight });
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuRect(null);
      return;
    }
    updateMenuRect();
    const onRelayout = () => updateMenuRect();
    window.addEventListener("resize", onRelayout);
    window.addEventListener("scroll", onRelayout, true);
    return () => {
      window.removeEventListener("resize", onRelayout);
      window.removeEventListener("scroll", onRelayout, true);
    };
  }, [open, updateMenuRect]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const t = requestAnimationFrame(() => filterInputRef.current?.focus());
    return () => cancelAnimationFrame(t);
  }, [open]);

  const empty = options.length === 0;
  const noMatches = !empty && filteredOptions.length === 0;

  const dropdown = open && mounted && menuRect && (
    <div
      ref={menuRef}
      id={listboxId}
      role="listbox"
      style={{
        position: "fixed",
        top: menuRect.top,
        left: menuRect.left,
        width: menuRect.width,
        maxHeight: menuRect.maxHeight,
        zIndex: 9_999,
      }}
      className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-800 bg-slate-950/95 shadow-xl shadow-black/40 backdrop-blur-sm ring-1 ring-slate-700/50"
    >
      <div className="shrink-0 border-b border-slate-800 p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            ref={filterInputRef}
            id={filterInputId}
            type="search"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search branches…"
            className={clsx(
              "w-full rounded-md border border-slate-800 bg-slate-900/80 py-2 pl-8 pr-3 text-xs font-mono text-slate-200 placeholder:text-slate-600",
              "focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            )}
            aria-label="Filter branches"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1 pb-2">
        {noMatches ? (
          <p className="px-3 py-6 text-center text-xs text-slate-500">
            No matches — try another search
          </p>
        ) : (
          filteredOptions.map((name) => {
            const selected = name === value;
            return (
              <button
                key={name}
                type="button"
                role="option"
                aria-selected={selected}
                className={clsx(
                  "flex w-full cursor-pointer px-3 py-2 text-left text-sm font-mono transition-colors",
                  selected
                    ? "bg-blue-600/25 text-blue-200"
                    : "text-slate-200 hover:bg-slate-800/80"
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(name);
                  setOpen(false);
                  setQuery("");
                }}
              >
                {name}
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        id={triggerId}
        disabled={disabled || empty}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => !empty && setOpen((o) => !o)}
        className={clsx(
          "relative w-full flex items-center justify-between gap-2 text-left appearance-none bg-slate-950/60 border border-slate-800 rounded-lg pl-4 pr-10 py-2.5 text-sm font-mono text-slate-200",
          "focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50",
          open && "ring-2 ring-blue-500/30"
        )}
      >
        <span className="truncate">
          {empty ? "No branches loaded" : value || "Select branch"}
        </span>
        <ChevronDown
          className={clsx(
            "absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {dropdown &&
        createPortal(dropdown, document.body)}
    </div>
  );
}

export default function CompareBranchesClient() {
  const [devBranches, setDevBranches] = useState<string[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(true);

  const [leftDev, setLeftDev] = useState("");
  const [rightDev, setRightDev] = useState("");

  const [data, setData] = useState<CompareBuildsApiResponse | null>(null);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const [leftBranchHistory, setLeftBranchHistory] = useState<
    CompareBranchHistoryItem[]
  >([]);
  const [rightBranchHistory, setRightBranchHistory] = useState<
    CompareBranchHistoryItem[]
  >([]);
  const [loadingLeftHistory, setLoadingLeftHistory] = useState(false);
  const [loadingRightHistory, setLoadingRightHistory] = useState(false);
  /** Tracks which dropdown values current history rows correspond to — avoids tearing down tables on every refresh. */
  const [branchHistoryFetchedFor, setBranchHistoryFetchedFor] = useState<{
    left: string | null;
    right: string | null;
  }>({ left: null, right: null });
  const [leftBuildPick, setLeftBuildPick] = useState<number | null>(null);
  const [rightBuildPick, setRightBuildPick] = useState<number | null>(null);
  /** When left is master vs another branch: union failures across multiple Jenkins builds. */
  const [leftMasterAggregateMode, setLeftMasterAggregateMode] = useState(false);
  const [leftAggregateBuilds, setLeftAggregateBuilds] = useState<number[]>([]);

  const isSameCanonicalBranch =
    !!leftDev && !!rightDev && leftDev === rightDev;

  const historyLoadingAny = loadingLeftHistory || loadingRightHistory;

  const historiesMatchSelections =
    !!leftDev &&
    !!rightDev &&
    branchHistoryFetchedFor.left === leftDev &&
    branchHistoryFetchedFor.right === rightDev;

  useEffect(() => {
    let cancelled = false;
    setLoadingBranches(true);
    setDevBranches([]);
    setError(null);
    axios
      .get<{ devBranches: string[] }>(
        `/api/dev-branches?branch=${encodeURIComponent(COMPARE_PAGE_JOB_FOLDER)}`
      )
      .then((res) => {
        if (cancelled) return;
        const list = res.data.devBranches || [];
        setDevBranches(list);
        setLeftDev((prev) => {
          if (prev && list.includes(prev)) return prev;
          const master = list.find((b) => b.toLowerCase() === "master");
          return master ?? list[0] ?? "";
        });
        setRightDev((prev) => {
          if (prev && list.includes(prev)) return prev;
          const left =
            list.find((b) => b.toLowerCase() === "master") ?? list[0] ?? "";
          const alt = list.find((b) => b !== left);
          return alt ?? left ?? "";
        });
      })
      .catch(() => {
        if (!cancelled) {
          setDevBranches([]);
          setError("Could not load DEV_BRANCH list from Jenkins.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingBranches(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!leftDev?.trim() || !rightDev?.trim()) {
      setLeftBranchHistory([]);
      setRightBranchHistory([]);
      setLeftBuildPick(null);
      setRightBuildPick(null);
      setLeftAggregateBuilds([]);
      setLeftMasterAggregateMode(false);
      setLoadingLeftHistory(false);
      setLoadingRightHistory(false);
      setBranchHistoryFetchedFor({ left: null, right: null });
      return;
    }

    let cancelled = false;
    setLoadingLeftHistory(true);
    setLoadingRightHistory(true);

    const fetchOne = (dev: string) =>
      axios.get<CompareBranchHistoryApiResponse>(
        `/api/compare-branch-history?branch=${encodeURIComponent(
          COMPARE_PAGE_JOB_FOLDER
        )}&devBranch=${encodeURIComponent(dev)}`
      );

    const sameDevs = leftDev === rightDev;
    const p = sameDevs
      ? fetchOne(leftDev).then((res) => {
          const list = res.data.builds || [];
          return [list, list] as const;
        })
      : Promise.all([
          fetchOne(leftDev).then((res) => res.data.builds || []),
          fetchOne(rightDev).then((res) => res.data.builds || []),
        ]);

    p.then(([listL, listR]) => {
      if (cancelled) return;
      setLeftBranchHistory(listL);
      setRightBranchHistory(listR);
      setBranchHistoryFetchedFor({
        left: leftDev.trim(),
        right: rightDev.trim(),
      });
      if (sameDevs) {
        if (listL.length > 1) {
          const firstN = listL[0].buildNumber;
          setLeftBuildPick(firstN);
          const second = listL.find((row) => row.buildNumber !== firstN);
          setRightBuildPick(
            second ? second.buildNumber : listL[1].buildNumber
          );
        } else {
          setLeftBuildPick(null);
          setRightBuildPick(null);
        }
      } else {
        const firstLeft =
          listL.length >= 1 ? listL[0].buildNumber : null;
        setLeftBuildPick(firstLeft);
        setLeftAggregateBuilds(
          firstLeft !== null ? [firstLeft] : []
        );
        setRightBuildPick(listR.length >= 1 ? listR[0].buildNumber : null);
      }
    })
      .catch(() => {
        if (!cancelled) {
          setLeftBranchHistory([]);
          setRightBranchHistory([]);
          setLeftBuildPick(null);
          setRightBuildPick(null);
          setLeftAggregateBuilds([]);
          setLeftMasterAggregateMode(false);
          setBranchHistoryFetchedFor({ left: null, right: null });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingLeftHistory(false);
          setLoadingRightHistory(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [leftDev, rightDev]);

  useEffect(() => {
    if (!isMasterCanonical(leftDev)) {
      setLeftMasterAggregateMode(false);
      setLeftAggregateBuilds([]);
    }
  }, [leftDev]);

  useEffect(() => {
    if (
      !isMasterCanonical(leftDev) ||
      isSameCanonicalBranch ||
      !leftMasterAggregateMode ||
      leftAggregateBuilds.length === 0
    ) {
      return;
    }
    const newest = Math.max(...leftAggregateBuilds);
    setLeftBuildPick((prev) => (prev === newest ? prev : newest));
  }, [
    leftDev,
    isSameCanonicalBranch,
    leftMasterAggregateMode,
    leftAggregateBuilds,
  ]);

  const runCompare = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!leftDev || !rightDev) return;

      if (leftDev === rightDev) {
        if (
          leftBranchHistory.length <= 1 ||
          leftBuildPick === null ||
          rightBuildPick === null
        ) {
          return;
        }
        if (leftBuildPick === rightBuildPick) {
          return;
        }
      } else {
        const leftOk =
          isMasterCanonical(leftDev) &&
          leftMasterAggregateMode &&
          leftAggregateBuilds.length >= 1
            ? true
            : leftBuildPick !== null;
        if (
          leftBranchHistory.length < 1 ||
          rightBranchHistory.length < 1 ||
          !leftOk ||
          rightBuildPick === null
        ) {
          return;
        }
      }

      setLoadingCompare(true);
      setError(null);
      setData(null);
      try {
        const baseUrl =
          `/api/compare-builds?branch=${encodeURIComponent(
            COMPARE_PAGE_JOB_FOLDER
          )}&leftDev=${encodeURIComponent(leftDev)}&rightDev=${encodeURIComponent(
            rightDev
          )}&rightBuild=${rightBuildPick}`;

        const url =
          !isSameCanonicalBranch &&
          isMasterCanonical(leftDev) &&
          leftMasterAggregateMode &&
          leftAggregateBuilds.length > 1
            ? `${baseUrl}&leftBuilds=${encodeURIComponent(
                [...leftAggregateBuilds].sort((a, b) => b - a).join(",")
              )}`
            : `${baseUrl}&leftBuild=${leftBuildPick}`;
        const res = await axios.get<CompareBuildsApiResponse>(url);
        setData(res.data);
      } catch (err: unknown) {
        const ax = err as { response?: { data?: { error?: string } } };
        const message =
          ax.response?.data?.error ||
          (err instanceof Error ? err.message : "Comparison failed.");
        setError(message);
      } finally {
        setLoadingCompare(false);
      }
    },
    [
      leftDev,
      rightDev,
      leftBranchHistory.length,
      rightBranchHistory.length,
      leftBuildPick,
      rightBuildPick,
      isSameCanonicalBranch,
      leftMasterAggregateMode,
      leftAggregateBuilds,
    ]
  );

  const duplicateBuildSelected =
    isSameCanonicalBranch &&
    leftBranchHistory.length > 1 &&
    leftBuildPick !== null &&
    rightBuildPick !== null &&
    leftBuildPick === rightBuildPick;

  const showBuildPickers =
    !!leftDev &&
    !!rightDev &&
    historiesMatchSelections &&
    (isSameCanonicalBranch
      ? leftBranchHistory.length > 1
      : leftBranchHistory.length >= 1 && rightBranchHistory.length >= 1);

  const showUnifiedHistoryCard =
    !!leftDev &&
    !!rightDev &&
    isSameCanonicalBranch &&
    branchHistoryFetchedFor.left === leftDev &&
    branchHistoryFetchedFor.right === rightDev &&
    leftBranchHistory.length > 0;

  const showLeftHistoryCardOnly =
    !!leftDev &&
    !isSameCanonicalBranch &&
    branchHistoryFetchedFor.left === leftDev &&
    leftBranchHistory.length > 0;

  const showRightHistoryCardOnly =
    !!rightDev &&
    !isSameCanonicalBranch &&
    branchHistoryFetchedFor.right === rightDev &&
    rightBranchHistory.length > 0;

  const anyHistoryTableVisible =
    !!leftDev &&
    !!rightDev &&
    (showUnifiedHistoryCard ||
      showLeftHistoryCardOnly ||
      showRightHistoryCardOnly);

  const SidePanel = ({
    side,
    label,
    accent,
    value,
    onChange,
    disabled,
  }: {
    side: "left" | "right";
    label: string;
    accent: string;
    value: string;
    onChange: (v: string) => void;
    disabled?: boolean;
  }) => (
    <div
      className={clsx(
        /* Same look as .glass-card but without overflow-hidden — that was clipping the branch dropdown */
        "bg-slate-900/50 backdrop-blur-md border border-slate-800/60 rounded-xl p-6 flex flex-col gap-4 min-h-[220px] min-w-0",
        accent
      )}
    >
      <div className="flex items-center gap-2 text-slate-300">
        <GitBranch className="w-4 h-4 text-indigo-400 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
          {label}
        </span>
      </div>
      <div>
        <label
          htmlFor={`dev-branch-select-${side}`}
          className="block text-[11px] font-bold text-slate-500 uppercase mb-2"
        >
          DEV_BRANCH
        </label>
        <SearchableDevBranchSelect
          options={devBranches}
          value={value}
          onChange={onChange}
          disabled={disabled || devBranches.length === 0}
          side={side}
        />
        {loadingBranches && (
          <p className="text-xs text-slate-500 mt-2 animate-pulse">
            Loading branches from Jenkins…
          </p>
        )}
      </div>
    </div>
  );

  function renderExclusiveList(
    title: string,
    subtitle: string,
    items: FailedTestDetail[],
    borderClass: string
  ) {
    return (
      <div className="mb-8 last:mb-0">
        <h3
          className={clsx(
            "flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 text-base font-bold text-slate-200 mb-3 border-b pb-2",
            borderClass
          )}
        >
          <span>{title}</span>
          <span className="text-xs font-normal text-slate-500 normal-case">
            {subtitle} ({items.length})
          </span>
        </h3>
        {items.length === 0 ? (
          <p className="text-sm text-slate-500 italic py-3">None.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((row) => {
              const key = `${title}-${row.testName}`;
              const open = expandedKey === key;
              return (
                <li
                  key={key}
                  className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden"
                >
                  <button
                    type="button"
                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-800/30 transition-colors"
                    onClick={() => setExpandedKey(open ? null : key)}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      {open ? (
                        <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                      )}
                      <span className="text-sm font-medium text-slate-200 truncate">
                        {row.testName}
                      </span>
                    </span>
                  </button>
                  {open && (
                    <div className="px-4 pb-4 border-t border-slate-800 bg-slate-950/40">
                      <pre className="text-[11px] text-rose-300/90 font-mono p-3 bg-slate-900/80 rounded-lg border border-rose-500/10 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap mt-3">
                        {row.errorDetails || "—"}
                      </pre>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  function renderBothFailedList(
    title: string,
    subtitle: string,
    items: CompareBuildsBothFailed[],
    borderClass: string
  ) {
    return (
      <div className="mb-8 last:mb-0">
        <h3
          className={clsx(
            "flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 text-base font-bold text-slate-200 mb-3 border-b pb-2",
            borderClass
          )}
        >
          <span>{title}</span>
          <span className="text-xs font-normal text-slate-500 normal-case">
            {subtitle} ({items.length})
          </span>
        </h3>
        {items.length === 0 ? (
          <p className="text-sm text-slate-500 italic py-3">None.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((row) => {
              const key = `${title}-${row.testName}`;
              const open = expandedKey === key;
              const sameError = bothFailedErrorsMatch(
                row.leftError,
                row.rightError
              );
              return (
                <li
                  key={key}
                  className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden"
                >
                  <button
                    type="button"
                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-800/30 transition-colors"
                    onClick={() => setExpandedKey(open ? null : key)}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      {open ? (
                        <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                      )}
                      <span className="flex items-center gap-1.5 min-w-0 flex-1 text-sm font-medium text-slate-200">
                        <span
                          aria-hidden
                          title={
                            sameError
                              ? "Same error on both builds"
                              : "Different errors on each build"
                          }
                          className={clsx(
                            "shrink-0 rounded-full",
                            sameError ? "bg-emerald-400" : "bg-rose-500"
                          )}
                          style={{
                            width: "1cap",
                            height: "1cap",
                          }}
                        />
                        <span className="truncate">{row.testName}</span>
                      </span>
                    </span>
                  </button>
                  {open && (
                    <div className="px-4 pb-4 space-y-3 border-t border-slate-800 bg-slate-950/40">
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">
                          1st branch
                        </p>
                        <pre className="text-[11px] text-rose-300/90 font-mono p-3 bg-slate-900/80 rounded-lg border border-rose-500/10 overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap">
                          {row.leftError || "—"}
                        </pre>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">
                          2nd branch
                        </p>
                        <pre className="text-[11px] text-amber-300/90 font-mono p-3 bg-slate-900/80 rounded-lg border border-amber-500/10 overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap">
                          {row.rightError || "—"}
                        </pre>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  const canCompareDifferent =
    !!leftDev &&
    !!rightDev &&
    leftDev !== rightDev &&
    !loadingBranches &&
    devBranches.length > 0 &&
    !historyLoadingAny &&
    leftBranchHistory.length >= 1 &&
    rightBranchHistory.length >= 1 &&
    rightBuildPick !== null &&
    ((isMasterCanonical(leftDev) &&
      leftMasterAggregateMode &&
      leftAggregateBuilds.length >= 1) ||
      leftBuildPick !== null);

  const canCompareSameBranch =
    isSameCanonicalBranch &&
    !loadingBranches &&
    !historyLoadingAny &&
    leftBranchHistory.length > 1 &&
    leftBuildPick !== null &&
    rightBuildPick !== null &&
    leftBuildPick !== rightBuildPick;

  const canCompare =
    canCompareDifferent || canCompareSameBranch;

  const leftBranchHistorySorted = useMemo(
    () =>
      [...leftBranchHistory].sort((a, b) => b.timestamp - a.timestamp),
    [leftBranchHistory]
  );

  const showMasterAggregateControls =
    !isSameCanonicalBranch &&
    showBuildPickers &&
    isMasterCanonical(leftDev);

  return (
    <>
      <form onSubmit={runCompare} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 items-stretch">
          <SidePanel
            side="left"
            label="1st branch"
            accent="border-blue-500/25 lg:border-blue-500/35"
            value={leftDev}
            onChange={(v) => {
              setLeftDev(v);
              setData(null);
            }}
            disabled={loadingBranches}
          />
          <SidePanel
            side="right"
            label="2nd branch"
            accent="border-violet-500/25 lg:border-violet-500/35"
            value={rightDev}
            onChange={(v) => {
              setRightDev(v);
              setData(null);
            }}
            disabled={loadingBranches}
          />
        </div>

        {showBuildPickers && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 items-stretch">
            <div className="glass-card p-6 border border-slate-800 min-h-[120px] flex min-w-0 flex-col">
              <label
                htmlFor="build-pick-select-left"
                className="mb-2 flex min-h-[3rem] shrink-0 flex-col justify-end gap-0.5"
              >
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  Pick build #
                </span>
                <span
                  className="truncate font-mono text-xs text-slate-300"
                  title={leftDev}
                >
                  {leftDev}
                </span>
              </label>
              <div className="min-w-0 w-full space-y-3">
                {showMasterAggregateControls ? (
                  <div className="space-y-3 rounded-lg border border-slate-800/90 bg-slate-950/30 p-3">
                    <label className="flex cursor-pointer gap-2.5 text-left text-xs text-slate-300">
                      <input
                        type="checkbox"
                        className="mt-0.5 shrink-0 rounded border-slate-600"
                        checked={leftMasterAggregateMode}
                        onChange={(e) => {
                          const on = e.target.checked;
                          setLeftMasterAggregateMode(on);
                          setData(null);
                          if (on) {
                            const seed =
                              leftBuildPick ??
                              leftBranchHistory[0]?.buildNumber ??
                              null;
                            setLeftAggregateBuilds(
                              seed !== null ? [seed] : []
                            );
                          } else {
                            const fallback = [...leftAggregateBuilds].sort(
                              (a, b) => b - a
                            )[0];
                            if (fallback != null) setLeftBuildPick(fallback);
                          }
                        }}
                      />
                      <span className="leading-snug">
                        <span className="font-semibold text-slate-200">
                          Combine master builds into one baseline
                        </span>
                        <span className="block text-[11px] text-slate-500 mt-0.5 normal-case font-normal">
                          Union failed tests across the selected Jenkins runs
                          (e.g. coverage from the past few days); pick one build
                          for the comparison branch below.
                        </span>
                      </span>
                    </label>
                  </div>
                ) : null}
                {!showMasterAggregateControls || !leftMasterAggregateMode ? (
                  <SearchableBuildPickSelect
                    side="left"
                    options={leftBranchHistory}
                    value={leftBuildPick}
                    onChange={(n) => {
                      setLeftBuildPick(n);
                      setLeftAggregateBuilds([n]);
                      setData(null);
                    }}
                  />
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-md border border-slate-700 bg-slate-800/70 px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 hover:bg-slate-800"
                        onClick={() => {
                          const cutoff = Date.now() - 3 * 86400000;
                          const picks = dedupeInts(
                            leftBranchHistorySorted
                              .filter((b) => b.timestamp >= cutoff)
                              .map((b) => b.buildNumber)
                          );
                          if (picks.length) {
                            setLeftAggregateBuilds(picks.sort((a, b) => b - a));
                            setData(null);
                          }
                        }}
                      >
                        Select last 3 days
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-slate-700 bg-slate-800/70 px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 hover:bg-slate-800"
                        onClick={() => {
                          const m = [...leftAggregateBuilds].sort(
                            (a, c) => c - a
                          )[0];
                          if (m != null) {
                            setLeftAggregateBuilds([m]);
                            setData(null);
                          }
                        }}
                      >
                        Keep newest only
                      </button>
                      <span className="text-[11px] text-slate-500 self-center ml-auto tabular-nums">
                        Selected: {leftAggregateBuilds.length} build
                        {leftAggregateBuilds.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="max-h-52 min-h-[8rem] space-y-0.5 overflow-y-auto rounded-md border border-slate-800 bg-slate-950/40 p-2">
                      {leftBranchHistorySorted.map((b) => {
                        const checked = leftAggregateBuilds.includes(
                          b.buildNumber
                        );
                        return (
                          <label
                            key={`agg-left-${b.buildNumber}`}
                            className="flex cursor-pointer items-start gap-2 rounded px-1.5 py-1 text-[11px] font-mono text-slate-200 hover:bg-slate-900/70"
                          >
                            <input
                              type="checkbox"
                              className="mt-1 shrink-0 rounded border-slate-600"
                              checked={checked}
                              disabled={
                                checked &&
                                leftAggregateBuilds.length === 1
                              }
                              onChange={() => {
                                setLeftAggregateBuilds((prev) => {
                                  const next = checked
                                    ? prev.filter((n) => n !== b.buildNumber)
                                    : [...prev, b.buildNumber];
                                  if (
                                    checked &&
                                    prev.length <= 1
                                  ) {
                                    return prev;
                                  }
                                  return dedupeInts(next).sort((a, c) => c - a);
                                });
                                setData(null);
                              }}
                            />
                            <span className="min-w-0 break-words">
                              #{b.buildNumber} · {formatBuildTime(b.timestamp)}{" "}
                              · {b.failedTestCount} failures
                              {(b.moduleRun ?? "").trim()
                                ? ` · ${String(b.moduleRun).trim()}`
                                : ""}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="glass-card p-6 border border-slate-800 min-h-[120px] flex min-w-0 flex-col">
              <label
                htmlFor="build-pick-select-right"
                className="mb-2 flex min-h-[3rem] shrink-0 flex-col justify-end gap-0.5"
              >
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  Pick build #
                </span>
                <span
                  className="truncate font-mono text-xs text-slate-300"
                  title={rightDev}
                >
                  {rightDev}
                </span>
              </label>
              <div className="min-w-0 w-full">
                <SearchableBuildPickSelect
                side="right"
                options={rightBranchHistory}
                value={rightBuildPick}
                onChange={(n) => {
                  setRightBuildPick(n);
                  setData(null);
                }}
              />
              </div>
            </div>
          </div>
        )}

        {duplicateBuildSelected && (
          <div className="glass-card px-4 py-3 border border-amber-500/40 bg-amber-500/10 text-amber-200 text-sm text-center">
            You cannot select the same build number on both sides. Choose two
            different builds from the lists above.
          </div>
        )}

        <div className="flex justify-center">
          <button
            type="submit"
            disabled={!canCompare || loadingCompare}
            className="h-11 px-8 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {loadingCompare ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <ArrowRightLeft className="w-4 h-4" />
            )}
            Compare builds
          </button>
        </div>
      </form>

      {!!leftDev && !!rightDev && historyLoadingAny && !anyHistoryTableVisible && (
        <p className="text-center text-xs text-slate-500 py-8">
          Loading build history for selected DEV_BRANCH values…
        </p>
      )}

      {!!leftDev &&
        !!rightDev &&
        historyLoadingAny &&
        !historiesMatchSelections &&
        anyHistoryTableVisible && (
          <p className="text-center text-xs text-slate-500 pb-3">
            Updating build lists…
          </p>
        )}

      {!!leftDev &&
        !!rightDev &&
        (isSameCanonicalBranch ? (
          showUnifiedHistoryCard && (
            <BuildHistoryTableCard devLabel={leftDev} rows={leftBranchHistory} />
          )
        ) : (
          <div className="space-y-4">
            {showLeftHistoryCardOnly && (
              <BuildHistoryTableCard
                devLabel={leftDev}
                rows={leftBranchHistory}
              />
            )}
            {showRightHistoryCardOnly && (
              <BuildHistoryTableCard
                devLabel={rightDev}
                rows={rightBranchHistory}
              />
            )}
          </div>
        ))}

      {historiesMatchSelections &&
        isSameCanonicalBranch &&
        leftBranchHistory.length === 1 && (
          <p className="text-center text-xs text-slate-500 italic">
            Only one build for this DEV_BRANCH appears in the newest{" "}
            {COMPARE_PAGE_JENKINS_BUILD_FETCH_LIMIT} Jenkins runs for this folder —
            picking two builds is unavailable. Use two different DEV_BRANCH
            values to compare pinned builds side by side, or raise{" "}
            <span className="font-mono">
              COMPARE_PAGE_JENKINS_BUILD_FETCH_LIMIT
            </span>{" "}
            in <span className="font-mono">app/compare/constants.ts</span>.
          </p>
        )}

      {historiesMatchSelections &&
        !!leftDev &&
        !!rightDev &&
        leftDev !== rightDev &&
        (leftBranchHistory.length === 0 || rightBranchHistory.length === 0) && (
          <p className="text-center text-xs text-slate-500 italic">
            No Jenkins run found for one or both DEV_BRANCH values in the newest{" "}
            {COMPARE_PAGE_JENKINS_BUILD_FETCH_LIMIT} builds for this folder — pick
            other branches or widen the fetch limit.
          </p>
        )}

      {error && (
        <div className="glass-card p-4 border border-rose-500/30 bg-rose-500/10 text-rose-300 text-sm">
          {error}
        </div>
      )}

      {data && (
        <div className="animate-fade-in space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="glass-card p-5 border border-blue-500/20">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase mb-1">
                <Gauge className="w-3.5 h-3.5" />
                1st branch —{" "}
                {data.meta.compareMode === "aggregated-master-baseline"
                  ? "combined baseline"
                  : data.meta.compareMode === "pinned-builds"
                    ? "selected build"
                    : "latest build"}
              </div>
              {data.left.aggregatedFromBuildNumbers &&
              data.left.aggregatedFromBuildNumbers.length > 1 ? (
                <>
                  <p className="text-sm font-bold text-blue-400 leading-snug">
                    #{data.left.aggregatedFromBuildNumbers.join(" · #")}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Anchored display build #{data.left.buildNumber} · baseline
                    is the union of failed tests across builds above (newest
                    error snippet kept).
                  </p>
                </>
              ) : (
                <p className="text-xl font-mono font-bold text-blue-400">
                  #{data.left.buildNumber}
                </p>
              )}
              <p className="text-sm text-slate-300 truncate" title={data.left.devBranch}>
                {data.left.devBranch}
              </p>
              <p
                className="text-xs text-slate-500 mt-2"
                suppressHydrationWarning
              >
                {formatBuildTime(data.left.timestamp)} · {data.left.result} ·{" "}
                {data.left.failedCount} failed
              </p>
            </div>
            <div className="glass-card p-5 border border-violet-500/20">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase mb-1">
                <Gauge className="w-3.5 h-3.5" />
                2nd branch —{" "}
                {data.meta.compareMode === "pinned-builds"
                  ? "selected build"
                  : "latest build"}
              </div>
              <p className="text-xl font-mono font-bold text-violet-400">
                #{data.right.buildNumber}
              </p>
              <p className="text-sm text-slate-300 truncate" title={data.right.devBranch}>
                {data.right.devBranch}
              </p>
              <p
                className="text-xs text-slate-500 mt-2"
                suppressHydrationWarning
              >
                {formatBuildTime(data.right.timestamp)} · {data.right.result} ·{" "}
                {data.right.failedCount} failed
              </p>
            </div>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-6 text-slate-200">
              <GitCompare className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-bold">Failure diff</h2>
            </div>

            {renderBothFailedList(
              "Failed on both sides",
              "Same test name failing in both builds",
              data.bothFailed,
              "border-amber-500/40"
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-10">
              <div>
                <div className="flex items-center gap-2 mb-4 text-slate-300">
                  <Layers className="w-4 h-4 text-blue-400" />
                  <span className="font-semibold text-sm">
                    Only 1st branch ({data.left.devBranch})
                  </span>
                </div>
                {renderExclusiveList(
                  "Exclusive failures",
                  "1st branch only",
                  data.leftOnly,
                  "border-blue-500/30"
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-4 text-slate-300">
                  <Layers className="w-4 h-4 text-violet-400" />
                  <span className="font-semibold text-sm">
                    Only 2nd branch ({data.right.devBranch})
                  </span>
                </div>
                {renderExclusiveList(
                  "Exclusive failures",
                  "2nd branch only",
                  data.rightOnly,
                  "border-violet-500/30"
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
