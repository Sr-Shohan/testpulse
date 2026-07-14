// ─── Jenkins Raw API Types ───────────────────────────────────

export interface JenkinsRawBuild {
  number: number;
  timestamp: number;
  result: string | null;
  building?: boolean;
}

export interface JenkinsParameter {
  name: string;
  value: string;
}

export interface JenkinsAction {
  parameters?: JenkinsParameter[];
}

export interface JenkinsTestCase {
  name: string;
  status: string;
  errorDetails: string | null;
  duration?: number;
  className?: string;
}

export interface JenkinsSuite {
  name: string;
  cases: JenkinsTestCase[];
}

// ─── Processed Types ─────────────────────────────────────────

export interface BuildInfo {
  buildNumber: number;
  timestamp: number;
  result: string;
  testBranch: string;
  devBranch: string;
  dashboardStage: string;
  /** Jenkins-derived module label (readable: "All modules", "Regression", inferred paths, etc.). */
  moduleRun?: string;
  failedTestCount: number;
  totalTestCount: number;
  failedTestNames: string[];
}

export interface TestCaseResult {
  name: string;
  status: string;
  errorDetails: string | null;
  duration?: number;
  className?: string;
  buildNumber: number;
  buildTimestamp: number;
}

export interface TestAggregation {
  testName: string;
  totalRuns: number;
  failureCount: number;
  passCount: number;
  flakyScore: number;
  failureTimestamps: number[];
  lastFailedAt: number | null;
  errorMessages: string[];
  consecutiveFailures: number;
  consecutivePasses: number;
}

export interface FlakyTestData extends TestAggregation {
  isFlaky: boolean;
  history: Array<{
    buildNumber: number;
    timestamp: number;
    status: string;
    errorDetails: string | null;
  }>;
}

export interface DashboardSummary {
  totalBuilds: number;
  totalTests: number;
  totalFailures: number;
  successRate: number;
  alwaysFailingCount: number;
  flakyTestCount: number;
  topFlakyTests: FlakyTestData[];
}

export interface BranchInfo {
  name: string;
  url: string;
}

// ─── API Response Types ──────────────────────────────────────

export interface BuildsApiResponse {
  builds: BuildInfo[];
  meta: {
    branch: string;
    days: number;
    testBranch: string;
    devBranch: string;
    totalFetched: number;
    totalFiltered: number;
  };
}

export interface FlakyApiResponse {
  tests: FlakyTestData[];
  builds: BuildInfo[];
  summary: DashboardSummary;
  meta: {
    branch: string;
    days: number;
    testBranch: string;
    devBranch: string;
    buildsAnalyzed: number;
    cachedAt: number;
  };
}

/** Trimmed flaky payload when `?top=N` is used (no build list). */
export type FlakyApiResponseSlim = Omit<FlakyApiResponse, "builds"> & {
  meta: FlakyApiResponse["meta"] & { top: number };
};

export interface CompareFailure {
  testName: string;
  category: "NEW_FAILURE" | "NEW_ERROR" | "PRE_EXISTING";
  targetError: string | null;
  targetDuration?: number;
  baselineErrors: string[];
}

export interface CompareApiResponse {
  targetBuild: BuildInfo;
  baselineBuildsAnalyzed: number;
  failures: CompareFailure[];
  meta: {
    targetId: string;
    baselineDevBranch: string;
    days: number;
  };
}

export interface FailedTestDetail {
  testName: string;
  className?: string;
  errorDetails: string | null;
  duration?: number;
}

export interface CompareBuildsSideMeta {
  devBranch: string;
  buildNumber: number;
  timestamp: number;
  result: string;
  failedCount: number;
  /** When set, failures on this side are aggregated across these Jenkins build numbers. */
  aggregatedFromBuildNumbers?: number[];
}

export interface CompareBuildsBothFailed {
  testName: string;
  className?: string;
  leftError: string | null;
  rightError: string | null;
}

export interface CompareBranchHistoryItem {
  buildNumber: number;
  timestamp: number;
  result: string;
  failedTestCount: number;
  totalTestCount: number;
  dashboardStage: string;
  moduleRun: string;
  devBranch: string;
  testBranch: string;
}

export interface CompareBranchHistoryApiResponse {
  builds: CompareBranchHistoryItem[];
  meta: {
    branch: string;
    devBranch: string;
    scannedBuildCap: number;
  };
}

export interface CompareBuildsApiResponse {
  meta: {
    branch: string;
    scannedBuildCap: number;
    compareMode:
      | "latest-per-branch"
      | "pinned-builds"
      | "aggregated-master-baseline";
  };
  left: CompareBuildsSideMeta;
  right: CompareBuildsSideMeta;
  leftFailures: FailedTestDetail[];
  rightFailures: FailedTestDetail[];
  leftOnly: FailedTestDetail[];
  rightOnly: FailedTestDetail[];
  bothFailed: CompareBuildsBothFailed[];
}

export interface DriftTest {
  testName: string;
  baselinePassRate: number;
  targetPassRate: number;
  driftScore: number; // baselinePassRate - targetPassRate
  baselineRuns: number;
  targetRuns: number;
  baselineErrors: string[];
  targetErrors: string[];
}

export interface DriftApiResponse {
  driftedTests: DriftTest[];
  baselineBuildCount: number;
  targetBuildCount: number;
  meta: {
    targetStage: string;
    baselineStage: string;
    days: number;
  };
}

export interface PassRateWindow {
  /** Length of the trailing window in days. */
  days: number;
  /** Epoch ms cutoff — builds with `timestamp >= since` are included. */
  since: number;
  /** Number of builds in this window. */
  total: number;
  success: number;
  failure: number;
  unstable: number;
  /** Any other terminal result (e.g. NOT_BUILT). */
  other: number;
  /** `success / total` as a 0–100 percentage (0 when no builds). */
  passRate: number;
}

export interface PassRateApiResponse {
  windows: PassRateWindow[];
  meta: {
    branch: string;
    testBranch: string;
    devBranch: string;
    /** Echo of the requested window sizes (days), sorted ascending. */
    windows: number[];
    /** Builds available in the largest window (the pool every window slices from). */
    buildsAnalyzed: number;
    generatedAt: number;
  };
}

export interface TestHistoryPoint {
  buildNumber: number;
  timestamp: number;
  status: string;
  errorDetails: string | null;
  /** DEV_BRANCH of the build this run came from. */
  devBranch: string;
}

export interface TestHistoryApiResponse {
  /** The matched test name (may differ in case from the query). */
  testName: string;
  totalRuns: number;
  failureCount: number;
  passCount: number;
  skippedCount: number;
  /** `failureCount / totalRuns`, 0–1 (matches the flaky endpoint definition). */
  flakyScore: number;
  isFlaky: boolean;
  /** Failures in a row counting back from the most recent run. */
  consecutiveFailures: number;
  /** Passes in a row counting back from the most recent run. */
  consecutivePasses: number;
  firstSeenAt: number | null;
  lastRunAt: number | null;
  lastFailedAt: number | null;
  /** Distinct failure messages (most recent first), capped. */
  errorMessages: string[];
  /** Per-build runs, newest first. */
  history: TestHistoryPoint[];
  meta: {
    branch: string;
    days: number;
    testBranch: string;
    devBranch: string;
    /** The raw test name the caller queried. */
    query: string;
    buildsAnalyzed: number;
    cachedAt: number;
  };
}
