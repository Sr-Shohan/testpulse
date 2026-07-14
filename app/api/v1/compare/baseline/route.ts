import { GET as compareGet } from "@/app/api/compare/route";

/**
 * Public re-export of /api/compare.
 *
 * Compares one target build (by id or branch name) against a baseline
 * window of recent builds on `baselineDevBranch`. Each failure is
 * categorized as NEW_FAILURE | NEW_ERROR | PRE_EXISTING.
 */
export const GET = compareGet;
