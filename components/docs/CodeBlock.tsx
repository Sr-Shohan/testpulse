"use client";

import { Check, Copy } from "lucide-react";
import { clsx } from "clsx";
import { useState } from "react";

interface CodeBlockProps {
  code: string;
  language?: string;
  /** Optional small label shown in the top-left (e.g. "Request"). */
  label?: string;
  className?: string;
}

export default function CodeBlock({
  code,
  language,
  label,
  className,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard might be unavailable (insecure context / Safari iframe).
      // Silently no-op so the docs stay functional.
    }
  };

  return (
    <div
      className={clsx(
        "group relative rounded-xl border border-slate-800/60 bg-slate-950/60 overflow-hidden",
        className
      )}
    >
      {(label || language) && (
        <div className="flex items-center justify-between gap-2 border-b border-slate-800/60 bg-slate-900/40 px-3 py-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            {label ?? language}
          </span>
          {language && label && (
            <span className="text-[10px] font-mono text-slate-600">
              {language}
            </span>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={onCopy}
        title={copied ? "Copied" : "Copy"}
        aria-label={copied ? "Copied" : "Copy code"}
        className={clsx(
          "absolute top-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-md border border-slate-700/70 bg-slate-900/80 text-slate-400 opacity-0 transition-all duration-200",
          "hover:text-slate-100 hover:border-slate-600 hover:bg-slate-800",
          "group-hover:opacity-100 focus:opacity-100",
          label && "top-9"
        )}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
      <pre className="overflow-x-auto p-4 text-[12px] leading-relaxed font-mono text-slate-300 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
        <code>{code}</code>
      </pre>
    </div>
  );
}
