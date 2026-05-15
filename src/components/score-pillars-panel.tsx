"use client";

import { PILLAR_TOOLTIPS } from "@/lib/pillar-tooltips";
import type { ScoreCategoryBreakdown } from "@/lib/types";
import { InfoTip } from "@/components/info-tip";
import { cn } from "@/lib/utils";

export function ScorePillarsPanel({
  categories,
  score,
  className,
  defaultOpen = true,
}: {
  categories: ScoreCategoryBreakdown[];
  score?: number;
  className?: string;
  defaultOpen?: boolean;
}) {
  if (!categories.length) return null;

  return (
    <details
      className={cn("rounded-xl border border-slate-200 bg-white shadow-sm", className)}
      open={defaultOpen}
    >
      <summary className="cursor-pointer list-none px-4 py-3.5 font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          Weighted readiness pillars
          <InfoTip content="Five deterministic pillars compose the Migration Readiness Score. Weights: Semantic 25%, Calculation 25%, Planning 20%, Performance 15%, Governance 15%." />
          {score !== undefined ? (
            <span className="ml-auto text-sm font-normal tabular-nums text-[#0a6ed1]">{score}% total</span>
          ) : null}
        </span>
      </summary>
      <ul className="space-y-2 border-t border-slate-100 px-4 py-3">
        {categories.map((cat) => {
          const meta = PILLAR_TOOLTIPS[cat.id];
          return (
            <li
              key={cat.id}
              className="grid gap-2 rounded-lg bg-slate-50/80 px-3 py-2.5 text-xs text-slate-700 sm:grid-cols-[1fr_auto]"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 font-medium text-slate-900">
                  {cat.label}
                  <InfoTip content={meta?.tooltip ?? cat.detail} label={`About ${cat.label}`} />
                  <span className="text-slate-500">({cat.weightPercent}%)</span>
                </p>
                <p className="mt-0.5 line-clamp-2 text-slate-600">{cat.detail}</p>
              </div>
              <div className="text-right tabular-nums sm:pt-0.5">
                <span className="font-semibold text-slate-900">{cat.pillarScore}</span>
                <span className="text-slate-500">/100</span>
                <span className="mx-1 text-slate-300">→</span>
                <span className="font-semibold text-[#0a6ed1]">+{cat.weightedContribution}</span>
                <span className="text-slate-500"> pts</span>
              </div>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
