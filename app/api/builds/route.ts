import { NextRequest, NextResponse } from 'next/server';
import { fetchFilteredBuilds } from '@/lib/jenkins';
import { BuildsApiResponse } from '@/lib/types';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const branch = searchParams.get('branch') || 'master';
  const days = parseInt(searchParams.get('days') || '7', 10);
  const testBranch = searchParams.get('testBranch') || 'master';
  const devBranch = searchParams.get('devBranch') || 'master';

  try {
    const builds = await fetchFilteredBuilds(
      branch,
      days,
      testBranch,
      devBranch
    );

    const response: BuildsApiResponse = {
      builds,
      meta: {
        branch,
        days,
        testBranch,
        devBranch,
        totalFetched: builds.length,
        totalFiltered: builds.length,
      },
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Jenkins API Error:', error.response?.data || error.message);
    return NextResponse.json(
      { error: 'Failed to fetch builds from Jenkins' },
      { status: 500 }
    );
  }
}
