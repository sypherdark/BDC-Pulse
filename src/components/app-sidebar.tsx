"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Briefcase, FolderUp, History, Layers3, Settings } from "lucide-react";
import { PRODUCT_TAGLINE } from "@/lib/pillar-tooltips";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/projects", label: "Projects", icon: Briefcase },
  { href: "/import", label: "Import & analyze", icon: FolderUp },
  { href: "/history", label: "Portfolio", icon: History },
  { href: "/generator", label: "Data product", icon: Layers3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 flex-col border-r border-slate-800/50 bg-[#0f172a] text-white">
      <div className="border-b border-slate-800/80 p-6">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-sky-400/90">BDC Pulse</p>
        <h1 className="mt-1 text-lg font-bold leading-snug tracking-tight text-white">
          SAC → BDC
          <span className="block text-sm font-medium text-slate-400">Migration Accelerator</span>
        </h1>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-500">{PRODUCT_TAGLINE}</p>
      </div>
      <nav className="flex-1 space-y-0.5 px-2 py-4">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800/80 hover:text-white",
                active && "bg-[#0a6ed1] text-white shadow-sm shadow-[#0a6ed1]/25 hover:bg-[#0a6ed1]",
              )}
            >
              <Icon size={16} strokeWidth={2} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
