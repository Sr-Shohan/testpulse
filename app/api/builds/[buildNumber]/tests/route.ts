import { NextResponse } from 'next/server';
import { fetchTestReport } from '@/lib/jenkins';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ buildNumber: string }> }
) {
  const { buildNumber } = await params;
  const branch = new URL(request.url).searchParams.get('branch') || 'master';

  try {
    const cases = await fetchTestReport(branch, parseInt(buildNumber, 10));
    return NextResponse.json(cases);
  } catch (error: any) {
    if (error.response?.status === 404) {
      return NextResponse.json([]);
    }
    console.error(
      `Error fetching test report for build ${buildNumber}:`,
      error.message
    );
    return NextResponse.json(
      { error: 'Failed to fetch test report' },
      { status: 500 }
    );
  }
}
