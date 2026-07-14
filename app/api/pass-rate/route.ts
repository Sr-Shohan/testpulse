import { NextRequest, NextResponse } from 'next/server';
import { fetchFilteredBuilds, cachedFetch } from '@/lib/jenkins';
import { PassRateApiResponse, PassRateWindow } from '@/lib/types';

/** Pool size scanned from Jenkins; large enough to cover a 30+ day window. */
const MAX_BUILDS = 150;
const DEFAULT_WINDOWS = [3, 7, 15, 30];

/** Parse `windows=3,7,15` (or fall back to `days=N`); de-duped, positive, sorted asc. */
function parseWindows(sp: URLSearchParams): number[] {
  const raw = sp.get('windows') ?? sp.get('days');
  if (!raw?.trim()) return DEFAULT_WINDOWS;

  const parsed = raw
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);

  const unique = [...new Set(parsed)].sort((a, b) => a - b);
  return unique.length ? unique : DEFAULT_WINDOWS;
}

function pct(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0;
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const branch = sp.get('branch') || 'master';
  const testBranch = sp.get('testBranch') || 'master';
  const devBranch = sp.get('devBranch') || 'master';
  const windows = parseWindows(sp);
  const maxDays = windows[windows.length - 1];

  const cacheKey = `passrate:${branch}:${testBranch}:${devBranch}:${windows.join('-')}`;

  try {
    const result = await cachedFetch<PassRateApiResponse>(
      cacheKey,
      5 * 60 * 1000,
      async () => {
        // Fetch the largest window once; smaller windows are timestamp slices of it.
        const builds = await fetchFilteredBuilds(
          branch,
          maxDays,
          testBranch,
          devBranch,
          MAX_BUILDS,
          { excludeStabilityTestBuilds: true }
        );

        const now = Date.now();
        const windowResults: PassRateWindow[] = windows.map((days) => {
          const since = now - days * 24 * 60 * 60 * 1000;
          const inWindow = builds.filter((b) => b.timestamp >= since);

          let success = 0;
          let failure = 0;
          let unstable = 0;
          let other = 0;

          for (const b of inWindow) {
            switch (b.result) {
              case 'SUCCESS':
                success++;
                break;
              case 'FAILURE':
                failure++;
                break;
              case 'UNSTABLE':
                unstable++;
                break;
              default:
                other++;
            }
          }

          return {
            days,
            since,
            total: inWindow.length,
            success,
            failure,
            unstable,
            other,
            passRate: pct(success, inWindow.length),
          };
        });

        return {
          windows: windowResults,
          meta: {
            branch,
            testBranch,
            devBranch,
            windows,
            buildsAnalyzed: builds.length,
            generatedAt: now,
          },
        };
      }
    );

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('pass-rate:', message);
    return NextResponse.json(
      { error: 'Failed to compute pass rate' },
      { status: 500 }
    );
  }
}
