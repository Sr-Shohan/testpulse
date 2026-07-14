/** Jenkins multibranch child job folder used by the compare page APIs. */
export const COMPARE_PAGE_JOB_FOLDER = "master";

/**
 * Jenkins tree API returns only the *newest* `N` runs for this job folder.
 * Real calendar span depends on how busy the pipeline is — there is no Jenkins
 * parameter for “true” unlimited history without pagination.
 * Raise this if DEV_BRANCH builds fall off the tail.
 */
export const COMPARE_PAGE_JENKINS_BUILD_FETCH_LIMIT = 600;

/** Compare page — build history tables show this many newest rows first; use “Show more” for the rest. */
export const COMPARE_BRANCH_HISTORY_TABLE_PAGE_SIZE = 10;
