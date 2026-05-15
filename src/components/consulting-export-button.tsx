import { Briefcase, Download } from "lucide-react";
import { cn } from "@/lib/utils";

type ConsultingExportButtonProps = {
  assetId: number;
  variant?: "primary" | "secondary";
  className?: string;
  label?: string;
};

export function ConsultingExportButton({
  assetId,
  variant = "primary",
  className,
  label = "Export for Consulting",
}: ConsultingExportButtonProps) {
  const href = `/api/assets/${assetId}/export-consulting`;

  if (variant === "secondary") {
    return (
      <a
        href={href}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm transition-colors hover:border-[#0a6ed1]/30 hover:bg-slate-50",
          className,
        )}
      >
        <Briefcase className="h-4 w-4 text-[#0a6ed1]" strokeWidth={2} />
        {label}
      </a>
    );
  }

  return (
    <a
      href={href}
      className={cn(
        "inline-flex items-center gap-2.5 rounded-lg bg-[#0a6ed1] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#0a6ed1]/20 transition-colors hover:bg-[#085caf]",
        className,
      )}
    >
      <Download className="h-4 w-4" strokeWidth={2.5} />
      {label}
      <span className="rounded-md bg-white/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
        ZIP
      </span>
    </a>
  );
}
