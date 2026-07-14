import { NextRequest, NextResponse } from 'next/server';
import {
  fetchFilteredBuilds,
  fetchTestReport,
  cachedFetch,
} from '@/lib/jenkins';
import {
  TestHistoryApiResponse,
  TestHistoryPoint,
  TestCaseResult,
} from '@/lib/types';

const MAX_BUILDS = 100;
const SUGGESTION_LIMIT = 8;

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

function isPassed(status: string): boolean {
  return status === 'PASSED' || status === 'FIXED';
}

function isSkipped(status: string): boolean {
  return status === 'SKIPPED' || status === 'NOT_RUN';
}

/** Build "did you mean" suggestions when the exact test name isn't found. */
function suggestNames(query: string, allNames: Set<string>): string[] {
  const q = query.toLowerCase();
  const scored: Array<{ name: string; score: number }> = [];
  for (const name of allNames) {
    const n = name.toLowerCase();
    if (n === q) continue;
    let score = 0;
    if (n.includes(q) || q.includes(n)) score = 3;
    else {
      // Loose token overlap on word boundaries (_, ., spaces).
      const qTokens = new Set(q.split(/[._\s]+/).filter(Boolean));
      const nTokens = n.split(/[._\s]+/).filter(Boolean);
      const overlap = nTokens.filter((t) => qTokens.has(t)).length;
      if (overlap > 0) score = overlap;
    }
    if (score > 0) scored.push({ name, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, SUGGESTION_LIMIT)
    .map((s) => s.name);
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const rawTest = (sp.get('test') ?? sp.get('name') ?? '').trim();
  const branch = sp.get('branch') || 'master';
  const days = parseInt(sp.get('days') || '7', 10);
  const testBranch = sp.get('testBranch') || 'master';
  const devBranch = sp.get('devBranch') || 'master';

  if (!rawTest) {
    return NextResponse.json(
      { error: 'test query parameter is required (the full test name).' },
      { status: 400 }
    );
  }

  const cacheKey = `testhist:${branch}:${days}:${testBranch}:${devBranch}:${rawTest.toLowerCase()}`;

  try {
    const result = await cachedFetch<
      | { ok: true; body: TestHistoryApiResponse }
      | { ok: false; suggestions: string[]; buildsAnalyzed: number }
    >(cacheKey, 5 * 60 * 1000, async () => {
      const builds = await fetchFilteredBuilds(
        branch,
        days,
        testBranch,
        devBranch,
        MAX_BUILDS,
        { excludeStabilityTestBuilds: true }
      );

      const reports = await mapWithConcurrency(builds, 8, async (build) => {
        let tests: TestCaseResult[] = [];
        try {
          tests = await fetchTestReport(branch, build.buildNumber);
        } catch {
          tests = [];
        }
        return { build, tests };
      });

      const queryLc = rawTest.toLowerCase();
      const allNames = new Set<string>();
      const history: TestHistoryPoint[] = [];
      let matchedName = rawTest;
      const errorMessages: string[] = [];

      for (const { build, tests } of reports) {
        for (const t of tests) {
          allNames.add(t.name);
          if (t.name.toLowerCase() !== queryLc) continue;

          matchedName = t.name; // preserve the real casing
          history.push({
            buildNumber: build.buildNumber,
            timestamp: build.timestamp,
            status: t.status,
            errorDetails: t.errorDetails,
            devBranch: build.devBranch || '',
          });
          if (
            t.errorDetails &&
            !errorMessages.includes(t.errorDetails) &&
            !isPassed(t.status) &&
            !isSkipped(t.status)
          ) {
            errorMessages.push(t.errorDetails);
          }
        }
      }

      if (history.length === 0) {
        return {
          ok: false as const,
          suggestions: suggestNames(rawTest, allNames),
          buildsAnalyzed: builds.length,
        };
      }

      // Newest first.
      history.sort((a, b) => b.timestamp - a.timestamp);

      let failureCount = 0;
      let passCount = 0;
      let skippedCount = 0;
      let lastFailedAt: number | null = null;
      for (const h of history) {
        if (isSkipped(h.status)) {
          skippedCount++;
        } else if (isPassed(h.status)) {
          passCount++;
        } else {
          failureCount++;
          if (lastFailedAt === null || h.timestamp > lastFailedAt) {
            lastFailedAt = h.timestamp;
          }
        }
      }

      const totalRuns = history.length;
      const flakyScore = totalRuns > 0 ? failureCount / totalRuns : 0;
      const isFlaky =
        failureCount > 0 &&
        passCount > 0 &&
        flakyScore >= 0.1 &&
        flakyScore <= 0.8;

      let consecutiveFailures = 0;
      for (const h of history) {
        if (!isPassed(h.status) && !isSkipped(h.status)) consecutiveFailures++;
        else break;
      }

      let consecutivePasses = 0;
      for (const h of history) {
        if (isPassed(h.status)) consecutivePasses++;
        else break;
      }

      const body: TestHistoryApiResponse = {
        testName: matchedName,
        totalRuns,
        failureCount,
        passCount,
        skippedCount,
        flakyScore,
        isFlaky,
        consecutiveFailures,
        consecutivePasses,
        firstSeenAt: history[history.length - 1]?.timestamp ?? null,
        lastRunAt: history[0]?.timestamp ?? null,
        lastFailedAt,
        errorMessages: errorMessages.slice(0, 5),
        history,
        meta: {
          branch,
          days,
          testBranch,
          devBranch,
          query: rawTest,
          buildsAnalyzed: builds.length,
          cachedAt: Date.now(),
        },
      };

      return { ok: true as const, body };
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          error: `No runs found for test "${rawTest}" in the last ${days} day(s) on branch "${branch}".`,
          suggestions: result.suggestions,
          meta: { branch, days, testBranch, devBranch, buildsAnalyzed: result.buildsAnalyzed },
        },
        { status: 404 }
      );
    }

    return NextResponse.json(result.body);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('flaky/test:', message);
    return NextResponse.json(
      { error: 'Failed to compute test history' },
      { status: 500 }
    );
  }
}
