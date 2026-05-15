"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, Loader2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { ConsultingExportButton } from "@/components/consulting-export-button";
import { IngestReportCard } from "@/components/ingest-report-card";
import { InfoTip } from "@/components/info-tip";
import { PageHero } from "@/components/page-hero";
import { ScorePillarsPanel } from "@/components/score-pillars-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { IngestReport } from "@/lib/extract-uploads";
import { TERM_TOOLTIPS } from "@/lib/pillar-tooltips";
import { formatBytes, MAX_JSON_FILE_BYTES, MAX_ZIP_FILE_BYTES, validateFilesClient } from "@/lib/upload-limits";
import type { AnalysisResult, AssetSummary, ParsedFileInsight } from "@/lib/types";

type ProjectRow = {
  id: number;
  clientName: string;
  industry: string;
  projectCode: string;
  consultantOwner: string;
  projectDate: string;
};

type PreviewSnippet = {
  index: number;
  fileName: string;
  preview: string;
  parsed_summary: ParsedFileInsight | null;
};

type PreviewResponse = {
  summary: AssetSummary;
  files: ParsedFileInsight[];
  previews: PreviewSnippet[];
  ingest: IngestReport;
};

export default function ImportPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [locale, setLocale] = useState<"de" | "en">("de");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [ingest, setIngest] = useState<IngestReport | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [assetMeta, setAssetMeta] = useState<{ assetId: number; projectId: number } | null>(null);
  const [loadingLabel, setLoadingLabel] = useState("Analyzing…");

  useEffect(() => {
    fetch("/api/settings/app")
      .then((r) => r.json())
      .then((d) => {
        if (d?.defaultLocale === "en" || d?.defaultLocale === "de") setLocale(d.defaultLocale);
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    fetch("/api/projects")
      .then((res) => res.json())
      .then((rows: ProjectRow[]) => {
        setProjects(rows);
        setProjectId((current) => (current === "" && rows.length ? String(rows[0].id) : current));
      })
      .catch(() => toast.error("Could not load projects."));
  }, []);

  const onFilesSelected = (list: File[]) => {
    const check = validateFilesClient(list);
    if (!check.ok) {
      toast.error(check.message);
      return;
    }
    setFiles(list);
    setPreview(null);
    setIngest(null);
    setResult(null);
    setAssetMeta(null);
  };

  const onPreview = async () => {
    if (!files.length) {
      toast.error("Choose at least one .json or .zip file.");
      return;
    }
    setPreviewLoading(true);
    setResult(null);
    setAssetMeta(null);
    const form = new FormData();
    files.forEach((file) => form.append("files", file));
    const response = await fetch("/api/import/preview", { method: "POST", body: form });
    setPreviewLoading(false);
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      if (body?.ingest) setIngest(body.ingest as IngestReport);
      toast.error(body?.error ?? "Preview failed.");
      setPreview(null);
      return;
    }
    const data = body as PreviewResponse;
    setPreview(data);
    setIngest(data.ingest);
    toast.success(`Preview ready — ${data.ingest.processed.length} file(s) parsed.`);
  };

  const onAnalyze = async () => {
    if (!files.length) {
      toast.error("Choose at least one file.");
      return;
    }
    if (!projectId) {
      toast.error("Select a project first.");
      return;
    }
    const settings = await fetch("/api/settings/llm").then((res) => res.json()).catch(() => null);
    setLoadingLabel(settings?.configured ? `Analyzing with ${settings.model}…` : "Running rule-based analysis…");
    setLoading(true);
    setResult(null);
    setAssetMeta(null);
    const form = new FormData();
    files.forEach((file) => form.append("files", file));
    form.set("projectId", projectId);
    form.set("locale", locale);
    const response = await fetch("/api/import/analyze", { method: "POST", body: form });
    setLoading(false);
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      if (body?.ingest) setIngest(body.ingest as IngestReport);
      toast.error(body?.error ?? "Analysis failed.");
      return;
    }
    const data = body as { analysis: AnalysisResult; assetId: number; projectId: number; ingest: IngestReport };
    setResult(data.analysis);
    setIngest(data.ingest);
    setAssetMeta({ assetId: data.assetId, projectId: data.projectId });
    toast.success(
      data.analysis.llmUnavailable
        ? "Saved — rule-based assessment (LLM unavailable)."
        : "Analysis saved to portfolio.",
    );
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHero
        compact
        title="Import & analyze SAC assets"
        subtitle="Upload SAC exports for deterministic readiness scoring and semantic translation. LLM narrative is optional."
      />

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-3">
          <CardTitle className="text-base">Project & upload</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="project">
                Project
              </label>
              <select
                id="project"
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <option value="">Select…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.clientName} — {p.projectCode}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="locale">
                Report language
              </label>
              <select
                id="locale"
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                value={locale}
                onChange={(e) => setLocale(e.target.value as "de" | "en")}
              >
                <option value="de">Deutsch</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>

          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/80 px-6 py-10 transition-colors hover:border-[#0a6ed1]/40 hover:bg-white">
            <UploadCloud className="mb-2 h-8 w-8 text-[#0a6ed1]" strokeWidth={1.5} />
            <span className="text-sm font-medium text-slate-800">Drop SAC .json or .zip files</span>
            <span className="mt-1 text-center text-xs text-slate-500">
              Max {formatBytes(MAX_JSON_FILE_BYTES)} per JSON · {formatBytes(MAX_ZIP_FILE_BYTES)} per ZIP
            </span>
            <input
              type="file"
              className="hidden"
              multiple
              accept=".json,.zip,application/json,application/zip"
              onChange={(e) => onFilesSelected(Array.from(e.target.files ?? []))}
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              {files.length ? `${files.length} file(s) selected` : "No files selected"}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onPreview} disabled={previewLoading || !files.length}>
                {previewLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Preview
              </Button>
              <Button size="sm" onClick={onAnalyze} disabled={loading || !files.length || !projectId}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {loading ? loadingLabel : "Run analysis"}
              </Button>
            </div>
          </div>

          {ingest ? <IngestReportCard report={ingest} /> : null}
        </CardContent>
      </Card>

      {preview ? (
        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-800">Parse preview</CardTitle>
            <p className="text-xs text-slate-500">
              Tier: <strong>{preview.summary.calculationComplexityTier}</strong>
              <InfoTip content={TERM_TOOLTIPS.complexityTier} className="ml-1" />
            </p>
          </CardHeader>
          <CardContent className="pb-4">
            <details className="group text-sm">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-slate-700">
                <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
                Portfolio metrics & raw JSON
              </summary>
              <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
                <p>
                  Stories: <strong>{preview.summary.stories}</strong>
                </p>
                <p>
                  Models: <strong>{preview.summary.models}</strong>
                </p>
                <p>
                  Planning: <strong>{preview.summary.planningModels}</strong>
                </p>
              </div>
            </details>
          </CardContent>
        </Card>
      ) : null}

      {result && assetMeta ? (
        <Card className="border-slate-200 shadow-md">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-lg">Assessment complete</CardTitle>
                <p className="mt-1 text-xs text-slate-500">
                  Asset #{assetMeta.assetId} · saved to portfolio
                </p>
              </div>
              <ConsultingExportButton assetId={assetMeta.assetId} />
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-5 text-sm">
            {result.llmUnavailable ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">
                <p className="flex items-center gap-1.5 font-semibold">
                  LLM unavailable — rule-based assessment saved
                  <InfoTip content={TERM_TOOLTIPS.rulesOnly} />
                </p>
                <p className="mt-1 text-xs">
                  Export the consulting package below — includes PDF, pillars, semantic log, and blueprints.
                </p>
              </div>
            ) : null}

            <div className="flex flex-wrap items-baseline gap-4 rounded-xl border border-[#0a6ed1]/15 bg-gradient-to-r from-sky-50/80 to-white px-5 py-4">
              <span className="flex items-baseline gap-1.5 text-4xl font-semibold tabular-nums text-[#0a6ed1]">
                {result.score}%
                <InfoTip content={TERM_TOOLTIPS.readinessScore} />
              </span>
              <span>
                Effort <strong>{result.effort}</strong>
              </span>
              <span className="text-xs text-slate-500">
                Complexity: {result.summary.calculationComplexityTier}
              </span>
            </div>

            {result.scoreCategories?.length ? (
              <ScorePillarsPanel categories={result.scoreCategories} score={result.score} />
            ) : null}

            <details className="rounded-xl border border-slate-200 bg-white">
              <summary className="cursor-pointer px-4 py-3 font-semibold text-slate-800">
                Executive summary
              </summary>
              <div className="space-y-3 border-t border-slate-100 px-4 py-3">
                <p className="leading-relaxed text-slate-800">{result.executiveSummary}</p>
                <ul className="list-inside list-disc space-y-1 text-slate-700">
                  {(result.keyFindings ?? []).slice(0, 5).map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>
            </details>

            {result.semanticTranslationLog?.length ? (
              <details className="rounded-xl border border-slate-200 bg-white">
                <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 font-semibold text-slate-800">
                  Semantic translation log ({result.semanticTranslationLog.length})
                  <InfoTip content={TERM_TOOLTIPS.semanticTranslation} />
                </summary>
                <ul className="max-h-72 space-y-3 overflow-auto border-t border-slate-100 px-4 py-3">
                  {result.semanticTranslationLog.slice(0, 12).map((row) => (
                    <li key={row.id} className="border-l-2 border-[#0a6ed1]/40 pl-3 text-xs">
                      <p className="font-mono text-slate-800">{row.sacPattern ?? row.sacConcept}</p>
                      <p className="font-mono text-[#0a6ed1]">→ {row.bdcPattern ?? row.datasphereTarget}</p>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}

            <details className="text-xs text-slate-600">
              <summary className="cursor-pointer font-medium text-slate-700">More downloads</summary>
              <div className="mt-2 flex flex-col gap-1.5 pl-1">
                <Link className="text-[#0a6ed1] hover:underline" href={`/generator?assetId=${assetMeta.assetId}`}>
                  Open data product generator →
                </Link>
                <a className="hover:underline" href={`/api/assets/${assetMeta.assetId}/report`}>
                  Executive PDF only
                </a>
                <a className="hover:underline" href={`/api/assets/${assetMeta.assetId}/report?rulesOnly=1`}>
                  Rules-only PDF
                </a>
              </div>
            </details>
          </CardContent>
        </Card>
      ) : null}

      {!projects.length ? (
        <p className="text-center text-sm text-slate-500">
          <Link href="/projects" className="font-medium text-[#0a6ed1] hover:underline">
            Create a project
          </Link>{" "}
          before running analysis.
        </p>
      ) : null}
    </div>
  );
}
