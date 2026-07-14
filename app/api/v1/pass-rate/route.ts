import { GET as passRateGet } from "@/app/api/pass-rate/route";

/**
 * Public re-export of /api/pass-rate.
 *
 * Returns build-level and test-level pass rates for one or more trailing
 * day windows.
 *
 * Query params:
 *  - branch      Jenkins job folder            (default "master")
 *  - testBranch  TEST_BRANCH filter            (default "master")
 *  - devBranch   DEV_BRANCH filter             (default "master")
 *  - windows     comma-separated day windows,  e.g. windows=3,7,15
 *                (alias: days)                 (default "3,7,15,30")
 *
 * Response shape: `PassRateApiResponse` from `lib/types.ts`.
 */
export const GET = passRateGet;
