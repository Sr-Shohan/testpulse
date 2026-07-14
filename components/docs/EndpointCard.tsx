import { ReactNode } from "react";
import MethodBadge from "./MethodBadge";
import ParamTable, { type ParamRow } from "./ParamTable";
import CodeBlock from "./CodeBlock";

interface EndpointCardProps {
  id: string;
  index: string;
  title: string;
  description: ReactNode;
  method: "GET";
  path: string;
  params?: ParamRow[];
  example: {
    /** The full URL the caller hits — bare, no `curl` prefix, so it can be
     *  copy-pasted into Postman, a browser, or any HTTP client. */
    request: string;
    response: string;
    /** Optional note rendered above the response block. */
    responseNote?: string;
  };
  notes?: ReactNode;
}

export default function EndpointCard({
  id,
  index,
  title,
  description,
  method,
  path,
  params = [],
  example,
  notes,
}: EndpointCardProps) {
  return (
    <section
      id={id}
      // scroll-margin so anchor jumps don't tuck the title under the header
      className="glass-card p-5 sm:p-6 space-y-5 scroll-mt-24"
    >
      <header className="space-y-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
            {index}
          </span>
          <h3 className="text-lg sm:text-xl font-semibold text-slate-100">
            {title}
          </h3>
        </div>
        <div className="text-sm text-slate-400 leading-relaxed">{description}</div>
      </header>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-800/60 bg-slate-900/40 px-3 py-2">
        <MethodBadge method={method} />
        <code className="font-mono text-sm text-slate-200 break-all">
          {path}
        </code>
      </div>

      {params.length > 0 && (
        <ParamTable title="Query parameters" rows={params} />
      )}

      <div className="space-y-3">
        <CodeBlock label="Example URL" language="text" code={example.request} />
        {example.responseNote && (
          <p className="text-xs italic text-slate-500">{example.responseNote}</p>
        )}
        <CodeBlock label="Example response" language="json" code={example.response} />
      </div>

      {notes && (
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-slate-400 leading-relaxed">
          {notes}
        </div>
      )}
    </section>
  );
}
