import type { AnalysisResult, DataProductBlueprint, DataProductSemanticMapping } from "@/lib/types";

function slug(s: string): string {
  return s.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "").toLowerCase() || "core";
}

/**
 * Builds a consultant-facing Datasphere / BDC blueprint from deterministic analysis artefacts.
 */
export function generateDataProduct(analysis: AnalysisResult): DataProductBlueprint {
  const s = analysis.summary;
  const base = slug(
    analysis.files?.[0]?.fileName?.replace(/\.json$/i, "") ?? `readiness_${analysis.score}`,
  );

  const factViews = [
    `fv_${base}_transactions`,
    `fv_${base}_planning_actuals`,
  ].filter((_, i) => (i === 0 ? true : s.planningModels > 0 || s.planningLogicHits > 0));

  const dimensionViews = [
    "dim_account",
    "dim_time_fiscal",
    "dim_org",
    s.measures > 40 ? "dim_measure_catalog" : "dim_measure_light",
  ].filter(Boolean);

  const hierarchies = ["h_org_company_cc", "h_time_fiscal_period"];
  const associations = [
    `${factViews[0]} → ${dimensionViews[0]} (account_id)`,
    `${factViews[0]} → ${dimensionViews[1]} (fiscal_period_id)`,
    `${factViews[0]} → ${dimensionViews[2]} (org_node_id)`,
  ];

  const mappings: DataProductSemanticMapping[] = [];

  if (s.resultLookupHits > 0) {
    mappings.push({
      id: "map-resultlookup",
      sacSignal: `RESULTLOOKUP (${s.resultLookupHits} token hits)`,
      bdcArtifact: `Calculated measures on ${factViews[0]}`,
      comment:
        "RESULTLOOKUP dependencies are expressed as calculated measures in the fact view with explicit join paths to bridge models; dimension context is documented per measure.",
    });
  }

  if (s.restrictedMeasureHits > 0) {
    mappings.push({
      id: "map-restricted",
      sacSignal: `Restricted / FILTER measures (${s.restrictedMeasureHits})`,
      bdcArtifact: "Restricted measures + SQL calculation views",
      comment:
        "SAC restrict semantics become Datasphere restricted measures or guarded calculation views with filter predicates frozen in the semantic translation log.",
    });
  }

  if (s.exceptionAggregationHits > 0) {
    mappings.push({
      id: "map-exception-agg",
      sacSignal: `Exception aggregation (${s.exceptionAggregationHits})`,
      bdcArtifact: "Consumption views + aggregation metadata",
      comment:
        "Exception aggregation flags are mirrored as documented aggregation behaviour on consumption artefacts with explicit grain per dimension.",
    });
  }

  if (s.planningModels > 0 || s.planningLogicHits > 0) {
    mappings.push({
      id: "map-planning",
      sacSignal: `Planning models / planning tokens (${s.planningModels} models, ${s.planningLogicHits} hits)`,
      bdcArtifact: "Planning-enabled Space + data actions",
      comment:
        "Versioning, locks, allocations, and copy rules inferred from SAC JSON map to governed planning areas and auditable data actions in BDC.",
    });
  }

  if (s.hasSemanticLayer) {
    mappings.push({
      id: "map-semantic",
      sacSignal: "Associations / hierarchies",
      bdcArtifact: "Shared dimensions in Data Product",
      comment:
        "SAC semantic layer constructs become reusable dimension views and association paths between facts and shared dimensions.",
    });
  }

  if (mappings.length === 0) {
    mappings.push({
      id: "map-default",
      sacSignal: "Portfolio metrics (no heavy semantic flags)",
      bdcArtifact: `${factViews[0]} starter fact view`,
      comment:
        "Baseline mapping uses portfolio counts to propose a starter fact view and standard time/org dimensions; extend after workshop validation.",
    });
  }

  mappings.sort((a, b) => a.id.localeCompare(b.id, "en"));

  return {
    factViews,
    dimensionViews,
    hierarchies,
    associations,
    semanticMappings: mappings,
    datasphereJson: {
      dataProductName: `bdc_pulse_${base}`,
      version: "2.0.0",
      parserEngineVersion: analysis.parserEngineVersion ?? null,
      scoringEngineVersion: analysis.scoringEngineVersion ?? null,
      readinessScore: analysis.score,
      entities: {
        factViews,
        dimensionViews,
        hierarchies,
        associations,
      },
      semanticMappings: mappings,
      translationLogRef: "See semantic_translation_log in export bundle / UI",
      governance: {
        owner: "Migration workstream (consultant-owned)",
        qualityChecks: ["semantic_consistency", "calculation_traceability", "planning_audit_trail"],
      },
    },
  };
}

