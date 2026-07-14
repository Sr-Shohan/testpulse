import { NextRequest, NextResponse } from 'next/server';
import { fetchBuildsForCanonicalDev } from '@/lib/jenkins';
import { COMPARE_PAGE_JENKINS_BUILD_FETCH_LIMIT } from '@/app/compare/constants';
import type { CompareBranchHistoryApiResponse } from '@/lib/types';

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const branch = sp.get('branch') || 'master';
  const devBranch = sp.get('devBranch');

  if (!devBranch?.trim()) {
    return NextResponse.json(
      { error: 'devBranch query parameter is required' },
      { status: 400 }
    );
  }

  const cap = COMPARE_PAGE_JENKINS_BUILD_FETCH_LIMIT;

  try {
    const raw = await fetchBuildsForCanonicalDev(
      branch,
      devBranch.trim(),
      cap
    );

    const builds = raw.map((b) => ({
      buildNumber: b.buildNumber,
      timestamp: b.timestamp,
      result: b.result,
      failedTestCount: b.failedTestCount,
      totalTestCount: b.totalTestCount,
      dashboardStage: b.dashboardStage || '',
      moduleRun: (b.moduleRun || '').trim() || '',
      devBranch: b.devBranch || '',
      testBranch: b.testBranch || '',
    }));

    const body: CompareBranchHistoryApiResponse = {
      builds,
      meta: {
        branch,
        devBranch: devBranch.trim(),
        scannedBuildCap: cap,
      },
    };

    return NextResponse.json(body);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('compare-branch-history:', message);
    return NextResponse.json(
      { error: 'Failed to load build history' },
      { status: 500 }
    );
  }
}
