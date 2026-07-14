import ComparePageClientGate from "./ComparePageClientGate";

export default function ComparePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-2 text-2xl font-bold text-slate-100">
          Compare failing builds based on developers branches
        </h1>
        <p className="max-w-2xl text-sm text-slate-400">
          Pick two <span className="text-slate-300">DEV_BRANCH</span> values from
          the dropdowns.
          Jenkins history for each branch appears below; choose a concrete build #
          per side before comparing failures.
        </p>
      </div>
      <ComparePageClientGate />
    </div>
  );
}
