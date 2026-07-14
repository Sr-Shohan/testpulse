"use client";

import { clsx } from "clsx";
import { useEffect, useState } from "react";

export interface TocEntry {
  id: string;
  label: string;
  /** Sub-entries rendered slightly indented. */
  children?: TocEntry[];
}

interface TocSidebarProps {
  entries: TocEntry[];
}

function flatIds(entries: TocEntry[]): string[] {
  const out: string[] = [];
  for (const e of entries) {
    out.push(e.id);
    if (e.children) for (const c of e.children) out.push(c.id);
  }
  return out;
}

export default function TocSidebar({ entries }: TocSidebarProps) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const ids = flatIds(entries);
    const nodes = ids
      .map((id) => document.getElementById(id))
      .filter((n): n is HTMLElement => n !== null);
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (records) => {
        const visible = records
          .filter((r) => r.isIntersecting)
          .sort((a, b) => a.target.getBoundingClientRect().top - b.target.getBoundingClientRect().top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: 0 }
    );
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, [entries]);

  const renderLink = (e: TocEntry, isChild = false) => (
    <a
      key={e.id}
      href={`#${e.id}`}
      className={clsx(
        "block rounded-md px-3 py-1.5 text-xs transition-colors",
        isChild ? "ml-3 pl-5" : "",
        active === e.id
          ? "bg-blue-500/10 text-blue-500 font-semibold"
          : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
      )}
    >
      {e.label}
    </a>
  );

  return (
    <nav
      aria-label="On this page"
      className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto rounded-xl border border-slate-800/60 bg-slate-900/40 p-3 backdrop-blur-md"
    >
      <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
        On this page
      </p>
      <div className="space-y-0.5">
        {entries.map((e) => (
          <div key={e.id}>
            {renderLink(e)}
            {e.children?.map((c) => renderLink(c, true))}
          </div>
        ))}
      </div>
    </nav>
  );
}
