"use client";

import dynamic from "next/dynamic";

const CompareBranchesClient = dynamic(
  () => import("./CompareBranchesClient"),
  {
    ssr: false,
    loading: () => (
      <p className="py-8 text-sm text-slate-500" role="status">
        Loading compare…
      </p>
    ),
  }
);

export default function ComparePageClientGate() {
  return <CompareBranchesClient />;
}
