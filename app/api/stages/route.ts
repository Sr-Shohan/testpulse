import { NextRequest, NextResponse } from 'next/server';
import { fetchBuilds, fetchBuildParameters, cachedFetch } from '@/lib/jenkins';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const branch = searchParams.get('branch') || 'master';
  
  // Cache the detected stages for an hour to keep the UI fast
  const cacheKey = `stages:${branch}`;

  try {
    const stages = await cachedFetch<string[]>(
      cacheKey,
      60 * 60 * 1000, // 1 hour TTL
      async () => {
        // Fetch the last 150 builds to get a good sampling of environments run recently
        const rawBuilds = await fetchBuilds(branch, 150);
        
        const uniqueStages = new Set<string>();

        // We fetch parameters in parallel batches to speed it up
        const BATCH_SIZE = 20;
        for (let i = 0; i < rawBuilds.length; i += BATCH_SIZE) {
          const batch = rawBuilds.slice(i, i + BATCH_SIZE);
          await Promise.all(
            batch.map(async (build) => {
              try {
                const params = await fetchBuildParameters(branch, build.number);
                const stage = params['DASHBOARD_STAGE'];
                if (stage && typeof stage === 'string' && stage.trim() !== '') {
                  uniqueStages.add(stage.toLowerCase().trim());
                }
              } catch (err) {
                // Ignore parameter fetching errors for individual builds
              }
            })
          );
        }

        return Array.from(uniqueStages).sort();
      }
    );

    return NextResponse.json({ stages });
  } catch (error: any) {
    console.error('API Stages Error:', error.message);
    return NextResponse.json(
      { error: 'Failed to auto-detect environments' },
      { status: 500 }
    );
  }
}
