import Link from "next/link";
import { listAssetsWithProjects } from "@/db/repository";
import { ConsultingExportButton } from "@/components/consulting-export-button";
import { PageHero } from "@/components/page-hero";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HistoryPage() {
  const rows = await listAssetsWithProjects();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHero
        compact
        title="Portfolio & migration history"
        subtitle="Every analyzed SAC asset with readiness scores, project context, and one-click consulting exports."
      />

      <div className="flex justify-end">
        <a
          className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
          href="/api/portfolio/export"
        >
          Download portfolio CSV
        </a>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Analyzed assets ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.length === 0 ? (
            <p className="text-sm text-slate-600">
              No assets yet.{" "}
              <Link href="/import" className="font-medium text-[#0a6ed1] hover:underline">
                Import SAC exports
              </Link>{" "}
              to build your portfolio.
            </p>
          ) : (
            rows.map(({ asset, project }) => (
              <div
                key={asset.id}
                className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900 break-words">{asset.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {new Date(asset.createdAt).toLocaleString("de-DE")} · {project.clientName} (
                    {project.projectCode})
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border border-slate-200 bg-white">{asset.status}</Badge>
                  <Badge className="bg-[#dbeafe] text-[#0a6ed1] tabular-nums">{asset.score}%</Badge>
                  <Link
                    className="text-sm font-medium text-[#0a6ed1] hover:underline"
                    href={`/generator?assetId=${asset.id}`}
                  >
                    Generator
                  </Link>
                  <a className="text-sm text-slate-600 hover:underline" href={`/api/assets/${asset.id}/report`}>
                    PDF
                  </a>
                  <ConsultingExportButton assetId={asset.id} variant="secondary" className="!py-2 !text-xs" />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
