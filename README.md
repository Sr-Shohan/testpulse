# TestPulse

**CI Test Intelligence** — a QA dashboard that surfaces flaky tests, build
pass-rate trends, stability matrices and build-vs-build comparisons, with a
read-only public API for Slack bots and CI gates.

This build ships with a **built-in synthetic dataset**, so it runs with zero
external dependencies — no CI server, no credentials, no network. Everything you
see is generated deterministically in-memory and looks like real CI history.

> Want live data later? Flip a single env var (`DATA_SOURCE=jenkins`) and point
> it at a real Jenkins instance — the app code stays the same.

---

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

No `.env` file is required for the demo. To customize, copy `.env.example` to
`.env.local`.

---

## Features

- **Dashboard** — summary cards, build trend chart, failure insights.
- **Flaky Tests** — per-test flaky score, failure history and error patterns.
- **Compare** — latest-per-branch, pinned builds, and aggregated-baseline diffs.
- **Stability Matrix** — per-test / per-build pass-fail grid.
- **Build History** — filterable list of recent builds.
- **Public API** — documented at `/api-docs` (read-only, GET only).

---

## Deploy to Vercel

1. Push this folder to a new GitHub repository.
2. In [Vercel](https://vercel.com/new), **Import** the repo.
3. Framework preset: **Next.js** (auto-detected). No env vars needed for the demo.
4. Deploy.

The demo dataset requires no configuration, so the first deploy is fully
populated out of the box.

---

## Switching to a real Jenkins (later)

Set these environment variables (locally in `.env.local`, or in Vercel project
settings) and redeploy:

```env
DATA_SOURCE=jenkins
JENKINS_BASE_URL=https://your-jenkins.example.com/job/your-pipeline
JENKINS_USER=your_username
JENKINS_TOKEN=your_api_token
```

The data layer lives in `lib/jenkins.ts`. It reads from the demo dataset
(`lib/demo/dataset.ts`) by default and from the real Jenkins HTTP API when
`DATA_SOURCE=jenkins`. Only the four low-level fetchers (`fetchBranches`,
`fetchBuilds`, `fetchBuildParameters`, `fetchTestReport`) touch the source —
everything downstream (flaky scoring, comparisons, drift, pass-rate) is shared.

---

## Tech stack

- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS v4
- **Charts**: Recharts
- **Icons**: Lucide React

---

## Production build

```bash
npm run build
npm start
```
