import { clsx } from "clsx";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

const STYLES: Record<HttpMethod, string> = {
  GET: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
  POST: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  PUT: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  PATCH: "bg-violet-500/10 text-violet-500 border-violet-500/30",
  DELETE: "bg-rose-500/10 text-rose-500 border-rose-500/30",
};

export default function MethodBadge({ method }: { method: HttpMethod }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center justify-center rounded-md border px-2 py-0.5 font-mono text-[11px] font-bold tracking-wide",
        STYLES[method]
      )}
    >
      {method}
    </span>
  );
}
