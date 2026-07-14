import { NextRequest, NextResponse } from 'next/server';
import {
  fetchFilteredBuilds,
  fetchTestReport,
  cachedFetch,
} from '@/lib/jenkins';
import {
  FlakyTestData,
  FlakyApiResponse,
  FlakyApiResponseSlim,
  DashboardSummary,
  TestCaseResult,
} from '@/lib/types';

/** Cap concurrency so we don't open hundreds of sockets to Jenkins at once. */
async function mapWithConcurrency<I, O>(
  items: readonly I[],
  concurrency: number,
  worker: (item: I, index: number) => Promise<O>
): Promise<O[]> {
  const results: O[] = new Array(items.length);
  let cursor = 0;
  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (true) {
        const i = cursor++;
        if (i >= items.length) return;
        results[i] = await worker(items[i], i);
      }
    }
  );
  await Promise.all(runners);
  return results;
}

const MAX_TOP = 50;

function parseTop(raw: string | null): number | null {
  if (raw == null || raw.trim() === '') return null;
  const n = parseInt(raw.trim(), 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(n, MAX_TOP);
}

/** Slim API response: top-N flaky tests only, no build list or per-test history. */
function applyTopLimit(result: FlakyApiResponse, top: number): FlakyApiResponseSlim {
  const trimError = (msg: string) =>
    msg.length > 200 ? `${msg.slice(0, 200)}…` : msg;

  const tests: FlakyTestData[] = result.tests
    .filter((t) => t.isFlaky)
    .sort((a, b) => b.flakyScore - a.flakyScore)
    .slice(0, top)
    .map((t) => ({
      ...t,
      history: [],
      failureTimestamps: [],
      errorMessages: t.errorMessages.slice(0, 2).map(trimError),
    }));

  return {
    tests,
    summary: {
      ...result.summary,
      // `tests` already holds the top-N list — skip duplicating it here.
      topFlakyTests: [],
    },
    meta: { ...result.meta, top },
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const branch = searchParams.get('branch') || 'master';
  const days = parseInt(searchParams.get('days') || '7', 10);
  const testBranch = searchParams.get('testBranch') || 'master';
  const devBranch = searchParams.get('devBranch') || 'master';
  const topParam = searchParams.get('top');
  const top = parseTop(topParam);

  if (topParam != null && topParam.trim() !== '' && top === null) {
    return NextResponse.json(
      { error: `top must be a positive integer (max ${MAX_TOP}).` },
      { status: 400 }
    );
  }

  const cacheKey = `flaky:${branch}:${days}:${testBranch}:${devBranch}`;

  try {
    const result = await cachedFetch<FlakyApiResponse>(
      cacheKey,
      5 * 60 * 1000,
      async () => {
        // 1. Get filtered builds
        const builds = await fetchFilteredBuilds(
          branch,
          days,
          testBranch,
          devBranch,
          100,
          { excludeStabilityTestBuilds: true }
        );

        // 2. Fetch test reports for all builds
        const testMap = new Map<
          string,
          {
            totalRuns: number;
            failureCount: number;
            passCount: number;
            failureTimestamps: number[];
            errorMessages: string[];
            history: Array<{
              buildNumber: number;
              timestamp: number;
              status: string;
              errorDetails: string | null;
            }>;
          }
        >();

        let totalTests = 0;
        let totalFailures = 0;

        /*
         * Fetch all test reports in parallel (capped concurrency).
         * The previous serial `for (const build of builds) { await … }`
         * was the dominant cost on cold cache: 50–100 builds × ~100 ms
         * per Jenkins call ≈ 5–10 s. With 8-way concurrency this drops
         * to under a second on a warm Jenkins.
         */
        const reports = await mapWithConcurrency(
          builds,
          8,
          async (build) => {
            try {
              const tests = await fetchTestReport(branch, build.buildNumber);
              return { build, tests };
            } catch (err) {
              console.error(
                `Skipping test report for build ${build.buildNumber}:`,
                err
              );
              return { build, tests: [] as TestCaseResult[] };
            }
          }
        );

        for (const { build, tests } of reports) {
          for (const test of tests) {
            const key = test.name;
            if (!testMap.has(key)) {
              testMap.set(key, {
                totalRuns: 0,
                failureCount: 0,
                passCount: 0,
                failureTimestamps: [],
                errorMessages: [],
                history: [],
              });
            }

            const entry = testMap.get(key)!;
            entry.totalRuns++;
            totalTests++;

            const isFailed =
              test.status !== 'PASSED' &&
              test.status !== 'FIXED' &&
              test.status !== 'SKIPPED';

            if (isFailed) {
              entry.failureCount++;
              totalFailures++;
              entry.failureTimestamps.push(build.timestamp);
              if (
                test.errorDetails &&
                !entry.errorMessages.includes(test.errorDetails)
              ) {
                entry.errorMessages.push(test.errorDetails);
              }
            } else if (test.status === 'PASSED' || test.status === 'FIXED') {
              entry.passCount++;
            }

            entry.history.push({
              buildNumber: build.buildNumber,
              timestamp: build.timestamp,
              status: test.status,
              errorDetails: test.errorDetails,
            });
          }
        }

        // 3. Calculate flaky scores
        const flakyTests: FlakyTestData[] = [];

        for (const [testName, data] of testMap.entries()) {
          const flakyScore =
            data.totalRuns > 0 ? data.failureCount / data.totalRuns : 0;

          // Sort history by timestamp descending
          data.history.sort((a, b) => b.timestamp - a.timestamp);

          // Calculate consecutive failures/passes from most recent
          let consecutiveFailures = 0;
          for (const h of data.history) {
            if (
              h.status !== 'PASSED' &&
              h.status !== 'FIXED' &&
              h.status !== 'SKIPPED'
            ) {
              consecutiveFailures++;
            } else {
              break;
            }
          }

          let consecutivePasses = 0;
          for (const h of data.history) {
            if (h.status === 'PASSED' || h.status === 'FIXED') {
              consecutivePasses++;
            } else {
              break;
            }
          }

          const isFlaky =
            data.failureCount > 0 &&
            data.passCount > 0 &&
            flakyScore >= 0.1 &&
            flakyScore <= 0.8;

          /*
           * Tests that never failed in the analyzed window are never
           * rendered individually (every page filters by `failureCount > 0`
           * before showing rows). Dropping their per-build history shaves
           * the bulk of the JSON payload while keeping summary counts
           * (totalTests, alwaysPassing, etc.) intact.
           */
          const history = data.failureCount > 0 ? data.history : [];

          const testData: FlakyTestData = {
            testName,
            totalRuns: data.totalRuns,
            failureCount: data.failureCount,
            passCount: data.passCount,
            flakyScore,
            failureTimestamps: data.failureTimestamps,
            lastFailedAt:
              data.failureTimestamps.length > 0
                ? Math.max(...data.failureTimestamps)
                : null,
            errorMessages: data.errorMessages.slice(0, 5), // Limit to 5 unique errors
            consecutiveFailures,
            consecutivePasses,
            isFlaky,
            history,
          };

          flakyTests.push(testData);
        }

        // Sort by flaky score descending
        flakyTests.sort((a, b) => b.flakyScore - a.flakyScore);

        const topFlaky = flakyTests
          .filter((t) => t.isFlaky)
          .slice(0, 10);

        const successCount = builds.filter((b) => b.result === 'SUCCESS').length;
        const successRate = builds.length > 0 ? Math.round((successCount / builds.length) * 100) : 0;
        const alwaysFailingCount = flakyTests.filter((t) => t.flakyScore > 0.8 && t.totalRuns >= 3).length;

        const summary: DashboardSummary = {
          totalBuilds: builds.length,
          totalTests: testMap.size,
          totalFailures,
          successRate,
          alwaysFailingCount,
          flakyTestCount: flakyTests.filter((t) => t.isFlaky).length,
          topFlakyTests: topFlaky,
        };

        return {
          tests: flakyTests,
          builds,
          summary,
          meta: {
            branch,
            days,
            testBranch,
            devBranch,
            buildsAnalyzed: builds.length,
            cachedAt: Date.now(),
          },
        };
      }
    );

    return NextResponse.json(top != null ? applyTopLimit(result, top) : result);
  } catch (error: any) {
    console.error('Flaky analysis error:', error.message);
    return NextResponse.json(
      { error: 'Failed to compute flaky test analysis' },
      { status: 500 }
    );
  }
}
