import { NextRequest, NextResponse } from 'next/server';
import { fetchDistinctDevBranches } from '@/lib/jenkins';
import { COMPARE_PAGE_JENKINS_BUILD_FETCH_LIMIT } from '@/app/compare/constants';

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const branch = sp.get('branch') || 'master';

  try {
    const devBranches = await fetchDistinctDevBranches(
      branch,
      COMPARE_PAGE_JENKINS_BUILD_FETCH_LIMIT
    );
    return NextResponse.json({
      devBranches,
      meta: {
        branch,
        scannedBuildCap: COMPARE_PAGE_JENKINS_BUILD_FETCH_LIMIT,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('dev-branches:', message);
    return NextResponse.json(
      { error: 'Failed to fetch DEV_BRANCH list from Jenkins' },
      { status: 500 }
    );
  }
}
