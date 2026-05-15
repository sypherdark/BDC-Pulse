import { PRODUCT_BADGE, PRODUCT_TAGLINE, PRODUCT_TITLE } from "@/lib/pillar-tooltips";
import { cn } from "@/lib/utils";

type PageHeroProps = {
  title?: string;
  subtitle?: string;
  badge?: string;
  compact?: boolean;
  className?: string;
  children?: React.ReactNode;
};

export function PageHero({
  title = PRODUCT_TITLE,
  subtitle = PRODUCT_TAGLINE,
  badge = PRODUCT_BADGE,
  compact = false,
  className,
  children,
}: PageHeroProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white via-slate-50/80 to-sky-50/50 shadow-sm",
        compact ? "px-5 py-5" : "px-6 py-7 md:px-8 md:py-9",
        className,
      )}
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#0a6ed1]/8 blur-3xl" aria-hidden />
      <div className="relative space-y-3">
        <span className="inline-flex items-center rounded-full border border-[#0a6ed1]/20 bg-[#0a6ed1]/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#0a6ed1]">
          {badge}
        </span>
        <div className="space-y-2">
          <h1
            className={cn(
              "font-semibold tracking-tight text-slate-900",
              compact ? "text-xl md:text-2xl" : "text-2xl md:text-3xl",
            )}
          >
            {title}
          </h1>
          <p className={cn("max-w-3xl text-slate-600", compact ? "text-sm" : "text-sm md:text-base")}>
            {subtitle}
          </p>
        </div>
        {children}
      </div>
    </section>
  );
}
