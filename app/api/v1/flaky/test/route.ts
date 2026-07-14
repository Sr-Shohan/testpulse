import { GET as flakyTestGet } from "@/app/api/flaky/test/route";

/**
 * Public re-export of /api/flaky/test.
 *
 * Build history and failure pattern for a single test, identified by its
 * full name.
 *
 * Query params:
 *  - test        full test name (alias: name)   (required)
 *  - branch      Jenkins job folder             (default "master")
 *  - days        look-back window in days       (default 7)
 *  - testBranch  TEST_BRANCH filter             (default "master")
 *  - devBranch   DEV_BRANCH filter              (default "master")
 *
 * Response shape: `TestHistoryApiResponse` from `lib/types.ts`.
 * Returns 404 with `suggestions` when the test name isn't found.
 */
export const GET = flakyTestGet;
