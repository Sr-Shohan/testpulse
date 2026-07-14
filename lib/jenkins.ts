import axios, { AxiosInstance } from 'axios';
import {
  JenkinsRawBuild,
  JenkinsAction,
  JenkinsSuite,
  BuildInfo,
  TestCaseResult,
  BranchInfo,
} from './types';
import * as demo from './demo/dataset';

/**
 * Data source switch. Defaults to the built-in demo dataset so the product runs
 * with no external services. Set `DATA_SOURCE=jenkins` (plus JENKINS_* env vars)
 * to point the same code at a real Jenkins instance.
 */
const USE_DEMO =
  (process.env.DATA_SOURCE ?? 'demo').trim().toLowerCase() !== 'jenkins';

// ─── Cache Implementation ────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

export async function cachedFetch<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const existing = cache.get(key);
  if (existing && Date.now() - existing.timestamp < existing.ttl) {
    return existing.data as T;
  }

  const data = await fetcher();
  cache.set(key, { data, timestamp: Date.now(), ttl: ttlMs });
  return data;
}

export function clearCache(keyPrefix?: string) {
  if (keyPrefix) {
    for (const key of cache.keys()) {
      if (key.startsWith(keyPrefix)) cache.delete(key);
    }
  } else {
    cache.clear();
  }
}

// ─── Jenkins HTTP Client ─────────────────────────────────────

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getJenkinsClient(): AxiosInstance {
  const user = process.env.JENKINS_USER;
  const token = process.env.JENKINS_TOKEN;
  const baseURL = process.env.JENKINS_BASE_URL;

  if (!user || !token || !baseURL) {
    throw new Error('Missing Jenkins credentials in environment variables');
  }

  const auth = Buffer.from(`${user}:${token}`).toString('base64');

  return axios.create({
    baseURL,
    headers: { Authorization: `Basic ${auth}` },
    timeout: 30000,
  });
}

// ─── API Functions ───────────────────────────────────────────

export async function fetchBranches(): Promise<BranchInfo[]> {
  return cachedFetch('branches', CACHE_TTL, async () => {
    if (USE_DEMO) return demo.getBranches();
    const client = getJenkinsClient();
    const res = await client.get('/api/json?tree=jobs[name,url]');
    return (res.data.jobs || []).map((j: { name: string; url: string }) => ({
      name: j.name,
      url: j.url,
    }));
  });
}

export async function fetchBuilds(
  branch: string,
  count: number = 100
): Promise<JenkinsRawBuild[]> {
  return cachedFetch(`builds:${branch}:${count}`, CACHE_TTL, async () => {
    if (USE_DEMO) return demo.getRawBuilds(branch, count);
    const client = getJenkinsClient();
    const res = await client.get(
      `/job/${encodeURIComponent(branch)}/api/json?tree=builds[number,result,timestamp]{0,${count}}`
    );
    return res.data.builds || [];
  });
}

/** Normalize Jenkins parameter values (often strings; choice/credentials can nest `value`). */
function jenkinsParamValueToString(value: unknown, depth = 0): string {
  if (depth > 8 || value == null || value === '') return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  if (Array.isArray(value))
    return value
      .map((v) => jenkinsParamValueToString(v, depth + 1))
      .filter(Boolean)
      .join(', ');
  if (typeof value === 'object' && value !== null) {
    const o = value as Record<string, unknown>;
    const nested = jenkinsParamValueToString(o.value, depth + 1);
    if (nested) return nested;
    if (typeof o.name === 'string' && o.name.trim()) return o.name.trim();
  }
  return '';
}

/** True when Jenkins build parameters enable stability-test / shake mode (skew pass-fail aggregates). */
function isStabilityTestBuild(params: Record<string, string>): boolean {
  const names = new Set([
    'STABILITY_TEST',
    'ENABLE_STABILITY_TEST',
    'STABILITY_TEST_MODE',
  ]);
  for (const [key, raw] of Object.entries(params)) {
    const nk = key.toUpperCase().replace(/[\s-]+/g, '_');
    if (!names.has(nk)) continue;
    const v = (raw || '').trim().toLowerCase();
    if (v === 'true' || v === 'yes' || v === '1' || v === 'on') return true;
  }
  return false;
}

/** Whether Jenkins Modules param is the catch‑all slice (everything), not the concrete run flavour. */
function isAllModulesChoice(v: string): boolean {
  const x = v.trim().replace(/[-\s]+/g, '_').toUpperCase();
  return x === 'ALL_MODULES' || x === 'ALLMODULES';
}

/** REGRESSION_* value that should not replace the Modules label. */
function isNoRegressionSentinel(v: string): boolean {
  return /^(none|no|false|off|skip|n\/a|-|0)$/i.test(v.trim());
}

/** Underscores/dashes → spaces; each word Capital rest lowercase (digits preserved). */
function toTitleWords(spacedLowerSource: string): string {
  return spacedLowerSource
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => {
      if (/^\d+$/.test(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');
}

/** Normalize Jenkins values for Compare "Module run": no underscores, no SHOUTCASE. */
function humanizeModuleRunLabel(raw: string): string {
  const t = raw.trim();
  if (!t) return '';

  const compact = t.replace(/[-\s]+/g, '_').toUpperCase();

  if (compact === 'ALL_MODULES' || compact === 'ALLMODULES') return 'All modules';
  if (compact === 'REGRESSION' || compact === 'RERUN_REGRESSION') return 'Regression';
  if (
    compact === 'CRITICAL_REGRESSION' ||
    compact === 'CRITICAL' ||
    (compact.includes('CRITICAL') && compact.includes('REGRESSION'))
  ) {
    return 'Critical regression';
  }

  const wordsLower = t
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((x) => x.toLowerCase());
  const hasCritical = wordsLower.includes('critical');
  const hasRegression = wordsLower.includes('regression');
  if (hasCritical && hasRegression) return 'Critical regression';
  if (wordsLower.length === 1 && hasRegression) return 'Regression';
  if (wordsLower.length === 1 && hasCritical) return 'Critical regression';

  const spaced = t.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();

  /* Single shouting token (PYTEST etc.) → Pytest */
  if (!/\s/.test(spaced) && spaced.length > 1 && spaced === spaced.toUpperCase()) {
    return toTitleWords(spaced.toLowerCase());
  }

  return toTitleWords(spaced.toLowerCase());
}

/** Compose comma-separated module hints (each segment normalized the same way). */
function finalizeModuleRunDisplay(raw: string): string {
  const s = raw.trim();
  if (!s) return '';
  return s
    .split(',')
    .map((p) => humanizeModuleRunLabel(p.trim()))
    .filter(Boolean)
    .join(', ');
}

/**
 * Test module actually exercised: Prefer explicit `Modules` unless it is ALL_MODULES and a
 * regression / run‑type parameter is set (column shows Regression, not only ALL_MODULES).
 */
function moduleRunFromParams(params: Record<string, string>): string {
  const moduleKeys = [
    'DASHBOARD_MODULES_TO_TEST',
  ];

  const regressionKeys = [
    'REGRESSION_TYPE',
    'REGRESSION',
    'Regression',
    'RegressionType',
    'Regression_Type',
    'Regression_Mode',
    'REGRESSION_MODE',
    'RegressionMode',
    'CRITICAL_REGRESSION',
    'TestRegression',
    'TEST_REGRESSION',
  ];

  const keys = [
    ...moduleKeys,
    'TEST_SUITE',
    'TEST_SUITES',
    'SUITE',
    'SUITE_NAME',
    'SUITES',
    'UI_SUITE',
    'TESTS',
    'TESTS_TO_RUN',
    'TEST_PATH',
    'TEST_FILTER',
    'TAGS',
    'TEST_TAGS',
    'GREPLINE',
    'GREP',
    'GROUP',
    'TEST_GROUP',
    ...regressionKeys,
    'Scope',
    'SCOPE',
    'PROFILE',
    'TEST_PROFILE',
    'SPRING_PROFILES_ACTIVE',
    'PLAYWRIGHT_PROJECT',
    'PLAN',
    'BATCH',
    'JOB_TYPE',
    'PIPELINE_TYPE',
    'APPLICATION',
    'APP',
    'PROJECT',
    'CONFIG',
  ];

  const heuristicSkipKey = (kl: string): boolean =>
    kl === 'dev_branch' ||
    kl === 'test_branch' ||
    kl === 'dashboard_stage' ||
    kl === 'user' ||
    kl === 'username' ||
    kl === 'author' ||
    kl.includes('credential') ||
    kl.includes('password') ||
    kl.includes('token') ||
    (kl.includes('secret') && !kl.includes('suite')) ||
    kl.startsWith('git_') ||
    kl === 'branch' ||
    kl.endsWith('_branch') ||
    /(^|_)user(name)?$/i.test(kl) ||
    kl.includes('_user');

  const byLower = (): Map<string, string> => {
    const m = new Map<string, string>();
    for (const [rawK, rawV] of Object.entries(params)) {
      const v = rawV.trim();
      if (!v) continue;
      m.set(rawK.toLowerCase(), v);
    }
    return m;
  };

  const pickFirst = (names: string[], low: Map<string, string>): string => {
    for (const k of names) {
      const v =
        (params[k] || '').trim() || low.get(k.toLowerCase()) || '';
      if (v) return v.trim();
    }
    return '';
  };

  const low = byLower();
  const modulesCandidate = pickFirst(moduleKeys, low);
  const regressionCandidate = pickFirst(regressionKeys, low);

  if (
    regressionCandidate &&
    !isNoRegressionSentinel(regressionCandidate) &&
    (isAllModulesChoice(modulesCandidate) || !modulesCandidate)
  ) {
    return humanizeModuleRunLabel(regressionCandidate);
  }

  if (modulesCandidate) return humanizeModuleRunLabel(modulesCandidate);

  if (regressionCandidate && !isNoRegressionSentinel(regressionCandidate)) {
    return humanizeModuleRunLabel(regressionCandidate);
  }

  for (const k of keys) {
    const v = (params[k] || '').trim() || low.get(k.toLowerCase()) || '';
    if (v) return humanizeModuleRunLabel(v);
  }

  for (const [k, v] of Object.entries(params)) {
    if (!v?.trim()) continue;
    const kl = k.toLowerCase();
    if (heuristicSkipKey(kl)) continue;
    if (
      /\b(modules|module|suite|suites|profile|scope|regression|playwright|pytest|parallel|shard)\b/i.test(
        k
      )
    ) {
      return humanizeModuleRunLabel(v.trim());
    }
    if (
      /\bgrep\b|\btests?\b/i.test(k) &&
      /\b(run|suite|path|filter|set|group)\b/i.test(k)
    ) {
      return humanizeModuleRunLabel(v.trim());
    }
  }

  return '';
}

/** Path segments that are too generic to represent "module run" in the UI. */
const MODULE_RUN_IGNORE_SEGMENTS = new Set(
  [
    'user',
    'users',
    'test',
    'tests',
    'e2e',
    'spec',
    'specs',
    'integration',
    'ui',
    'ux',
    'src',
    'lib',
    'app',
    'apps',
    'shared',
    'common',
    'utils',
    'util',
    'helpers',
    'fixtures',
    'mocks',
    'pages',
    'components',
    'layouts',
    'coverage',
    'reports',
    'artifacts',
    'node_modules',
    '__tests__',
    '~',
    '.',
  ].map((s) => s.toLowerCase())
);

function moduleRunFromTests(tests: TestCaseResult[]): string {
  if (!tests?.length) return '';

  const weights = new Map<string, number>();

  for (const t of tests) {
    const raw = (t.className || '').trim().replace(/\\/g, '/');
    if (!raw) continue;

    if (raw.includes('/')) {
      const segments = raw.split('/').filter(Boolean);
      for (let depth = 0; depth < Math.min(4, segments.length); depth++) {
        const seg = segments[depth].replace(/\.[jt]sx?$/i, '');
        const low = seg.toLowerCase();
        if (!seg || MODULE_RUN_IGNORE_SEGMENTS.has(low)) continue;
        weights.set(seg, (weights.get(seg) ?? 0) + (4 - depth));
      }
      continue;
    }

    /*
     * Playwright often reports `tests.ROLE.suite.spec` — not Jenkins "Modules" (e.g. ALL_MODULES).
     * Skip dotted names that start like path roots; keep `com.*` / `org.*` for real Java packages.
     */
    if (raw.includes('.')) {
      const head = raw.split('.')[0]?.toLowerCase() ?? '';
      if (['tests', 'e2e', 'spec', 'specs', 'src'].includes(head)) {
        continue;
      }
      const withoutFinalClass = raw.slice(0, raw.lastIndexOf('.'));
      const segments = withoutFinalClass.split('.').filter(Boolean);
      const javaTld = new Set(['com', 'org', 'net', 'io', 'cz', 'dev']);
      let logicalDepth = 0;
      for (let i = 0; i < Math.min(segments.length, 6); i++) {
        const seg = segments[i].replace(/\.[jt]sx?$/i, '');
        const low = seg.toLowerCase();
        if (i === 0 && javaTld.has(low)) continue;
        if (!seg || MODULE_RUN_IGNORE_SEGMENTS.has(low)) continue;
        logicalDepth++;
        weights.set(seg, (weights.get(seg) ?? 0) + (5 - logicalDepth));
      }
      continue;
    }

    if (raw.length <= 48 && !MODULE_RUN_IGNORE_SEGMENTS.has(raw.toLowerCase())) {
      weights.set(raw, (weights.get(raw) ?? 0) + 1);
    }
  }

  if (weights.size > 0) {
    return [...weights.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 5)
      .map(([s]) => humanizeModuleRunLabel(s))
      .filter(Boolean)
      .join(', ');
  }

  return '';
}

export async function fetchBuildParameters(
  branch: string,
  buildNumber: number
): Promise<Record<string, string>> {
  return cachedFetch(`params:v4:${branch}:${buildNumber}`, CACHE_TTL * 6, async () => {
    if (USE_DEMO) return demo.getParams(branch, buildNumber);
    const client = getJenkinsClient();
    const res = await client.get(
      `/job/${encodeURIComponent(branch)}/${buildNumber}/api/json?tree=number,timestamp,result,actions[parameters[name,value]]`
    );

    const actions: JenkinsAction[] = res.data.actions || [];
    /** Jenkins can emit multiple `ParametersAction`s; merging finds params like `Modules` reliably. */
    const params: Record<string, string> = {};
    for (const action of actions) {
      if (!action?.parameters?.length) continue;
      for (const p of action.parameters) {
        const v = jenkinsParamValueToString(p.value);
        if (v) params[p.name] = v;
      }
    }
    return params;
  });
}

export async function fetchTestReport(
  branch: string,
  buildNumber: number
): Promise<TestCaseResult[]> {
  return cachedFetch(`tests:${branch}:${buildNumber}`, CACHE_TTL * 6, async () => {
    if (USE_DEMO) return demo.getTestReport(branch, buildNumber);
    const client = getJenkinsClient();
    try {
      const res = await client.get(
        `/job/${encodeURIComponent(branch)}/${buildNumber}/testReport/api/json?tree=suites[cases[name,status,errorDetails,duration,className]]`
      );

      const suites: JenkinsSuite[] = res.data.suites || [];
      return suites.flatMap((suite) =>
        suite.cases.map((c) => ({
          name: c.name,
          status: c.status,
          errorDetails: c.errorDetails,
          duration: c.duration,
          className: c.className,
          buildNumber,
          buildTimestamp: 0, // Will be filled by caller
        }))
      );
    } catch (error: any) {
      if (error.response?.status === 404) {
        return [];
      }
      throw error;
    }
  });
}

/**
 * Narrow how fetchFilteredBuilds restricts candidates (defaults preserve legacy behavior).
 */
export type FetchFilteredBuildsOpts = {
  /** Default true: exclude builds older than `days`. */
  enforceTimeCutoff?: boolean;
  /** Default true: when `testBranch` is non-empty, require Jenkins TEST_BRANCH match. */
  enforceTestBranchMatch?: boolean;
  /**
   * When true: drop builds whose parameters enable Jenkins stability-test mode (`STABILITY_TEST`, etc.).
   * Use for flaky / matrix aggregates so deliberate multi-run shakes do not inflate pass-fail churn.
   */
  excludeStabilityTestBuilds?: boolean;
  /**
   * When true: skip the per-build JUnit `testReport` HTTP call entirely.
   * `failedTestCount` / `totalTestCount` / `failedTestNames` will be 0 / `[]`.
   * Use for callers that only need build parameters (e.g. discovering DEV_BRANCH labels) —
   * the `testReport` tree is by far the heaviest Jenkins call per build.
   */
  skipTestReport?: boolean;
};

export async function fetchFilteredBuilds(
  branch: string,
  days: number,
  testBranch: string,
  devBranch: string,
  maxBuilds: number = 100,
  opts?: FetchFilteredBuildsOpts
): Promise<BuildInfo[]> {
  const enforceTime = opts?.enforceTimeCutoff !== false;
  const enforceTestBranch = opts?.enforceTestBranchMatch !== false;

  const excludeStabilityTest =
    opts?.excludeStabilityTestBuilds === true;

  const skipTestReport = opts?.skipTestReport === true;

  const cacheKey = `filtered:${branch}:${days}:${testBranch}:${devBranch}:${maxBuilds}:t:${enforceTime}:tb:${enforceTestBranch}:stab:${excludeStabilityTest ? 'ex' : 'in'}:tr:${skipTestReport ? 'skip' : 'full'}`;

  return cachedFetch(cacheKey, CACHE_TTL, async () => {
    const rawBuilds = await fetchBuilds(branch, maxBuilds);
    const cutoff = enforceTime ? Date.now() - days * 24 * 60 * 60 * 1000 : 0;

    // Filter by time (optional) and exclude running/aborted builds
    const validBuilds = rawBuilds.filter(
      (b) =>
        (!enforceTime || b.timestamp >= cutoff) &&
        b.result !== null &&
        b.result !== 'ABORTED'
    );

    // Fetch parameters for all builds in parallel (batched)
    const BATCH_SIZE = 10;
    const results: BuildInfo[] = [];

    for (let i = 0; i < validBuilds.length; i += BATCH_SIZE) {
      const batch = validBuilds.slice(i, i + BATCH_SIZE);
      const settled = await Promise.allSettled(
        batch.map(async (build) => {
          const params = await fetchBuildParameters(branch, build.number);

          if (excludeStabilityTest && isStabilityTestBuild(params)) {
            return null;
          }

          const buildTestBranch = params['TEST_BRANCH'] || '';
          const buildDevBranch = params['DEV_BRANCH'] || '';
          const buildDashboardStage = params['DASHBOARD_STAGE'] || '';

          if (
            enforceTestBranch &&
            testBranch &&
            buildTestBranch.toLowerCase() !== testBranch.toLowerCase()
          ) {
            return null;
          }
          // Smart Filtering: If target is "master", also include "qa" stages and commit hashes
          const isTargetingMaster = devBranch.toLowerCase() === "master";
          const isBuildHash = /^[a-f0-9]{40}$/.test(buildDevBranch) || /^[a-f0-9]{7,12}$/.test(buildDevBranch);
          const isBuildQA = buildDashboardStage.toLowerCase() === "qa";

          if (devBranch) {
            const matchesDirectly = buildDevBranch.toLowerCase() === devBranch.toLowerCase();
            const shouldIncludeInMaster = isTargetingMaster && (isBuildHash || isBuildQA);
            
            if (!matchesDirectly && !shouldIncludeInMaster) {
              return null;
            }
          }

          // Fetch test report to get failure counts and names (unless caller opted out).
          let tests: TestCaseResult[] = [];
          let failedTestCount = 0;
          let totalTestCount = 0;
          let failedTestNames: string[] = [];
          if (!skipTestReport) {
            try {
              tests = await fetchTestReport(branch, build.number);
              totalTestCount = tests.length;
              const failures = tests.filter(
                (t) => t.status !== 'PASSED' && t.status !== 'FIXED' && t.status !== 'SKIPPED'
              );
              failedTestCount = failures.length;
              failedTestNames = failures.map((t) => t.name);
            } catch {
              // Test reports may not exist
            }
          }

          const fromParams = moduleRunFromParams(params);
          const fromTests = moduleRunFromTests(tests);
          const moduleRun = finalizeModuleRunDisplay(fromParams || fromTests);

          return {
            buildNumber: build.number,
            timestamp: build.timestamp,
            result: build.result!,
            testBranch: buildTestBranch,
            devBranch: buildDevBranch,
            dashboardStage: buildDashboardStage,
            moduleRun,
            failedTestCount,
            totalTestCount,
            failedTestNames,
          } satisfies BuildInfo;
        })
      );

      for (const result of settled) {
        if (result.status === 'fulfilled' && result.value) {
          results.push(result.value);
        }
      }
    }

    return results.sort((a, b) => b.timestamp - a.timestamp);
  });
}

export async function fetchBuildByNumberOrBranch(
  branch: string,
  targetId: string // Can be a build number like "2043" or a DEV_BRANCH like "WE-1294..."
): Promise<BuildInfo | null> {
  const isBuildNumber = /^\d+$/.test(targetId);

  if (isBuildNumber) {
    const buildNum = parseInt(targetId, 10);

    if (USE_DEMO) {
      const raw = demo
        .getRawBuilds(branch, 100000)
        .find((b) => b.number === buildNum);
      if (!raw || !raw.result) return null;

      const params = await fetchBuildParameters(branch, buildNum);
      const tests = await fetchTestReport(branch, buildNum);
      const failures = tests.filter(
        (t) => t.status !== 'PASSED' && t.status !== 'FIXED' && t.status !== 'SKIPPED'
      );
      const fromParams = moduleRunFromParams(params);
      const fromTests = moduleRunFromTests(tests);
      const moduleRun = finalizeModuleRunDisplay(fromParams || fromTests);

      return {
        buildNumber: buildNum,
        timestamp: raw.timestamp,
        result: raw.result,
        testBranch: params['TEST_BRANCH'] || '',
        devBranch: params['DEV_BRANCH'] || '',
        dashboardStage: params['DASHBOARD_STAGE'] || '',
        moduleRun,
        failedTestCount: failures.length,
        totalTestCount: tests.length,
        failedTestNames: failures.map((t) => t.name),
      };
    }

    const client = getJenkinsClient();
    try {
      // Fast check if build exists and get basic info
      const res = await client.get(
        `/job/${encodeURIComponent(branch)}/${buildNum}/api/json?tree=number,timestamp,result`
      );
      if (!res.data.result) return null; // Running or invalid

      const raw = res.data;
      const params = await fetchBuildParameters(branch, buildNum);
      const testBranch = params['TEST_BRANCH'] || '';
      const devBranch = params['DEV_BRANCH'] || '';
      const dashboardStage = params['DASHBOARD_STAGE'] || '';
      
      let tests: TestCaseResult[] = [];
      let failedTestCount = 0;
      let totalTestCount = 0;
      let failedTestNames: string[] = [];
      try {
        tests = await fetchTestReport(branch, buildNum);
        totalTestCount = tests.length;
        const failures = tests.filter(
          (t) => t.status !== 'PASSED' && t.status !== 'FIXED' && t.status !== 'SKIPPED'
        );
        failedTestCount = failures.length;
        failedTestNames = failures.map((t) => t.name);
      } catch {}

      const fromParams = moduleRunFromParams(params);
      const fromTests = moduleRunFromTests(tests);
      const moduleRun = finalizeModuleRunDisplay(fromParams || fromTests);

      return {
        buildNumber: buildNum,
        timestamp: raw.timestamp,
        result: raw.result,
        testBranch,
        devBranch,
        dashboardStage,
        moduleRun,
        failedTestCount,
        totalTestCount,
        failedTestNames,
      };
    } catch {
      return null;
    }
  } else {
    // It's a DEV_BRANCH. Find the most recent build with this DEV_BRANCH (last 30 days)
    const recentBuilds = await fetchFilteredBuilds(branch, 30, "", targetId, 100);
    return recentBuilds.length > 0 ? recentBuilds[0] : null;
  }
}

function isLikelyGitSha(dev: string): boolean {
  const d = dev.trim().toLowerCase();
  return /^[a-f0-9]{40}$/.test(d) || /^[a-f0-9]{7,12}$/.test(d);
}

/**
 * Master-lineup builds: DEV_BRANCH literally "master", or QA timer/PR runs where
 * DEV_BRANCH is a commit hash (dashboard shows Environment: qa).
 */
function isMasterComparableBuild(b: BuildInfo): boolean {
  const d = (b.devBranch || '').trim();
  if (!d) return false;
  if (d.toLowerCase() === 'master') return true;
  if (
    isLikelyGitSha(d) &&
    (b.dashboardStage || '').trim().toLowerCase() === 'qa'
  ) {
    return true;
  }
  return false;
}

/** Single dropdown label per build (hashes under QA collapse to master). */
function canonicalDevBranchLabel(b: BuildInfo): string | null {
  if (isMasterComparableBuild(b)) return 'master';
  const raw = (b.devBranch || '').trim();
  return raw.length > 0 ? raw : null;
}

/** Canonical DEV_BRANCH options discovered from Jenkins (no TEST_BRANCH restriction, full scan depth). */
export async function fetchDistinctDevBranches(
  branch: string,
  maxBuilds: number = 250
): Promise<string[]> {
  /*
   * We only need DEV_BRANCH / DASHBOARD_STAGE parameters here — there's no reason
   * to fetch the full JUnit `testReport` tree for every build (the dominant cost).
   * `skipTestReport` cuts this endpoint from ~3–5 s to a few hundred ms cold.
   */
  const builds = await fetchFilteredBuilds(
    branch,
    0,
    '',
    '',
    maxBuilds,
    {
      enforceTimeCutoff: false,
      enforceTestBranchMatch: false,
      skipTestReport: true,
    }
  );
  const seen = new Set<string>();
  for (const b of builds) {
    const label = canonicalDevBranchLabel(b);
    if (label) seen.add(label);
  }
  return [...seen].sort((a, b) => {
    const am = a.toLowerCase() === 'master';
    const bm = b.toLowerCase() === 'master';
    if (am && !bm) return -1;
    if (bm && !am) return 1;
    return a.localeCompare(b, undefined, { sensitivity: 'base' });
  });
}

/**
 * Latest logical build for a canonical DEV_BRANCH in the Jenkins scan slice.
 * For `master`, uses master lineup + prefers latest FAILED/UNSTABLE/has failures.
 *
 * Ignores TEST_BRANCH filtering and ignores calendar-days (see scanned `maxBuilds`).
 */
export async function fetchLatestBuildForDevBranch(
  branch: string,
  devBranch: string,
  maxBuilds: number = 100
): Promise<BuildInfo | null> {
  const target = devBranch.trim();
  const targetLc = target.toLowerCase();
  const loose = {
    enforceTimeCutoff: false,
    enforceTestBranchMatch: false,
  };

  if (targetLc === 'master') {
    const all = await fetchFilteredBuilds(
      branch,
      0,
      '',
      '',
      maxBuilds,
      loose
    );
    const pool = all
      .filter(isMasterComparableBuild)
      .sort((a, b) => b.timestamp - a.timestamp);
    if (pool.length === 0) return null;

    const failed = pool.find(
      (b) =>
        b.result === 'FAILURE' ||
        b.result === 'UNSTABLE' ||
        (typeof b.failedTestCount === 'number' && b.failedTestCount > 0)
    );
    return failed ?? pool[0] ?? null;
  }

  const builds = await fetchFilteredBuilds(
    branch,
    0,
    '',
    target,
    maxBuilds,
    loose
  );
  return builds[0] ?? null;
}

/** All builds matching canonical DEV_BRANCH in the newest Jenkins `maxBuilds` slice (no TEST_BRANCH / calendar filter). */
export async function fetchBuildsForCanonicalDev(
  branch: string,
  canonicalDev: string,
  maxBuilds: number = 600
): Promise<BuildInfo[]> {
  const target = canonicalDev.trim();
  const loose = {
    enforceTimeCutoff: false,
    enforceTestBranchMatch: false,
  };

  if (target.toLowerCase() === 'master') {
    const all = await fetchFilteredBuilds(
      branch,
      0,
      '',
      '',
      maxBuilds,
      loose
    );
    return all
      .filter(isMasterComparableBuild)
      /* Compare history for master: only builds with at least one failed test in the JUnit report */
      .filter((b) => (b.failedTestCount ?? 0) > 0)
      .sort((a, b) => b.timestamp - a.timestamp);
  }
  return fetchFilteredBuilds(branch, 0, '', target, maxBuilds, loose);
}

export async function resolveBuildInCanonicalDevPool(
  branch: string,
  canonicalDev: string,
  buildNumber: number,
  maxBuilds: number = 600
): Promise<BuildInfo | null> {
  const pool = await fetchBuildsForCanonicalDev(branch, canonicalDev, maxBuilds);
  return pool.find((b) => b.buildNumber === buildNumber) ?? null;
}