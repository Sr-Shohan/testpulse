import { GET as compareBuildsGet } from "@/app/api/compare-builds/route";

/**
 * Public re-export of /api/compare-builds.
 *
 * Compares two specific builds (left vs right). Supports three modes:
 *  - latest-per-branch        (default — no leftBuild/rightBuild given)
 *  - pinned-builds            (explicit leftBuild & rightBuild)
 *  - aggregated-master-baseline (multiple leftBuilds, only when leftDev=master)
 */
export const GET = compareBuildsGet;
