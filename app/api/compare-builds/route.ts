import { NextRequest, NextResponse } from 'next/server';
import {
  fetchLatestBuildForDevBranch,
  fetchTestReport,
  resolveBuildInCanonicalDevPool,
} from '@/lib/jenkins';
import { COMPARE_PAGE_JENKINS_BUILD_FETCH_LIMIT } from '@/app/compare/constants';
import {
  CompareBuildsApiResponse,
  FailedTestDetail,
  CompareBuildsBothFailed,
  TestCaseResult,
  BuildInfo,
} from '@/lib/types';

function isFailed(t: TestCaseResult): boolean {
  return (
    t.status !== 'PASSED' &&
    t.status !== 'FIXED' &&
    t.status !== 'SKIPPED'
  );
}

function isMasterDevLabel(dev: string): boolean {
  return dev.trim().toLowerCase() === 'master';
}

function dedupeInts(nums: number[]): number[] {
  return [...new Set(nums.filter((n) => Number.isFinite(n)))];
}

function parsePin(v: string | null): number | null {
  if (v == null || v.trim() === '') return null;
  const n = parseInt(v.trim(), 10);
  return Number.isFinite(n) ? n : null;
}

/** Comma-separated build numbers from `leftBuilds=1,2,3` */
function parseLeftBuildIdsParam(raw: string | null): number[] | null {
  if (raw == null || raw.trim() === '') return null;
  const nums = raw
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n));
  return nums.length ? dedupeInts(nums) : null;
}

function toDetail(t: TestCaseResult): FailedTestDetail {
  return {
    testName: t.name,
    className: t.className,
    errorDetails: t.errorDetails,
    duration: t.duration,
  };
}

/**
 * Union of failing tests across runs: first win by newest build (by build number)
 * so error text comes from the most recent failure.
 */
function unionFailedTestsFromRuns(
  runs: Array<{ buildNumber: number; tests: TestCaseResult[] }>
): TestCaseResult[] {
  const sorted = [...runs].sort((a, b) => b.buildNumber - a.buildNumber);
  const byName = new Map<string, TestCaseResult>();
  for (const { tests } of sorted) {
    for (const t of tests) {
      if (!isFailed(t)) continue;
      if (!byName.has(t.name)) {
        byName.set(t.name, t);
      }
    }
  }
  return [...byName.values()];
}

function buildComparePayload(
  branch: string,
  scannedBuildCap: number,
  compareMode: CompareBuildsApiResponse['meta']['compareMode'],
  leftBuild: BuildInfo,
  rightBuild: BuildInfo,
  leftTests: TestCaseResult[],
  rightTests: TestCaseResult[],
  leftAggregatedBuildNumbers?: number[]
): CompareBuildsApiResponse {
  const leftFailed = leftTests.filter(isFailed);
  const rightFailed = rightTests.filter(isFailed);
  const leftMap = new Map(leftFailed.map((t) => [t.name, t]));
  const rightMap = new Map(rightFailed.map((t) => [t.name, t]));
  const leftNames = new Set(leftMap.keys());
  const rightNamesSet = new Set(rightMap.keys());

  const leftNamesArr = [...leftNames];
  const bothFailed: CompareBuildsBothFailed[] = leftNamesArr
    .filter((n) => rightNamesSet.has(n))
    .map((testName) => {
      const l = leftMap.get(testName)!;
      const r = rightMap.get(testName)!;
      return {
        testName,
        className: l.className || r.className,
        leftError: l.errorDetails,
        rightError: r.errorDetails,
      };
    });

  const leftOnly = leftNamesArr
    .filter((n) => !rightNamesSet.has(n))
    .map((n) => toDetail(leftMap.get(n)!));

  const rightOnlyArr = [...rightNamesSet].filter((n) => !leftNames.has(n));
  const rightOnly = rightOnlyArr.map((n) => toDetail(rightMap.get(n)!));

  const agg =
    leftAggregatedBuildNumbers && leftAggregatedBuildNumbers.length > 1
      ? [...leftAggregatedBuildNumbers].sort((a, b) => b - a)
      : undefined;

  return {
    meta: { branch, scannedBuildCap, compareMode },
    left: {
      devBranch: leftBuild.devBranch,
      buildNumber: leftBuild.buildNumber,
      timestamp: leftBuild.timestamp,
      result: leftBuild.result,
      failedCount: leftFailed.length,
      ...(agg ? { aggregatedFromBuildNumbers: agg } : {}),
    },
    right: {
      devBranch: rightBuild.devBranch,
      buildNumber: rightBuild.buildNumber,
      timestamp: rightBuild.timestamp,
      result: rightBuild.result,
      failedCount: rightFailed.length,
    },
    leftFailures: leftFailed.map(toDetail),
    rightFailures: rightFailed.map(toDetail),
    leftOnly,
    rightOnly,
    bothFailed,
  };
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const branch = sp.get('branch') || 'master';
  const leftDev = sp.get('leftDev');
  const rightDev = sp.get('rightDev');
  const scannedCap = COMPARE_PAGE_JENKINS_BUILD_FETCH_LIMIT;

  if (!leftDev?.trim() || !rightDev?.trim()) {
    return NextResponse.json(
      { error: 'leftDev and rightDev query parameters are required' },
      { status: 400 }
    );
  }

  const lDev = leftDev.trim();
  const rDev = rightDev.trim();
  const sameCanonical = lDev.toLowerCase() === rDev.toLowerCase();

  const leftBuildParam = sp.get('leftBuild');
  const rightBuildParam = sp.get('rightBuild');
  const leftPinned = parsePin(leftBuildParam);
  const rightPinned = parsePin(rightBuildParam);
  const leftBuildsFromParam = parseLeftBuildIdsParam(sp.get('leftBuilds'));

  try {
    // ── Same DEV_BRANCH: exactly two distinct single builds (no multi-left) ──
    if (sameCanonical) {
      if (leftBuildsFromParam && leftBuildsFromParam.length > 0) {
        return NextResponse.json(
          {
            error:
              'For the same DEV_BRANCH on both sides, use leftBuild and rightBuild only (no leftBuilds list).',
          },
          { status: 400 }
        );
      }
      if (leftPinned === null || rightPinned === null) {
        return NextResponse.json(
          {
            error:
              'When both sides use the same DEV_BRANCH, choose two build numbers (leftBuild & rightBuild).',
          },
          { status: 400 }
        );
      }
      if (leftPinned === rightPinned) {
        return NextResponse.json(
          {
            error: 'You cannot select the same build for comparison.',
          },
          { status: 400 }
        );
      }

      const [leftB, rightB] = await Promise.all([
        resolveBuildInCanonicalDevPool(branch, lDev, leftPinned, scannedCap),
        resolveBuildInCanonicalDevPool(branch, rDev, rightPinned, scannedCap),
      ]);

      if (!leftB) {
        return NextResponse.json(
          {
            error: `Build #${leftPinned} is not in the last ${scannedCap} Jenkins runs for DEV_BRANCH "${lDev}" (folder: ${branch}).`,
          },
          { status: 404 }
        );
      }
      if (!rightB) {
        return NextResponse.json(
          {
            error: `Build #${rightPinned} is not in the last ${scannedCap} Jenkins runs for DEV_BRANCH "${rDev}" (folder: ${branch}).`,
          },
          { status: 404 }
        );
      }

      const [leftTests, rightTests] = await Promise.all([
        fetchTestReport(branch, leftB.buildNumber),
        fetchTestReport(branch, rightB.buildNumber),
      ]);

      return NextResponse.json(
        buildComparePayload(
          branch,
          scannedCap,
          'pinned-builds',
          leftB,
          rightB,
          leftTests,
          rightTests,
          undefined
        )
      );
    }

    // ── Different DEV_BRANCH：explicit pins (single or aggregated master baseline on left) ──
    const leftIdsList =
      leftBuildsFromParam && leftBuildsFromParam.length > 0
        ? leftBuildsFromParam
        : leftPinned !== null
          ? [leftPinned]
          : [];

    if (leftIdsList.length >= 1 && rightPinned !== null) {
      if (leftIdsList.length > 1 && !isMasterDevLabel(lDev)) {
        return NextResponse.json(
          {
            error:
              'Multiple builds on the left are only supported when left DEV_BRANCH is master (combined baseline).',
          },
          { status: 400 }
        );
      }

      const missingLeft: number[] = [];
      const leftResolvedMap = new Map<number, BuildInfo>();
      await Promise.all(
        leftIdsList.map(async (num) => {
          const b = await resolveBuildInCanonicalDevPool(
            branch,
            lDev,
            num,
            scannedCap
          );
          if (!b) missingLeft.push(num);
          else leftResolvedMap.set(num, b);
        })
      );

      if (missingLeft.length > 0) {
        return NextResponse.json(
          {
            error: `Unknown left build number(s): ${missingLeft.sort((a, b) => b - a).join(', ')} — not found in the last ${scannedCap} Jenkins runs for DEV_BRANCH "${lDev}".`,
          },
          { status: 404 }
        );
      }

      const rightB = await resolveBuildInCanonicalDevPool(
        branch,
        rDev,
        rightPinned,
        scannedCap
      );
      if (!rightB) {
        return NextResponse.json(
          {
            error: `Build #${rightPinned} is not in the last ${scannedCap} Jenkins runs for DEV_BRANCH "${rDev}" (folder: ${branch}).`,
          },
          { status: 404 }
        );
      }

      const leftSorted = [...leftResolvedMap.keys()].sort((a, b) => b - a);
      const leftReports = await Promise.all(
        leftSorted.map((num) =>
          fetchTestReport(branch, num).then((tests) => ({
            buildNumber: num,
            tests,
          }))
        )
      );

      const unionLeftTests = unionFailedTestsFromRuns(leftReports);
      const rightTests = await fetchTestReport(branch, rightB.buildNumber);

      const anchorLeft = leftResolvedMap.get(leftSorted[0])!;
      const mode: CompareBuildsApiResponse['meta']['compareMode'] =
        leftSorted.length > 1 ? 'aggregated-master-baseline' : 'pinned-builds';

      return NextResponse.json(
        buildComparePayload(
          branch,
          scannedCap,
          mode,
          anchorLeft,
          rightB,
          unionLeftTests,
          rightTests,
          leftSorted.length > 1 ? leftSorted : undefined
        )
      );
    }

    // ── Different DEV_BRANCH: latest per branch (no explicit pins) ──
    const [leftBuild, rightBuild] = await Promise.all([
      fetchLatestBuildForDevBranch(branch, lDev, scannedCap),
      fetchLatestBuildForDevBranch(branch, rDev, scannedCap),
    ]);

    if (!leftBuild) {
      return NextResponse.json(
        {
          error: `No build found for DEV_BRANCH "${lDev}" within the last ${scannedCap} Jenkins runs (job folder: ${branch}).`,
        },
        { status: 404 }
      );
    }
    if (!rightBuild) {
      return NextResponse.json(
        {
          error: `No build found for DEV_BRANCH "${rDev}" within the last ${scannedCap} Jenkins runs (job folder: ${branch}).`,
        },
        { status: 404 }
      );
    }

    const [leftTests, rightTests] = await Promise.all([
      fetchTestReport(branch, leftBuild.buildNumber),
      fetchTestReport(branch, rightBuild.buildNumber),
    ]);

    return NextResponse.json(
      buildComparePayload(
        branch,
        scannedCap,
        'latest-per-branch',
        leftBuild,
        rightBuild,
        leftTests,
        rightTests,
        undefined
      )
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('compare-builds:', message);
    return NextResponse.json(
      { error: 'Failed to compare builds' },
      { status: 500 }
    );
  }
}
