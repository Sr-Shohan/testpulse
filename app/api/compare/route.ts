import { NextRequest, NextResponse } from "next/server";
import {
  fetchFilteredBuilds,
  fetchTestReport,
  fetchBuildByNumberOrBranch,
} from "@/lib/jenkins";
import { CompareApiResponse, CompareFailure } from "@/lib/types";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const branch = searchParams.get("branch") || "master";
  const targetId = searchParams.get("targetId"); // e.g., "2043" or "WE-1294..."
  const baselineDevBranch = searchParams.get("baselineDevBranch") || "master";
  const days = parseInt(searchParams.get("days") || "7", 10);

  if (!targetId) {
    return NextResponse.json(
      { error: "targetId is required" },
      { status: 400 }
    );
  }

  try {
    // 1. Resolve Target Build
    const targetBuild = await fetchBuildByNumberOrBranch(branch, targetId);
    if (!targetBuild) {
      return NextResponse.json(
        { error: `Could not find valid build for target: ${targetId}` },
        { status: 404 }
      );
    }

    // Fetch target test results
    const targetTests = await fetchTestReport(branch, targetBuild.buildNumber);
    const targetFailures = targetTests.filter(
      (t) => t.status !== "PASSED" && t.status !== "FIXED" && t.status !== "SKIPPED"
    );

    // 2. Resolve Baseline Builds
    const baselineBuilds = await fetchFilteredBuilds(
      branch,
      days,
      "", // No explicit testBranch filter; assume we want to compare against standard baseline
      baselineDevBranch,
      50 // Max 50 baseline builds to keep it fast
    );

    // Fetch test results for all baseline builds
    const baselineTestMap = new Map<number, any[]>();
    await Promise.all(
      baselineBuilds.map(async (b) => {
        try {
          const tests = await fetchTestReport(branch, b.buildNumber);
          baselineTestMap.set(b.buildNumber, tests);
        } catch {
          baselineTestMap.set(b.buildNumber, []);
        }
      })
    );

    // 3. Compare Logic
    const failures: CompareFailure[] = [];

    for (const failedTest of targetFailures) {
      let failedInBaseline = false;
      const baselineErrorsForTest: string[] = [];

      for (const bBuild of baselineBuilds) {
        const bTests = baselineTestMap.get(bBuild.buildNumber) || [];
        const matchingBaselineTest = bTests.find((t) => t.name === failedTest.name);

        if (
          matchingBaselineTest &&
          matchingBaselineTest.status !== "PASSED" &&
          matchingBaselineTest.status !== "FIXED" &&
          matchingBaselineTest.status !== "SKIPPED"
        ) {
          failedInBaseline = true;
          if (matchingBaselineTest.errorDetails) {
            baselineErrorsForTest.push(matchingBaselineTest.errorDetails);
          }
        }
      }

      // Determine category
      let category: CompareFailure["category"] = "PRE_EXISTING";

      if (!failedInBaseline) {
        category = "NEW_FAILURE";
      } else {
        // Did the error message substantially change?
        // We'll compare the first 80 characters (Error Type + Start of message)
        const targetErrSig = (failedTest.errorDetails || "").substring(0, 80);
        
        // If ALL baseline errors have a different signature, it's a new error
        const hasMatchingBaselineError = baselineErrorsForTest.some((err) =>
          err.substring(0, 80) === targetErrSig
        );

        if (!hasMatchingBaselineError && targetErrSig.length > 0) {
          category = "NEW_ERROR";
        }
      }

      failures.push({
        testName: failedTest.name,
        category,
        targetError: failedTest.errorDetails,
        targetDuration: failedTest.duration,
        baselineErrors: [...new Set(baselineErrorsForTest)], // Deduplicate
      });
    }

    const response: CompareApiResponse = {
      targetBuild,
      baselineBuildsAnalyzed: baselineBuilds.length,
      failures,
      meta: {
        targetId,
        baselineDevBranch,
        days,
      },
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Compare API Error:", error.response?.data || error.message);
    return NextResponse.json(
      { error: "Failed to compare builds" },
      { status: 500 }
    );
  }
}
