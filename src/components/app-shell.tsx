import { AppSidebar } from "@/components/app-sidebar";
import { PRODUCT_BADGE } from "@/lib/pillar-tooltips";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50/40">
      <AppSidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="border-b border-slate-200/90 bg-white/95 px-4 py-2.5 shadow-sm md:px-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center rounded-full border border-[#0a6ed1]/25 bg-gradient-to-r from-sky-50 to-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#0a6ed1]">
              {PRODUCT_BADGE}
            </span>
            <span className="text-xs text-slate-500">
              SAC → SAP Business Data Cloud · Datasphere-ready deliverables
            </span>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
