"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Pie, PieChart, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { ArchitectureDiagram } from "@/components/architecture-diagram";
import { ConsultingExportButton } from "@/components/consulting-export-button";
import { PageHero } from "@/components/page-hero";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DataProductBlueprint } from "@/lib/types";

type Asset = { id: number; name: string; score: number; blueprintJson: string | null };

export default function GeneratorPage() {
  const params = useSearchParams();
  const preselected = params.get("assetId");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetId, setAssetId] = useState<string>(preselected ?? "");
  const [loading, setLoading] = useState(false);
  const [blueprint, setBlueprint] = useState<DataProductBlueprint | null>(null);

  useEffect(() => {
    fetch("/api/assets")
      .then((res) => res.json())
      .then((rows: Asset[]) => {
        setAssets(rows);
        if (!preselected && rows[0]) setAssetId(String(rows[0].id));
      });
  }, [preselected]);

  const chartData = useMemo(() => {
    if (!blueprint) return [];
    return [
      { name: "Fact Views", value: blueprint.factViews.length, color: "#0a6ed1" },
      { name: "Dimension Views", value: blueprint.dimensionViews.length, color: "#1d4ed8" },
      { name: "Hierarchies", value: blueprint.hierarchies.length, color: "#334155" },
      { name: "Associations", value: blueprint.associations.length, color: "#0284c7" },
    ];
  }, [blueprint]);

  const generate = async () => {
    if (!assetId) return;
    setLoading(true);
    const res = await fetch(`/api/assets/${assetId}/generate`, { method: "POST" });
    setLoading(false);
    if (!res.ok) {
      toast.error("Generation failed");
      return;
    }
    const data = await res.json();
    setBlueprint(data.blueprint);
    toast.success("BDC data product blueprint generated.");
  };

  const numericAssetId = assetId ? Number(assetId) : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHero
        compact
        title="BDC / Datasphere data product generator"
        subtitle="Turn SAC analysis into fact views, dimensions, hierarchies, and consultant-ready semantic mappings."
      />

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="flex flex-col gap-4 pt-5 md:flex-row md:items-center md:flex-wrap">
          <select
            className="h-10 min-w-[220px] flex-1 rounded-md border border-slate-200 bg-white px-3 text-sm"
            value={assetId}
            onChange={(e) => setAssetId(e.target.value)}
          >
            <option value="">Select analyzed asset…</option>
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.name} ({asset.score}%)
              </option>
            ))}
          </select>
          <Button onClick={generate} disabled={loading || !assetId}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              "Generate blueprint"
            )}
          </Button>
          {numericAssetId > 0 ? (
            <ConsultingExportButton assetId={numericAssetId} variant="secondary" />
          ) : null}
        </CardContent>
      </Card>

      {blueprint ? (
        <>
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Semantic mappings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {(blueprint.semanticMappings ?? []).map((m) => (
                <div key={m.id} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                  <p className="font-semibold text-slate-900">{m.sacSignal}</p>
                  <p className="text-xs text-slate-600">
                    → <span className="font-medium">{m.bdcArtifact}</span>
                  </p>
                  <p className="mt-2 leading-relaxed text-slate-700">{m.comment}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Datasphere structure</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm md:grid-cols-2">
              <div className="break-words">
                <strong>Fact views:</strong> {blueprint.factViews.join(", ") || "—"}
              </div>
              <div className="break-words">
                <strong>Dimension views:</strong> {blueprint.dimensionViews.join(", ") || "—"}
              </div>
              <div className="break-words">
                <strong>Hierarchies:</strong> {blueprint.hierarchies.join(", ") || "—"}
              </div>
              <div className="break-words">
                <strong>Associations:</strong> {blueprint.associations.join(", ") || "—"}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Model composition</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartData} dataKey="value" nameKey="name" outerRadius={105} label>
                    {chartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <ArchitectureDiagram blueprint={blueprint} />

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Datasphere JSON</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">
                {JSON.stringify(blueprint.datasphereJson, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </>
      ) : (
        <p className="text-center text-sm text-slate-500">
          Select an asset and generate a blueprint, or export the full consulting package from Import or Portfolio.
        </p>
      )}
    </div>
  );
}
