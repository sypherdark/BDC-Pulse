"use client";

import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function InfoTip({
  content,
  className,
  label = "More information",
}: {
  content: string;
  className?: string;
  label?: string;
}) {
  return (
    <span className={cn("group/info relative inline-flex align-middle", className)}>
      <button
        type="button"
        className="rounded-full p-0.5 text-slate-400 transition-colors hover:text-[#0a6ed1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a6ed1]/40"
        aria-label={label}
      >
        <HelpCircle className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-50 hidden w-64 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-left text-[11px] font-normal leading-relaxed text-slate-50 shadow-xl ring-1 ring-slate-700/50 group-hover/info:block group-focus-within/info:block"
      >
        {content}
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
      </span>
    </span>
  );
}
