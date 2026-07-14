import { NextResponse } from 'next/server';
import { fetchBranches } from '@/lib/jenkins';

export async function GET() {
  try {
    const branches = await fetchBranches();
    return NextResponse.json(branches);
  } catch (error: any) {
    console.error('Error fetching branches:', error.message);
    return NextResponse.json(
      { error: 'Failed to fetch branches from Jenkins' },
      { status: 500 }
    );
  }
}
