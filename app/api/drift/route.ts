import { NextRequest, NextResponse } from 'next/server';
import { fetchBuilds, fetchBuildParameters, fetchTestReport, cachedFetch } from '@/lib/jenkins';
import { DriftApiResponse, DriftTest } from '@/lib/types';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const branch = searchParams.get('branch') || 'master';
  const targetStage = searchParams.get('targetStage');
  const baselineStage = searchParams.get('baselineStage') || 'qa';
  const days = parseInt(searchParams.get('days') || '7', 10);

  if (!targetStage || !baselineStage) {
    return NextResponse.json({ error: 'targetStage and baselineStage are required' }, { status: 400 });
  }

  const cacheKey = `drift:${branch}:${days}:${targetStage}:${baselineStage}`;

  try {
    const result = await cachedFetch<DriftApiResponse>(
      cacheKey,
      5 * 60 * 1000,
      async () => {
        const maxBuilds = 300; // Large pool to find enough builds for both stages
        const rawBuilds = await fetchBuilds(branch, maxBuilds);
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

        const validBuilds = rawBuilds.filter(b => b.timestamp >= cutoff && b.result !== null && b.result !== 'ABORTED');

        const targetBuilds: number[] = [];
        const baselineBuilds: number[] = [];

        const BATCH_SIZE = 20;
        for (let i = 0; i < validBuilds.length; i += BATCH_SIZE) {
          const batch = validBuilds.slice(i, i + BATCH_SIZE);
          await Promise.all(batch.map(async (b) => {
            try {
              const params = await fetchBuildParameters(branch, b.number);
              const stage = (params['DASHBOARD_STAGE'] || '').toLowerCase().trim();
              
              if (stage === targetStage.toLowerCase().trim()) {
                targetBuilds.push(b.number);
              } else if (stage === baselineStage.toLowerCase().trim()) {
                baselineBuilds.push(b.number);
              }
            } catch (e) {}
          }));
        }

        const baselineTests = new Map<string, { runs: number, passes: number, errors: string[] }>();
        const targetTests = new Map<string, { runs: number, passes: number, errors: string[] }>();

        const processBuilds = async (buildNumbers: number[], map: Map<string, { runs: number, passes: number, errors: string[] }>) => {
          for (const num of buildNumbers) {
            try {
              const tests = await fetchTestReport(branch, num);
              for (const t of tests) {
                if (!map.has(t.name)) map.set(t.name, { runs: 0, passes: 0, errors: [] });
                const entry = map.get(t.name)!;
                if (t.status === 'PASSED' || t.status === 'FIXED') {
                  entry.runs++;
                  entry.passes++;
                } else if (t.status !== 'SKIPPED' && t.status !== 'NOT_RUN') {
                  entry.runs++;
                  if (t.errorDetails && !entry.errors.includes(t.errorDetails)) {
                     entry.errors.push(t.errorDetails);
                  }
                }
              }
            } catch (e) {}
          }
        };

        // These can run in parallel since they process different build sets into different maps
        await Promise.all([
           processBuilds(baselineBuilds, baselineTests),
           processBuilds(targetBuilds, targetTests)
        ]);

        const driftedTests: DriftTest[] = [];
        
        for (const [testName, targetData] of targetTests.entries()) {
           if (targetData.runs > 0 && targetData.passes < targetData.runs) {
              const targetPassRate = targetData.passes / targetData.runs;
              const baselineData = baselineTests.get(testName);
              
              if (baselineData && baselineData.runs > 0) {
                 const baselinePassRate = baselineData.passes / baselineData.runs;
                 const driftScore = baselinePassRate - targetPassRate;
                 
                 // Drift means baseline is more stable than the target
                 if (driftScore >= 0.1) {
                   driftedTests.push({
                     testName,
                     baselinePassRate,
                     targetPassRate,
                     driftScore,
                     baselineRuns: baselineData.runs,
                     targetRuns: targetData.runs,
                     baselineErrors: baselineData.errors.slice(0, 3) || [],
                     targetErrors: targetData.errors.slice(0, 3) || []
                   });
                 }
              }
           }
        }

        driftedTests.sort((a,b) => b.driftScore - a.driftScore);

        return {
           driftedTests,
           baselineBuildCount: baselineBuilds.length,
           targetBuildCount: targetBuilds.length,
           meta: {
             targetStage,
             baselineStage,
             days
           }
        };
      }
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Drift API Error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate environment drift' },
      { status: 500 }
    );
  }
}
