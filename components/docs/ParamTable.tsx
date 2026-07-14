export interface ParamRow {
  name: string;
  type: string;
  required?: boolean;
  defaultValue?: string;
  description: string;
}

interface ParamTableProps {
  title?: string;
  rows: ParamRow[];
}

export default function ParamTable({ title, rows }: ParamTableProps) {
  if (rows.length === 0) {
    return (
      <div className="text-xs italic text-slate-500">
        No parameters.
      </div>
    );
  }

  return (
    <div>
      {title && (
        <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2">
          {title}
        </h4>
      )}
      <div className="overflow-x-auto rounded-lg border border-slate-800/60">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900/40 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-3 py-2 w-32">Name</th>
              <th className="px-3 py-2 w-20">Type</th>
              <th className="px-3 py-2 w-20">Required</th>
              <th className="px-3 py-2 w-24">Default</th>
              <th className="px-3 py-2">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40 text-slate-300">
            {rows.map((row) => (
              <tr key={row.name} className="align-top">
                <td className="px-3 py-2 font-mono text-blue-500">{row.name}</td>
                <td className="px-3 py-2 font-mono text-slate-400">{row.type}</td>
                <td className="px-3 py-2">
                  {row.required ? (
                    <span className="text-rose-500 font-semibold">yes</span>
                  ) : (
                    <span className="text-slate-500">no</span>
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-slate-400">
                  {row.defaultValue ?? "—"}
                </td>
                <td className="px-3 py-2 text-slate-400">{row.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
