/**
 * Deterministic demo dataset.
 *
 * This module fabricates a realistic-looking CI history (builds, parameters and
 * JUnit-style test reports) entirely in memory. It exists so the whole product
 * runs with zero external dependencies — no Jenkins, no credentials, no network.
 *
 * The data is *deterministic*: test outcomes are derived from a seeded hash of
 * (testId, buildNumber), so flaky patterns, regressions and drift stay stable
 * across reloads while still looking organic. Timestamps are anchored to "now",
 * so the dashboard always looks freshly populated.
 *
 * Swapping in a real Jenkins later only requires flipping `DATA_SOURCE=jenkins`
 * (see lib/jenkins.ts) — nothing here needs to change.
 */

import { JenkinsRawBuild, TestCaseResult, BranchInfo } from '../types';

const DAY = 24 * 60 * 60 * 1000;

// ─── Seeded RNG helpers ──────────────────────────────────────

/** xmur3 string hash — strong avalanche so sequential keys decorrelate well. */
function hashStr(s: string): number {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/** Stable, uniform pseudo-random number in [0,1) for a given key. */
function rand(key: string): number {
  let a = hashStr(key) >>> 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Deterministic integer in [min,max]. */
function randInt(key: string, min: number, max: number): number {
  return min + Math.floor(rand(key) * (max - min + 1));
}

// ─── Test universe ───────────────────────────────────────────

type Profile = 'stable' | 'flaky' | 'always-fail' | 'regression' | 'fixed';

interface TestDef {
  id: string;
  /** JUnit "name" (method or scenario). */
  name: string;
  /** JUnit "className" (FQCN or spec path) — drives the module label heuristics. */
  className: string;
  module: string;
  profile: Profile;
}

/** Build a Java-style class group. */
function java(
  module: string,
  className: string,
  cases: Array<[string, Profile]>
): TestDef[] {
  return cases.map(([name, profile]) => ({
    id: `${className}#${name}`,
    name,
    className,
    module,
    profile,
  }));
}

/** Build a spec-file style group (Playwright / pytest). */
function spec(
  module: string,
  file: string,
  cases: Array<[string, Profile]>
): TestDef[] {
  return cases.map(([name, profile]) => ({
    id: `${file}#${name}`,
    name,
    className: file,
    module,
    profile,
  }));
}

const TEST_UNIVERSE: TestDef[] = [
  // ── Checkout (Java) ──
  ...java('checkout', 'com.acme.shop.checkout.CheckoutFlowTest', [
    ['shouldCompleteOrder', 'stable'],
    ['shouldApplyDiscountCode', 'flaky'],
    ['shouldHandlePaymentTimeout', 'regression'],
  ]),
  ...java('checkout', 'com.acme.shop.checkout.CheckoutValidationTest', [
    ['rejectsEmptyCart', 'stable'],
    ['validatesShippingAddress', 'stable'],
  ]),
  // ── Payments (Java) ──
  ...java('payments', 'com.acme.shop.payments.PaymentGatewayTest', [
    ['authorizesCard', 'stable'],
    ['retriesOnGatewayError', 'flaky'],
    ['refundsFullAmount', 'stable'],
    ['handlesDeclinedCard', 'stable'],
  ]),
  ...java('payments', 'com.acme.shop.payments.PayoutTest', [
    ['schedulesPayout', 'stable'],
    ['reconcilesLedger', 'stable'],
  ]),
  // ── Cart (Java) ──
  ...java('cart', 'com.acme.shop.cart.CartServiceTest', [
    ['addsItem', 'stable'],
    ['mergesGuestCart', 'flaky'],
    ['recalculatesTotals', 'fixed'],
  ]),
  ...java('cart', 'com.acme.shop.cart.CartLimitsTest', [
    ['enforcesMaxQuantity', 'stable'],
  ]),
  // ── Inventory (Java) ──
  ...java('inventory', 'com.acme.shop.inventory.InventoryTest', [
    ['decrementsStockOnOrder', 'stable'],
    ['preventsOversell', 'regression'],
    ['syncsWarehouseFeed', 'stable'],
  ]),
  // ── Auth (Java) ──
  ...java('auth', 'com.acme.shop.auth.AuthServiceTest', [
    ['issuesJwt', 'stable'],
    ['refreshesToken', 'stable'],
    ['lockoutAfterFailedAttempts', 'stable'],
  ]),
  ...java('auth', 'com.acme.shop.auth.SsoTest', [
    ['samlLogin', 'stable'],
  ]),
  // ── Reports (pytest) — matches the API-docs test-history example ──
  ...spec('reports', 'tests/reports/widgets_permissions.py', [
    ['test_regression_report_widgets_permission_enabled', 'flaky'],
    ['test_regression_report_widgets_permission_disabled', 'stable'],
    ['test_regression_report_custom_widgets_validation', 'regression'],
  ]),
  ...spec('reports', 'tests/reports/exports.py', [
    ['test_daily_revenue_report', 'stable'],
    ['test_export_csv', 'stable'],
    ['test_email_digest_schedule', 'stable'],
  ]),
  // ── Search (Playwright) ──
  ...spec('search', 'tests/search/facets.spec.ts', [
    ['filters products by category', 'stable'],
    ['sorts results by price', 'stable'],
  ]),
  ...spec('search', 'tests/search/autocomplete.spec.ts', [
    ['suggests products while typing', 'stable'],
    ['handles empty query gracefully', 'stable'],
  ]),
  // ── Profile (Playwright) ──
  ...spec('profile', 'tests/profile/settings.spec.ts', [
    ['updates email address', 'stable'],
    ['changes password', 'stable'],
    ['uploads a new avatar', 'stable'],
  ]),
  // ── Notifications (Playwright) ──
  ...spec('notifications', 'tests/notifications/center.spec.ts', [
    ['marks all notifications as read', 'stable'],
    ['shows realtime unread badge', 'flaky'],
    ['loads notification preferences', 'stable'],
  ]),
  // ── Onboarding (Playwright) ──
  ...spec('onboarding', 'tests/onboarding/wizard.spec.ts', [
    ['completes all required steps', 'stable'],
    ['skips optional steps', 'stable'],
  ]),
  ...spec('onboarding', 'tests/onboarding/tour.spec.ts', [
    ['shows feature tooltips', 'stable'],
  ]),
  // ── Admin (Playwright) ──
  ...spec('admin', 'tests/admin/users.spec.ts', [
    ['bans a user', 'stable'],
    ['edits user roles', 'regression'],
  ]),
  ...spec('admin', 'tests/admin/audit-log.spec.ts', [
    ['filters audit log by date', 'stable'],
  ]),
  // ── Shipping (Playwright) ──
  ...spec('shipping', 'tests/shipping/rates.spec.ts', [
    ['calculates domestic rate', 'stable'],
    ['adds international surcharge', 'stable'],
  ]),
];

const MODULES = Array.from(new Set(TEST_UNIVERSE.map((t) => t.module)));

// ─── Error message generation ────────────────────────────────

function errorFor(test: TestDef, buildNumber: number): string {
  const line = randInt(`${test.id}:${buildNumber}:line`, 40, 320);
  const pick = rand(`${test.id}:${buildNumber}:err`);

  if (test.className.endsWith('.py')) {
    const file = test.className;
    if (pick < 0.5) {
      return `assert response.status_code == 200\nE       assert 500 == 200\n${file}:${line}: AssertionError`;
    }
    return `E       TimeoutException: element '#report-widget' not found within 30s\n${file}:${line}`;
  }

  if (test.className.endsWith('.spec.ts')) {
    if (pick < 0.4) {
      return `TimeoutError: locator.click: Timeout 30000ms exceeded.\n  waiting for getByRole('button', { name: 'Submit' })\n  at ${test.className}:${line}`;
    }
    if (pick < 0.75) {
      return `Error: expect(received).toBeVisible()\n  Expected: visible\n  Received: hidden\n  at ${test.className}:${line}`;
    }
    return `Error: expect(received).toHaveText(expected)\n  Expected: "$120.00"\n  Received: "$0.00"\n  at ${test.className}:${line}`;
  }

  // Java-style stack trace.
  const shortClass = test.className.split('.').pop() ?? 'Test';
  if (pick < 0.35) {
    return `java.lang.AssertionError: expected:<200> but was:<500>\n\tat ${test.className}.${test.name}(${shortClass}.java:${line})`;
  }
  if (pick < 0.6) {
    return `java.lang.NullPointerException: Cannot invoke "Order.getTotal()" because "order" is null\n\tat ${test.className}.${test.name}(${shortClass}.java:${line})`;
  }
  if (pick < 0.82) {
    return `org.awaitility.core.ConditionTimeoutException: Condition was not fulfilled within 30 seconds.\n\tat ${test.className}.${test.name}(${shortClass}.java:${line})`;
  }
  return `java.net.SocketTimeoutException: Read timed out\n\tat ${test.className}.${test.name}(${shortClass}.java:${line})`;
}

// ─── Build schedule / parameters ─────────────────────────────

interface JobConfig {
  name: string;
  baseBuild: number;
  builds: number;
  spanDays: number;
  /** Feature/bugfix branches occupying contiguous (newest-first) index ranges. */
  campaigns: Array<{ from: number; to: number; devBranch: string }>;
}

const JOBS: JobConfig[] = [
  {
    name: 'master',
    baseBuild: 2506,
    builds: 62,
    spanDays: 35,
    campaigns: [
      { from: 3, to: 8, devBranch: 'feature/QA-171-notifications-center' },
      { from: 14, to: 18, devBranch: 'feature/QA-160-search-facets' },
      { from: 24, to: 28, devBranch: 'bugfix/QA-152-cart-total-rounding' },
      { from: 34, to: 39, devBranch: 'feature/QA-140-payments-retry' },
      { from: 45, to: 50, devBranch: 'feature/QA-118-new-checkout-flow' },
    ],
  },
  {
    name: 'develop',
    baseBuild: 1884,
    builds: 26,
    spanDays: 21,
    campaigns: [
      { from: 4, to: 8, devBranch: 'feature/QA-165-inventory-sync' },
      { from: 15, to: 19, devBranch: 'feature/QA-133-sso-saml' },
    ],
  },
  {
    name: 'release-1.9',
    baseBuild: 412,
    builds: 16,
    spanDays: 18,
    campaigns: [{ from: 3, to: 6, devBranch: 'hotfix/QA-158-payout-ledger' }],
  },
];

function fakeSha(key: string): string {
  const hex = '0123456789abcdef';
  let s = '';
  for (let i = 0; i < 8; i++) s += hex[randInt(`${key}:sha:${i}`, 0, 15)];
  return s;
}

interface DemoBuildRecord {
  number: number;
  timestamp: number;
  result: string;
  params: Record<string, string>;
  cases: TestCaseResult[];
}

function statusFor(
  test: TestDef,
  buildNumber: number,
  ordinal: number,
  totalOrdinals: number,
  stage: string
): string {
  const p = rand(`${test.id}:${buildNumber}`);
  const stageBump = stage === 'qa' ? 0 : 0.16; // non-qa stages drift worse
  // Regressions only appear in the most recent slice of history, so older
  // builds stay green and the 30d pass-rate is healthier than the 7d one.
  const regOrdinal = Math.floor(totalOrdinals * 0.86);
  const fixOrdinal = Math.floor(totalOrdinals * 0.18);

  let fail: boolean;
  let regressed = false;
  let justFixed = false;

  switch (test.profile) {
    case 'stable':
      fail = p < 0.006;
      break;
    case 'flaky':
      fail = p < Math.min(0.5, 0.15 + stageBump);
      break;
    case 'always-fail':
      fail = p < 0.9;
      break;
    case 'regression':
      if (ordinal < regOrdinal) {
        fail = p < 0.006;
      } else {
        fail = p < Math.min(0.9, 0.6 + stageBump);
        if (ordinal === regOrdinal && fail) regressed = true;
      }
      break;
    case 'fixed':
      if (ordinal < fixOrdinal) {
        fail = p < 0.7;
      } else {
        fail = false;
        if (ordinal === fixOrdinal) justFixed = true;
      }
      break;
    default:
      fail = false;
  }

  if (!fail) return justFixed ? 'FIXED' : 'PASSED';
  return regressed ? 'REGRESSION' : 'FAILED';
}

function buildDataset(): Map<string, DemoBuildRecord[]> {
  const now = Date.now();
  const byBranch = new Map<string, DemoBuildRecord[]>();

  for (const job of JOBS) {
    const records: DemoBuildRecord[] = [];
    const gap = (job.spanDays * DAY) / job.builds;

    for (let index = 0; index < job.builds; index++) {
      const number = job.baseBuild - index;
      const jitter = (rand(`${job.name}:${number}:jit`) - 0.5) * gap * 0.6;
      const timestamp = Math.round(now - index * gap - jitter - 30 * 60 * 1000);
      const ordinal = job.builds - 1 - index; // 0 = oldest

      const campaign = job.campaigns.find(
        (c) => index >= c.from && index <= c.to
      );

      // ── Parameters ──
      const params: Record<string, string> = { TEST_BRANCH: 'master' };
      let stage: string;
      if (campaign) {
        params.DEV_BRANCH = campaign.devBranch;
        stage = 'dev';
      } else {
        const staging = index % 7 === 0;
        stage = staging ? 'staging' : 'qa';
        params.DEV_BRANCH =
          index % 2 === 0 ? 'master' : fakeSha(`${job.name}:${number}`);
      }
      params.DASHBOARD_STAGE = stage;

      const specificModule =
        index % 9 === 0
          ? MODULES[randInt(`${job.name}:${number}:mod`, 0, MODULES.length - 1)]
          : null;
      params.DASHBOARD_MODULES_TO_TEST = specificModule
        ? specificModule.toUpperCase()
        : 'ALL_MODULES';

      if (index % 13 === 0) params.REGRESSION_TYPE = 'CRITICAL_REGRESSION';
      else if (index % 5 === 0) params.REGRESSION_TYPE = 'REGRESSION';
      else params.REGRESSION_TYPE = 'NONE';

      const isStabilityRun = index % 12 === 5;
      if (isStabilityRun) params.STABILITY_TEST = 'true';

      // ── Infra failure (no test report) ──
      const isInfraFail = index % 23 === 7;
      if (isInfraFail) {
        records.push({
          number,
          timestamp,
          result: 'FAILURE',
          params,
          cases: [],
        });
        continue;
      }

      // ── Test report ──
      const scoped = specificModule
        ? TEST_UNIVERSE.filter((t) => t.module === specificModule)
        : TEST_UNIVERSE;

      const cases: TestCaseResult[] = [];
      let failures = 0;

      for (const test of scoped) {
        // Occasional skips only in full (ALL_MODULES) runs.
        if (
          !specificModule &&
          rand(`${test.id}:${number}:skip`) < 0.04
        ) {
          cases.push({
            name: test.name,
            status: 'SKIPPED',
            errorDetails: null,
            duration: 0,
            className: test.className,
            buildNumber: number,
            buildTimestamp: 0,
          });
          continue;
        }

        const status = statusFor(test, number, ordinal, job.builds, stage);
        const isFail = status === 'FAILED' || status === 'REGRESSION';
        if (isFail) failures++;

        const baseDur = randInt(`${test.id}:dur`, 200, 4200) / 1000;
        const failPenalty = isFail
          ? randInt(`${test.id}:${number}:fp`, 800, 26000) / 1000
          : 0;

        cases.push({
          name: test.name,
          status,
          errorDetails: isFail ? errorFor(test, number) : null,
          duration: Math.round((baseDur + failPenalty) * 1000) / 1000,
          className: test.className,
          buildNumber: number,
          buildTimestamp: 0,
        });
      }

      let result: string;
      if (failures === 0) result = 'SUCCESS';
      else if (failures > 8 && rand(`${job.name}:${number}:hard`) < 0.35)
        result = 'FAILURE';
      else result = 'UNSTABLE';

      records.push({ number, timestamp, result, params, cases });
    }

    // Jenkins returns newest first.
    records.sort((a, b) => b.number - a.number);
    byBranch.set(job.name, records);
  }

  return byBranch;
}

let _dataset: Map<string, DemoBuildRecord[]> | null = null;
function dataset(): Map<string, DemoBuildRecord[]> {
  if (!_dataset) _dataset = buildDataset();
  return _dataset;
}

function recordsFor(branch: string): DemoBuildRecord[] {
  return dataset().get(branch) ?? [];
}

// ─── Public raw accessors (mirror the Jenkins client output) ──

export function getBranches(): BranchInfo[] {
  return JOBS.map((j) => ({ name: j.name, url: `#/job/${j.name}/` }));
}

export function getRawBuilds(branch: string, count: number): JenkinsRawBuild[] {
  return recordsFor(branch)
    .slice(0, count)
    .map((r) => ({ number: r.number, result: r.result, timestamp: r.timestamp }));
}

export function getParams(
  branch: string,
  buildNumber: number
): Record<string, string> {
  const rec = recordsFor(branch).find((r) => r.number === buildNumber);
  return rec ? { ...rec.params } : {};
}

export function getTestReport(
  branch: string,
  buildNumber: number
): TestCaseResult[] {
  const rec = recordsFor(branch).find((r) => r.number === buildNumber);
  if (!rec) return [];
  return rec.cases.map((c) => ({ ...c }));
}
