import Link from "next/link";
import { AlertTriangle, ArrowRight, FileText, Gauge, RefreshCcw } from "lucide-react";
import { getDashboardStats } from "@/db/repository";
import { PageHero } from "@/components/page-hero";
import { ScoreHistoryChart } from "@/components/dashboard-charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  const stats = await getDashboardStats();
  const topIssues = stats.recent
    .flatMap((asset) => JSON.parse(asset.issuesJson) as { title: string }[])
    .slice(0, 5);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHero>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/import"
            className="inline-flex h-9 items-center justify-center rounded-md bg-[#0a6ed1] px-4 text-sm font-semibold text-white hover:bg-[#085caf]"
          >
            Import SAC assets
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
          <Link
            href="/history"
            className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-card px-4 text-sm font-semibold hover:bg-muted"
          >
            View portfolio
          </Link>
        </div>
      </PageHero>

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Migration readiness overview
        </h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-slate-200/90 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <Gauge size={16} className="text-[#0a6ed1]" /> Readiness score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tabular-nums tracking-tight text-[#0a6ed1]">
                {stats.readinessScore}%
              </p>
            </CardContent>
          </Card>
          <Card className="border-slate-200/90 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <FileText size={16} className="text-[#0a6ed1]" /> Analyzed assets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tabular-nums text-slate-900">{stats.totalAssets}</p>
            </CardContent>
          </Card>
          <Card className="border-slate-200/90 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <AlertTriangle size={16} className="text-amber-600" /> Open issues
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tabular-nums text-slate-900">{topIssues.length}</p>
            </CardContent>
          </Card>
          <Card className="border-slate-200/90 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <RefreshCcw size={16} className="text-[#0a6ed1]" /> Recent assessments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tabular-nums text-slate-900">{stats.recent.length}</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <ScoreHistoryChart
        rows={stats.recent.map((row) => ({
          name: row.name.length > 16 ? `${row.name.slice(0, 14)}..` : row.name,
          score: row.score,
        }))}
      />

      <Card className="border-slate-200/90 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Top migration issues</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {topIssues.length === 0 ? (
            <p className="text-sm text-slate-600">
              No assessments yet.{" "}
              <Link href="/import" className="font-medium text-[#0a6ed1] hover:underline">
                Import SAC exports
              </Link>{" "}
              to generate your first readiness score.
            </p>
          ) : (
            topIssues.map((issue, idx) => (
              <div
                key={`${issue.title}-${idx}`}
                className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-sm leading-relaxed text-slate-800"
              >
                {issue.title}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
