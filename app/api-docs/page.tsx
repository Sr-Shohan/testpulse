import type { Metadata } from "next";
import { headers } from "next/headers";
import { BookOpen, Bot, Shield } from "lucide-react";
import EndpointCard from "@/components/docs/EndpointCard";
import CodeBlock from "@/components/docs/CodeBlock";
import TocSidebar, { type TocEntry } from "@/components/docs/TocSidebar";

export const metadata: Metadata = {
  title: "API Docs | TestPulse",
  description:
    "Read-only REST API for the TestPulse dashboard — flaky tests, build history, and build-vs-build comparison for Slack bots and CI gates.",
};

// Reading the request host opts this page into dynamic rendering, which is
// what we want — the docs URL should always reflect whatever host the user
// is browsing (localhost, staging, prod) without any configuration.
export const dynamic = "force-dynamic";

/** Resolve the public base URL for this deployment from request headers. */
async function resolveBaseUrl(): Promise<string> {
  const h = await headers();
  const host =
    h.get("x-forwarded-host") ??
    h.get("host") ??
    "testpulse.vercel.app";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");
  return `${proto}://${host}/api/v1`;
}

// ─── Table of contents (kept in sync with section ids below) ──────────

const TOC: TocEntry[] = [
  { id: "overview", label: "1. Overview" },
  { id: "base-url", label: "2. Base URL & versioning" },
  { id: "auth", label: "3. Authentication" },
  {
    id: "endpoints",
    label: "4. Endpoints",
    children: [
      { id: "endpoint-health", label: "4.1 Health" },
      { id: "endpoint-flaky", label: "4.2 Flaky tests" },
      { id: "endpoint-test-history", label: "4.3 Test history" },
      { id: "endpoint-pass-rate", label: "4.4 Pass rate" },
      { id: "endpoint-compare-baseline", label: "4.5 Compare vs. baseline" },
      { id: "endpoint-compare-builds", label: "4.6 Compare two builds" },
    ],
  },
  { id: "errors", label: "5. Common errors" },
  { id: "recipes", label: "6. Recipes" },
  { id: "changelog", label: "7. Changelog" },
];

// ─── Code samples (typed inline for clarity) ──────────────────────────

function buildExamples(BASE: string) {
  return {
  health: {
    request: `${BASE}/health`,
    response: `{
  "status": "ok",
  "uptimeMs": 1234567,
  "version": "0.1.0",
  "api": "v1"
}`,
  },
  flaky: {
    request: `# Default: top 10 flaky tests (top is optional on v1)
${BASE}/flaky?days=7

# Override the limit
${BASE}/flaky?days=7&top=5`,
    response: `{
  "summary": {
    "totalBuilds": 84,
    "successRate": 92,
    "flakyTestCount": 7,
    "alwaysFailingCount": 1,
    "topFlakyTests": [
      {
        "testName": "AdServerBuilderTest.shouldRetry",
        "flakyScore": 0.42,
        "failureCount": 7,
        "totalRuns": 17,
        "isFlaky": true,
        "lastFailedAt": 1755800000000
      }
    ]
  },
  "tests": [
    {
      "testName": "AdServerBuilderTest.shouldRetry",
      "flakyScore": 0.42,
      "failureCount": 7,
      "passCount": 10,
      "totalRuns": 17,
      "isFlaky": true,
      "consecutiveFailures": 0,
      "consecutivePasses": 3,
      "lastFailedAt": 1755800000000,
      "errorMessages": ["java.lang.AssertionError: ..."],
      "history": []
    }
  ],
  "meta": {
    "branch": "master",
    "days": 7,
    "buildsAnalyzed": 84,
    "cachedAt": 1755823000000,
    "top": 10
  }
}`,
  },
  builds: {
    request: `${BASE}/builds?branch=master&days=7`,
    response: `{
  "builds": [
    {
      "buildNumber": 2043,
      "timestamp": 1755800000000,
      "result": "SUCCESS",
      "testBranch": "master",
      "devBranch": "master",
      "failedTestCount": 0,
      "totalTestCount": 412
    }
  ],
  "meta": {
    "branch": "master",
    "days": 7,
    "totalFetched": 84,
    "totalFiltered": 84
  }
}`,
  },
  passRate: {
    request: `# Default windows (3, 7, 15, 30 days) for master
${BASE}/pass-rate

# Custom windows
${BASE}/pass-rate?windows=3,7,15

# Single window via the days alias
${BASE}/pass-rate?days=7`,
    response: `{
  "windows": [
    { "days": 3,  "since": 1781091611194, "total": 11, "success": 3,  "failure": 3, "unstable": 5,  "other": 0, "passRate": 27.3 },
    { "days": 7,  "since": 1780746011194, "total": 23, "success": 9,  "failure": 4, "unstable": 10, "other": 0, "passRate": 39.1 },
    { "days": 15, "since": 1780054811194, "total": 52, "success": 24, "failure": 4, "unstable": 24, "other": 0, "passRate": 46.2 }
  ],
  "meta": {
    "branch": "master",
    "testBranch": "master",
    "devBranch": "master",
    "windows": [3, 7, 15],
    "buildsAnalyzed": 52,
    "generatedAt": 1781350811194
  }
}`,
  },
  testHistory: {
    request: `${BASE}/flaky/test?test=test_regression_report_widgets_permission_enabled&days=15`,
    response: `{
  "testName": "test_regression_report_widgets_permission_enabled",
  "totalRuns": 23,
  "failureCount": 6,
  "passCount": 17,
  "skippedCount": 0,
  "flakyScore": 0.26,
  "isFlaky": true,
  "consecutiveFailures": 6,
  "consecutivePasses": 0,
  "firstSeenAt": 1780284048216,
  "lastRunAt": 1781247884891,
  "lastFailedAt": 1781247884891,
  "errorMessages": [
    "AssertionError: Report download failed: False should be True"
  ],
  "history": [
    {
      "buildNumber": 2494,
      "timestamp": 1781247884891,
      "status": "FAILED",
      "errorDetails": "AssertionError: Report download failed: False should be True",
      "devBranch": "master"
    },
    {
      "buildNumber": 2486,
      "timestamp": 1781234412341,
      "status": "PASSED",
      "errorDetails": null,
      "devBranch": "master"
    }
  ],
  "meta": {
    "branch": "master",
    "days": 15,
    "testBranch": "master",
    "devBranch": "master",
    "query": "test_regression_report_widgets_permission_enabled",
    "buildsAnalyzed": 52,
    "cachedAt": 1781350811194
  }
}`,
  },
  testHistoryNotFound: {
    request: `${BASE}/flaky/test?test=test_regression_report_widgets&days=15`,
    response: `{
  "error": "No runs found for test \\"test_regression_report_widgets\\" in the last 15 day(s) on branch \\"master\\".",
  "suggestions": [
    "test_regression_report_widgets_permission_enabled",
    "test_regression_report_widgets_permission_disabled",
    "test_regression_report_custom_widgets_validation"
  ],
  "meta": { "branch": "master", "days": 15, "testBranch": "master", "devBranch": "master", "buildsAnalyzed": 52 }
}`,
  },
  buildById: {
    request: `${BASE}/builds/2043?branch=master`,
    response: `{
  "buildNumber": 2043,
  "branch": "master",
  "totalTests": 412,
  "passedCount": 409,
  "failedCount": 3,
  "skippedCount": 0,
  "failedTests": [
    {
      "testName": "CheckoutFlowTest.shouldHandleTimeout",
      "className": "com.acme.shop.checkout.CheckoutFlowTest",
      "errorDetails": "java.lang.AssertionError: expected 200 but was 504...",
      "duration": 12.4
    }
  ]
}`,
  },
  compareBaseline: {
    request: `${BASE}/compare/baseline?targetId=2043&baselineDevBranch=master&days=7`,
    response: `{
  "targetBuild": {
    "buildNumber": 2043,
    "result": "FAILURE",
    "devBranch": "feature/BID-617",
    "failedTestCount": 5
  },
  "baselineBuildsAnalyzed": 24,
  "failures": [
    {
      "testName": "BidderConfigTest.shouldReloadOnChange",
      "category": "NEW_FAILURE",
      "targetError": "java.lang.NullPointerException: at BidderConfigTest.java:182",
      "baselineErrors": []
    },
    {
      "testName": "CheckoutFlowTest.shouldHandleTimeout",
      "category": "NEW_ERROR",
      "targetError": "AssertionError: expected 200 but was 504",
      "baselineErrors": ["AssertionError: expected 200 but was 503"]
    },
    {
      "testName": "MetricsExporterTest.flakyClock",
      "category": "PRE_EXISTING",
      "targetError": "timeout after 30s",
      "baselineErrors": ["timeout after 30s"]
    }
  ],
  "meta": {
    "targetId": "2043",
    "baselineDevBranch": "master",
    "days": 7
  }
}`,
  },
  compareBuilds: {
    request: `# Two specific builds on the same branch
${BASE}/compare/builds?leftDev=master&rightDev=master&leftBuild=1900&rightBuild=2043

# Latest of feature branch vs. latest of master
${BASE}/compare/builds?leftDev=master&rightDev=feature/foo

# Aggregated master baseline (multiple builds) vs. one feature build
${BASE}/compare/builds?leftDev=master&rightDev=feature/bar&leftBuilds=1900,1920,1950&rightBuild=2050`,
    response: `{
  "meta": {
    "branch": "master",
    "scannedBuildCap": 100,
    "compareMode": "pinned-builds"
  },
  "left":  { "devBranch": "master", "buildNumber": 1900, "result": "FAILURE", "failedCount": 5 },
  "right": { "devBranch": "master", "buildNumber": 2043, "result": "FAILURE", "failedCount": 7 },
  "leftOnly":   [ { "testName": "OldFlakyTest.someCase", "errorDetails": "..." } ],
  "rightOnly":  [ { "testName": "NewRegressionTest.shouldNotFail", "errorDetails": "..." } ],
  "bothFailed": [ { "testName": "StubbornFailure.alwaysBroken", "leftError": "...", "rightError": "..." } ]
}`,
  },
  recipes: {
    slack: `// Slack bot — post a message when a build introduces new regressions
import fetch from "node-fetch";

const BASE = "${BASE}";

export async function postRegressionsForBuild(buildId, postToSlack) {
  const res = await fetch(
    \`\${BASE}/compare/baseline?targetId=\${buildId}&baselineDevBranch=master&days=7\`
  );
  const data = await res.json();
  const newOnes = data.failures.filter(f => f.category === "NEW_FAILURE");

  if (newOnes.length === 0) {
    return postToSlack(\`✅ build #\${buildId}: no new regressions\`);
  }
  const lines = newOnes.slice(0, 10).map(f => \`• \${f.testName}\`).join("\\n");
  return postToSlack(
    \`❌ build #\${buildId} introduced \${newOnes.length} new regression(s):\\n\${lines}\`
  );
}`,
    ciGate: `# CI gate — fail the build on new regressions only
FAIL_COUNT=$(
  curl -fsS "${BASE}/compare/baseline?targetId=\${BUILD_NUMBER}&baselineDevBranch=master&days=7" \\
  | jq '[.failures[] | select(.category=="NEW_FAILURE")] | length'
)

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo "❌ Build introduced $FAIL_COUNT new regression(s) — failing the gate."
  exit 1
fi
echo "✅ No new regressions."`,
    flakyDigest: `# Daily flaky count digest
COUNT=$(curl -fsS "${BASE}/flaky?days=1" | jq '.summary.flakyTestCount')
echo "Flaky tests in the last 24h: $COUNT"`,
    passRateTrend: `# Pass-rate trend digest — 7-day master pass rate
RATE=$(curl -fsS "${BASE}/pass-rate?windows=7" | jq '.windows[0].passRate')
echo "Master build pass rate (last 7 days): \${RATE}%"`,
    testStreak: `# Alert if a specific test is currently on a failing streak
TEST="test_regression_report_widgets_permission_enabled"
STREAK=$(curl -fsS "${BASE}/flaky/test?test=\${TEST}&days=15" | jq '.consecutiveFailures')
if [ "\$STREAK" -ge 3 ]; then
  echo "🔴 \${TEST} has failed \${STREAK} runs in a row"
fi`,
  },
  };
}

// ─── Page ─────────────────────────────────────────────────────────────

export default async function ApiDocsPage() {
  const BASE = await resolveBaseUrl();
  const examples = buildExamples(BASE);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-8">
      {/* Sidebar (desktop) */}
      <aside className="hidden lg:block">
        <TocSidebar entries={TOC} />
      </aside>

      <main className="space-y-8 min-w-0">
        {/* ── Hero ─────────────────────────────────────────────────── */}
        <header className="glass-card p-6 sm:p-8 space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-blue-500">
            <BookOpen className="w-3.5 h-3.5" />
            API · v1
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-100">
            TestPulse API
          </h1>
          <p className="text-sm sm:text-base text-slate-400 leading-relaxed max-w-3xl">
            A read-only REST API exposing the same flaky-test, build-history,
            and comparison data you see in this dashboard. Designed for Slack
            bots, CI gates, and any internal automation that needs structured
            QA telemetry.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-700/60 bg-slate-800/60 px-2 py-1 text-[11px] font-medium text-slate-300">
              <Shield className="w-3 h-3 text-emerald-500" /> Read-only
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-700/60 bg-slate-800/60 px-2 py-1 text-[11px] font-medium text-slate-300">
              <Bot className="w-3 h-3 text-blue-500" /> Bot-friendly JSON
            </span>
          </div>
        </header>

        {/* ── 1. Overview ──────────────────────────────────────────── */}
        <section id="overview" className="glass-card p-5 sm:p-6 space-y-3 scroll-mt-24">
          <h2 className="text-xl font-semibold text-slate-100">1. Overview</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            The TestPulse API is a thin, read-only wrapper over the same data
            Jenkins reports to the dashboard. Endpoints accept query parameters,
            return JSON, and require no authentication. Common use cases:
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm text-slate-400">
            <li>Slack bot posting a summary of new regressions per build.</li>
            <li>Jenkins post-build step that fails the gate on new failures.</li>
            <li>Embedding flaky-test counts in another team&apos;s dashboard.</li>
            <li>Daily digest of test stability sent to a channel.</li>
          </ul>
        </section>

        {/* ── 2. Base URL ─────────────────────────────────────────── */}
        <section id="base-url" className="glass-card p-5 sm:p-6 space-y-3 scroll-mt-24">
          <h2 className="text-xl font-semibold text-slate-100">2. Base URL &amp; versioning</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            All endpoints are under a versioned prefix so we can evolve them
            without breaking consumers. <code className="font-mono text-blue-500">v1</code>{" "}
            is the current stable surface; additive changes (new fields, new
            endpoints) ship within v1, breaking changes would graduate to{" "}
            <code className="font-mono text-blue-500">v2</code>.
          </p>
          <CodeBlock label="Base URL" language="text" code={BASE} />
        </section>

        {/* ── 3. Auth ─────────────────────────────────────────────── */}
        <section id="auth" className="glass-card p-5 sm:p-6 space-y-3 scroll-mt-24">
          <h2 className="text-xl font-semibold text-slate-100">3. Authentication</h2>

          <div className="rounded-lg border border-blue-500/40 bg-blue-500/10 p-4 text-sm text-slate-300 leading-relaxed">
            <strong className="text-blue-400">Public demo.</strong>{" "}
            This deployment serves a built-in, synthetic dataset — no login, no
            VPN, and no real CI credentials are required. Point it at a real
            Jenkins later by setting <code className="font-mono text-blue-500">DATA_SOURCE=jenkins</code>.
          </div>

          <p className="text-sm text-slate-400 leading-relaxed">
            <strong className="text-slate-200">No API keys or permissions.</strong>{" "}
            There is nothing to sign up for, no tokens, and no role-based access
            to configure. The API returns the same QA telemetry the dashboard
            shows.
          </p>

          <p className="text-sm text-slate-400 leading-relaxed">
            <strong className="text-slate-200">GET only.</strong> Every endpoint
            is read-only. There are{" "}
            <strong className="text-slate-100">no POST, PUT, PATCH, or DELETE</strong>{" "}
            routes — you cannot create, update, or delete anything through this
            API.
          </p>

          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-slate-400 leading-relaxed">
            <strong className="text-amber-500">Note:</strong> error stack
            traces are surfaced verbatim from Jenkins. If your tests log
            secrets, those will appear here. Scrub at the source.
          </div>
        </section>

        {/* ── 4. Endpoints ────────────────────────────────────────── */}
        <section id="endpoints" className="space-y-6 scroll-mt-24">
          <h2 className="text-xl font-semibold text-slate-100 px-1">4. Endpoints</h2>

          <EndpointCard
            id="endpoint-health"
            index="4.1"
            title="Health"
            description="Liveness probe — confirms the API process is up and reports its version."
            method="GET"
            path={`${BASE}/health`}
            example={examples.health}
          />

          <EndpointCard
            id="endpoint-flaky"
            index="4.2"
            title="Flaky tests"
            description="Finds unstable tests over a time window — tests that sometimes pass and sometimes fail. Returns the top 10 flaky tests by default; use flaky/test to inspect one test in detail."
            method="GET"
            path={`${BASE}/flaky?days=7`}
            params={[
              { name: "top", type: "int", defaultValue: "10", description: "Return only the top N flaky tests (e.g. 5, 7, 20). Default 10. Omits the build list and per-test history. Max 50." },
              { name: "days", type: "int", defaultValue: "7", description: "Look-back window in days." },
            ]}
            example={examples.flaky}
            notes={
              <>
                <p className="mb-2 font-medium text-slate-300">How it works</p>
                <ol className="list-decimal list-inside space-y-1.5 mb-3">
                  <li>
                    Pulls Jenkins builds for the last{" "}
                    <code className="font-mono">days</code> window (master job
                    by default). Stability-test shake runs are excluded.
                  </li>
                  <li>
                    Fetches each build&apos;s test report (up to 100 builds, 8
                    Jenkins calls in parallel) and groups results by test name.
                  </li>
                  <li>
                    Computes per-test stats:{" "}
                    <code className="font-mono">flakyScore = failureCount / totalRuns</code>.
                    A test is <code className="font-mono">isFlaky</code> when it
                    has both passes and failures and the score is between{" "}
                    <code className="font-mono">0.1</code> and{" "}
                    <code className="font-mono">0.8</code>. Score &gt;{" "}
                    <code className="font-mono">0.8</code> counts as always failing.
                  </li>
                  <li>
                    Results are cached server-side for <strong>5 minutes</strong>{" "}
                    (same cache key for all <code className="font-mono">top</code>{" "}
                    values). The first call may take several seconds; repeat calls
                    within 5 min are fast.
                  </li>
                  <li>
                    When <code className="font-mono">top=N</code> is used (default{" "}
                    <code className="font-mono">10</code> on this public endpoint),
                    the full analysis still runs — only the JSON response is trimmed to
                    the worst N flaky tests (no build list, no per-test history,
                    short error snippets). Use{" "}
                    <code className="font-mono">flaky/test</code> to drill into
                    one test.
                  </li>
                </ol>
                <p>
                  <strong className="text-slate-200">Tip:</strong> omit{" "}
                  <code className="font-mono">top</code> to get the default 10, or
                  set <code className="font-mono">top=5</code> /{" "}
                  <code className="font-mono">top=20</code> as needed.
                </p>
              </>
            }
          />

          <EndpointCard
            id="endpoint-test-history"
            index="4.3"
            title="Test history"
            description={
              <>
                Build history and failure pattern for a{" "}
                <strong className="text-slate-200">single test</strong>,
                identified by its full name. Returns every run (newest first)
                with status and error detail, plus pass/fail counters,{" "}
                <code className="font-mono">flakyScore</code>, and
                consecutive-streak metrics — the per-test drill-down behind the
                flaky list.
              </>
            }
            method="GET"
            path={`${BASE}/flaky/test?test=test_regression_report_widgets_permission_enabled&days=15`}
            params={[
              { name: "test", type: "string", required: true, description: "Full test name (case-insensitive). Alias: name." },
              { name: "days", type: "int", defaultValue: "7", description: "Look-back window in days." },
            ]}
            example={examples.testHistory}
            notes={
              <>
                <code className="font-mono">flakyScore</code> is{" "}
                <code className="font-mono">failureCount / totalRuns</code>{" "}
                (matching the flaky list), and{" "}
                <code className="font-mono">isFlaky</code> is true when the
                score sits between <code className="font-mono">0.1</code> and{" "}
                <code className="font-mono">0.8</code> with both passes and
                failures present.{" "}
                <code className="font-mono">consecutiveFailures</code> /{" "}
                <code className="font-mono">consecutivePasses</code> count back
                from the most recent run. If the name isn&apos;t found the API
                returns <code className="font-mono text-rose-500">404</code>{" "}
                with a <code className="font-mono">suggestions</code> list of
                the closest test names:
                <CodeBlock
                  language="json"
                  code={examples.testHistoryNotFound.response}
                />
              </>
            }
          />

          <EndpointCard
            id="endpoint-pass-rate"
            index="4.4"
            title="Pass rate"
            description="Build pass rate over one or more trailing day windows. Returns the outcome breakdown (success / failure / unstable / other) and a success-based passRate per window — handy for trend tiles and CI health checks."
            method="GET"
            path={`${BASE}/pass-rate?windows=3,7,15`}
            params={[
              { name: "windows", type: "int[]", defaultValue: "3,7,15,30", description: "Comma-separated trailing windows in days, e.g. windows=3,7,15. Alias: days." },
            ]}
            example={examples.passRate}
            notes={
              <>
                <code className="font-mono">passRate</code> is{" "}
                <code className="font-mono">success / total</code> as a 0–100
                percentage (one decimal); <code className="font-mono">UNSTABLE</code>{" "}
                builds count as not-passed. All windows are sliced from a single
                Jenkins scan (largest window), and stability-test runs are
                excluded so deliberate shake builds don&apos;t skew the rate.
              </>
            }
          />

          <EndpointCard
            id="endpoint-compare-baseline"
            index="4.5"
            title="Compare against baseline"
            description={
              <>
                Compare a single target build against a baseline window of recent
                runs on <code className="font-mono text-blue-500">baselineDevBranch</code>.
                Each failure is categorized so bots can highlight only true
                regressions.
              </>
            }
            method="GET"
            path={`${BASE}/compare/baseline?targetId=2043&baselineDevBranch=master&days=7`}
            params={[
              { name: "targetId", type: "string", required: true, description: "Target build identifier — either a Jenkins build number (e.g. \"2043\") or a branch name (e.g. \"feature/BID-617\")." },
              { name: "baselineDevBranch", type: "string", defaultValue: "master", description: "DEV_BRANCH to use as the baseline window — which recent runs to compare against." },
              { name: "days", type: "int", defaultValue: "7", description: "How many days of baseline builds to scan (max 50 baseline builds analyzed)." },
            ]}
            example={examples.compareBaseline}
            notes={
              <>
                <strong className="text-slate-200">category values:</strong>{" "}
                <code className="font-mono text-rose-500">NEW_FAILURE</code> —
                test broken only in the target;{" "}
                <code className="font-mono text-amber-500">NEW_ERROR</code> —
                test broken in both but with a different first-80-chars
                signature;{" "}
                <code className="font-mono text-slate-400">PRE_EXISTING</code> —
                same failure signature was already present in baseline.
              </>
            }
          />

          <EndpointCard
            id="endpoint-compare-builds"
            index="4.6"
            title="Compare two builds"
            description="Direct build-vs-build comparison. Supports three modes: latest of each branch, two pinned builds, or an aggregated master baseline (multiple master builds combined) vs. one feature build."
            method="GET"
            path={`${BASE}/compare/builds?leftDev=master&rightDev=master&leftBuild=1900&rightBuild=2043`}
            params={[
              { name: "leftDev", type: "string", required: true, description: "DEV_BRANCH of the left side." },
              { name: "rightDev", type: "string", required: true, description: "DEV_BRANCH of the right side." },
              { name: "leftBuild", type: "int", description: "Pinned build number on the left side." },
              { name: "rightBuild", type: "int", description: "Pinned build number on the right side." },
              { name: "leftBuilds", type: "int[]", description: "Comma-separated list of build numbers — only valid when leftDev=master (aggregated baseline mode)." },
            ]}
            example={examples.compareBuilds}
            notes={
              <>
                <strong className="text-slate-200">Mode resolution:</strong> if
                neither <code className="font-mono">leftBuild</code> nor{" "}
                <code className="font-mono">rightBuild</code> is given, the
                latest build on each side is used. If both are given, those
                exact builds are used. If <code className="font-mono">leftBuilds</code>{" "}
                contains multiple ids (master only), failures are unioned
                across those runs to form a tolerant baseline.
              </>
            }
          />
        </section>

        {/* ── 5. Errors ───────────────────────────────────────────── */}
        <section id="errors" className="glass-card p-5 sm:p-6 space-y-3 scroll-mt-24">
          <h2 className="text-xl font-semibold text-slate-100">5. Common errors</h2>
          <div className="overflow-x-auto rounded-lg border border-slate-800/60">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/40 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2 w-20">Status</th>
                  <th className="px-3 py-2 w-44">Meaning</th>
                  <th className="px-3 py-2">Example body</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 text-slate-300">
                <tr className="align-top">
                  <td className="px-3 py-2 font-mono text-amber-500">400</td>
                  <td className="px-3 py-2 text-slate-400">Required parameter missing / invalid</td>
                  <td className="px-3 py-2 font-mono text-slate-400">{`{"error":"targetId is required"}`}</td>
                </tr>
                <tr className="align-top">
                  <td className="px-3 py-2 font-mono text-amber-500">404</td>
                  <td className="px-3 py-2 text-slate-400">Build, branch or stage not found</td>
                  <td className="px-3 py-2 font-mono text-slate-400">{`{"error":"Build #2999 is not in the last 100 Jenkins runs ..."}`}</td>
                </tr>
                <tr className="align-top">
                  <td className="px-3 py-2 font-mono text-amber-500">405</td>
                  <td className="px-3 py-2 text-slate-400">Method not allowed (GET only)</td>
                  <td className="px-3 py-2 font-mono text-slate-400">{`{"error":"Method not allowed. Public API accepts only GET."}`}</td>
                </tr>
                <tr className="align-top">
                  <td className="px-3 py-2 font-mono text-rose-500">429</td>
                  <td className="px-3 py-2 text-slate-400">Rate-limit exceeded</td>
                  <td className="px-3 py-2 font-mono text-slate-400">{`{"error":"Too many requests. Please slow down."}`}</td>
                </tr>
                <tr className="align-top">
                  <td className="px-3 py-2 font-mono text-rose-500">500</td>
                  <td className="px-3 py-2 text-slate-400">Upstream Jenkins failure</td>
                  <td className="px-3 py-2 font-mono text-slate-400">{`{"error":"Failed to compare builds"}`}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ── 6. Recipes ──────────────────────────────────────────── */}
        <section id="recipes" className="space-y-4 scroll-mt-24">
          <h2 className="text-xl font-semibold text-slate-100 px-1">6. Recipes</h2>

          <div className="glass-card p-5 sm:p-6 space-y-3">
            <h3 className="text-base font-semibold text-slate-200">
              Slack bot — post regressions per build
            </h3>
            <p className="text-xs text-slate-400">
              Posts a message after each build with only the truly-new failures
              (PRE_EXISTING failures are skipped to reduce noise).
            </p>
            <CodeBlock language="javascript" code={examples.recipes.slack} />
          </div>

          <div className="glass-card p-5 sm:p-6 space-y-3">
            <h3 className="text-base font-semibold text-slate-200">
              CI gate — fail the build on new regressions
            </h3>
            <p className="text-xs text-slate-400">
              Drop into a Jenkins post-build shell step. Exits non-zero only
              when the build introduced failures that weren&apos;t present in the
              baseline window.
            </p>
            <CodeBlock language="bash" code={examples.recipes.ciGate} />
          </div>

          <div className="glass-card p-5 sm:p-6 space-y-3">
            <h3 className="text-base font-semibold text-slate-200">
              Daily flaky digest
            </h3>
            <p className="text-xs text-slate-400">
              One-liner for a cron / scheduled job that pings a channel with the
              previous day&apos;s flaky-test count.
            </p>
            <CodeBlock language="bash" code={examples.recipes.flakyDigest} />
          </div>

          <div className="glass-card p-5 sm:p-6 space-y-3">
            <h3 className="text-base font-semibold text-slate-200">
              Pass-rate trend digest
            </h3>
            <p className="text-xs text-slate-400">
              Prints the rolling 7-day master build pass rate — drop into a cron
              job or status board to track CI health over time.
            </p>
            <CodeBlock language="bash" code={examples.recipes.passRateTrend} />
          </div>

          <div className="glass-card p-5 sm:p-6 space-y-3">
            <h3 className="text-base font-semibold text-slate-200">
              Test failing-streak alert
            </h3>
            <p className="text-xs text-slate-400">
              Watch a single test and shout when it&apos;s on a failing streak —
              uses <code className="font-mono">consecutiveFailures</code> from
              the test-history endpoint.
            </p>
            <CodeBlock language="bash" code={examples.recipes.testStreak} />
          </div>
        </section>

        {/* ── 7. Changelog ────────────────────────────────────────── */}
        <section id="changelog" className="glass-card p-5 sm:p-6 space-y-3 scroll-mt-24">
          <h2 className="text-xl font-semibold text-slate-100">7. Changelog</h2>
          <ul className="space-y-2 text-sm text-slate-400">
            <li>
              <code className="font-mono text-blue-500">v1.2.0</code> — Added the{" "}
              <code className="font-mono">flaky/test</code> endpoint (per-test
              build history and failure pattern, with name suggestions).
            </li>
            <li>
              <code className="font-mono text-blue-500">v1.1.0</code> — Added the{" "}
              <code className="font-mono">pass-rate</code> endpoint (build pass
              rate across configurable day windows).
            </li>
            <li>
              <code className="font-mono text-blue-500">v1.0.0</code> — Initial
              release. Endpoints: health, flaky, pass-rate,
              flaky/test, compare/baseline, compare/builds.
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}
