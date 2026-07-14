import { NextResponse } from "next/server";
import { fetchTestReport } from "@/lib/jenkins";
import type { TestCaseResult } from "@/lib/types";

interface FailedTestSummary {
  testName: string;
  className?: string;
  errorDetails: string | null;
  duration?: number;
}

interface BuildSummaryResponse {
  buildNumber: number;
  branch: string;
  totalTests: number;
  passedCount: number;
  failedCount: number;
  skippedCount: number;
  failedTests: FailedTestSummary[];
}

function isFailed(t: TestCaseResult) {
  return t.status !== "PASSED" && t.status !== "FIXED" && t.status !== "SKIPPED";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ buildNumber: string }> }
) {
  const { buildNumber: raw } = await params;
  const branch = new URL(request.url).searchParams.get("branch") || "master";

  const buildNumber = parseInt(raw, 10);
  if (!Number.isFinite(buildNumber)) {
    return NextResponse.json(
      { error: "buildNumber must be a positive integer." },
      { status: 400 }
    );
  }

  try {
    const cases = await fetchTestReport(branch, buildNumber);
    const failed = cases.filter(isFailed);
    const passed = cases.filter(
      (t) => t.status === "PASSED" || t.status === "FIXED"
    );
    const skipped = cases.filter((t) => t.status === "SKIPPED");

    const body: BuildSummaryResponse = {
      buildNumber,
      branch,
      totalTests: cases.length,
      passedCount: passed.length,
      failedCount: failed.length,
      skippedCount: skipped.length,
      failedTests: failed.map((t) => ({
        testName: t.name,
        className: t.className,
        errorDetails: t.errorDetails,
        duration: t.duration,
      })),
    };

    return NextResponse.json(body);
  } catch (error: unknown) {
    const err = error as { response?: { status?: number }; message?: string };
    if (err.response?.status === 404) {
      return NextResponse.json(
        { error: `No test report found for build #${buildNumber} on branch "${branch}".` },
        { status: 404 }
      );
    }
    console.error(
      `v1/builds/${buildNumber}:`,
      err.message ?? "unknown error"
    );
    return NextResponse.json(
      { error: "Failed to fetch test report" },
      { status: 500 }
    );
  }
}
