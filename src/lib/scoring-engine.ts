/**
 * Deterministic Migration Readiness scoring (v3).
 *
 * Final score = weighted sum of five pillars (weights sum to 100%):
 * - Semantic Layer Maturity 25%
 * - Calculation Complexity 25%
 * - Planning Readiness 20%
 * - Performance & Optimization 15%
 * - Governance & Lineage 15%
 *
 * Same parsed portfolio → same pillar scores → same final score. No LLM.
 */

import type {
  AssetSummary,
  MigrationEffort,
  ParsedFileInsight,
  ScoreCategoryBreakdown,
  ScoreCategoryId,
} from "@/lib/types";
import type { ComplexityTier } from "@/lib/sac-semantic-parser";

export const SCORING_ENGINE_VERSION = "bdc-pulse-rules-v3";

export type ScoreBreakdownLine = {
  id: string;
  label: string;
  delta: number;
  detail: string;
};

export type DeterministicScoreResult = {
  score: number;
  effort: MigrationEffort;
  effortByWorkstream: Record<string, MigrationEffort>;
  breakdown: ScoreBreakdownLine[];
  categories: ScoreCategoryBreakdown[];
  complexityIndex: number;
};

const CATEGORY_WEIGHTS: Record<ScoreCategoryId, number> = {
  semantic_layer_maturity: 25,
  calculation_complexity: 25,
  planning_readiness: 20,
  performance_optimization: 15,
  governance_lineage: 15,
};

function clampInt(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

export function sortedFilesForScoring(files: ParsedFileInsight[]): ParsedFileInsight[] {
  return [...files].sort((a, b) => a.fileName.localeCompare(b.fileName, "en"));
}

function aggregateMetrics(summary: AssetSummary, files: ParsedFileInsight[]) {
  const ordered = sortedFilesForScoring(files);
  let legacyHints = 0;
  let formulaLeaves = 0;
  let optimizedHints = 0;
  let unknownFiles = 0;

  for (const f of ordered) {
    legacyHints += f.legacyOrClassicHints ?? 0;
    formulaLeaves += f.formulaLeafCount ?? 0;
    optimizedHints += f.optimizedLayoutHints ?? 0;
    if (f.assetType === "unknown") unknownFiles += 1;
  }

  const calcTotal = summary.calculations + formulaLeaves;
  const widgetTotal = summary.widgets;
  const pageTotal = summary.pages;
  const densityTimes100 =
    pageTotal > 0 ? Math.floor((widgetTotal * 100) / pageTotal) : widgetTotal > 0 ? 9999 : 0;

  return {
    summary,
    legacyHints,
    formulaLeaves,
    optimizedHints,
    unknownFiles,
    calcTotal,
    densityTimes100,
  };
}

function tierPenalty(tier: ComplexityTier | undefined): number {
  switch (tier) {
    case "critical":
      return 35;
    case "high":
      return 22;
    case "medium":
      return 10;
    default:
      return 0;
  }
}

function scoreSemanticLayerMaturity(s: AssetSummary, m: ReturnType<typeof aggregateMetrics>): ScoreCategoryBreakdown {
  let score = 55;
  const recs: string[] = [];

  if (s.hasSemanticLayer) {
    score += 22;
    recs.push("Document shared dimensions and association paths in the data product catalog before cutover.");
  } else if (s.models > 0 || s.stories > 0) {
    score -= 18;
    recs.push("Run a semantic inventory workshop: confirm hierarchies, units, and currency handling in SAC vs target BDC model.");
  }

  const assoc = s.associationHits ?? 0;
  const hier = s.hierarchyHits ?? 0;
  score += Math.min(12, assoc * 2 + hier);
  if (assoc === 0 && hier === 0 && (s.models > 0 || s.dimensions > 5)) {
    recs.push("No explicit association/hierarchy markers in export — validate star-schema readiness manually.");
  }

  score -= Math.min(15, m.unknownFiles * 5);
  const pillarScore = clampInt(score, 0, 100);

  return {
    id: "semantic_layer_maturity",
    label: "Semantic Layer Maturity",
    weightPercent: CATEGORY_WEIGHTS.semantic_layer_maturity,
    pillarScore,
    weightedContribution: Math.round((pillarScore * CATEGORY_WEIGHTS.semantic_layer_maturity) / 100),
    detail: `Semantic layer=${s.hasSemanticLayer}; associations≈${assoc}; hierarchies≈${hier}; models=${s.models}; dimensions=${s.dimensions}.`,
    recommendations: recs.length ? recs : ["Maintain a governed dimension catalog in Datasphere with owner and refresh SLA."],
  };
}

function scoreCalculationComplexity(s: AssetSummary, m: ReturnType<typeof aggregateMetrics>): ScoreCategoryBreakdown {
  let score = 78;
  const recs: string[] = [];

  const rl = s.resultLookupHits;
  const rm = s.restrictedMeasureHits;
  const ex = s.exceptionAggregationHits;
  const tier = s.calculationComplexityTier;
  const idx = s.calculationComplexityIndex;

  score -= Math.min(28, Math.floor(rl * 1.8));
  score -= Math.min(18, Math.floor(rm * 1.2));
  score -= Math.min(16, Math.floor(ex * 1.5));
  score -= tierPenalty(tier);
  score -= Math.min(20, Math.floor(m.calcTotal / 8));
  score -= Math.min(8, Math.max(0, idx - 40) / 3);

  if (rl > 0) {
    recs.push(
      "Build a RESULTLOOKUP trace matrix: source model, target measure, join keys, and planned Datasphere calculated measure per row.",
    );
  }
  if (rm > 0) {
    recs.push("Convert each RESTRICT/FILTER context to a restricted measure with frozen filter predicates and sign-off from finance.");
  }
  if (ex > 0) {
    recs.push("Reconcile exception aggregation (FIRST/LAST/COUNT) against consumption view grain in SAC test stories.");
  }
  if (tier === "critical" || tier === "high") {
    recs.push("Schedule a formula walkthrough with SAC modeller + Datasphere architect before any automated transpile.");
  }

  const pillarScore = clampInt(score, 0, 100);
  return {
    id: "calculation_complexity",
    label: "Calculation Complexity",
    weightPercent: CATEGORY_WEIGHTS.calculation_complexity,
    pillarScore,
    weightedContribution: Math.round((pillarScore * CATEGORY_WEIGHTS.calculation_complexity) / 100),
    detail: `Complexity tier=${tier ?? "low"} (index ${idx}); RESULTLOOKUP=${rl}; restricted=${rm}; exception agg.=${ex}; formulas≈${m.calcTotal}.`,
    recommendations: recs.length ? recs : ["Keep calculation inventory in sync with data product version tags."],
  };
}

function scorePlanningReadiness(s: AssetSummary): ScoreCategoryBreakdown {
  let score = 70;
  const recs: string[] = [];

  const pl = s.planningLogicHits;
  const locks = s.dataLockHits;
  const vers = s.versionHits;
  const alloc = s.allocationHits;
  const rev = s.reverseSignHits;
  const seq = s.planningSequenceHits;

  score -= Math.min(24, s.planningModels * 10);
  score -= Math.min(20, Math.floor(pl / 3));
  score -= Math.min(12, locks * 2);
  score -= Math.min(10, alloc * 2);
  if (vers > 0 && locks === 0) {
    score -= 4;
    recs.push("Versions detected without explicit data-lock markers — confirm public/private version governance in BDC planning.");
  }
  if (rev > 0) {
    recs.push("Map reverse-sign behaviour to sign-flip rules in planning-enabled fact views and document in the translation log.");
  }
  if (seq > 0) {
    recs.push("Planning sequences should become ordered data actions with dependency graph and rollback strategy.");
  }
  if (s.planningModels > 0 || pl > 0) {
    recs.push("Define cutover strategy for allocations, copy rules, and input schedules in the BDC planning footprint.");
  }

  const pillarScore = clampInt(score, 0, 100);
  return {
    id: "planning_readiness",
    label: "Planning Readiness",
    weightPercent: CATEGORY_WEIGHTS.planning_readiness,
    pillarScore,
    weightedContribution: Math.round((pillarScore * CATEGORY_WEIGHTS.planning_readiness) / 100),
    detail: `Planning models=${s.planningModels}; signals=${pl}; locks=${locks}; versions=${vers}; allocation/copy=${alloc}; reverse sign=${rev}; sequences=${seq}.`,
    recommendations: recs.length ? recs : ["No heavy planning surface detected — standard analytic migration path applies."],
  };
}

function scorePerformanceOptimization(s: AssetSummary, m: ReturnType<typeof aggregateMetrics>): ScoreCategoryBreakdown {
  let score = 72;
  const recs: string[] = [];

  score += Math.min(10, s.liveConnections * 2);
  score -= Math.min(28, m.legacyHints * 3);
  score += Math.min(8, m.optimizedHints);
  if (m.densityTimes100 > 900) {
    score -= Math.min(12, Math.floor((m.densityTimes100 - 900) / 35));
    recs.push("High widget-per-page density — plan phased story regression and performance baselines on BDC consumption.");
  }
  if (m.legacyHints > 4) {
    recs.push("Replace classic chart types with optimized responsive widgets before UAT on BDC.");
  }
  if (s.liveConnections > 0) {
    recs.push("Model live-connection latency budgets and caching strategy for remote tables / BW bridge.");
  }

  const pillarScore = clampInt(score, 0, 100);
  return {
    id: "performance_optimization",
    label: "Performance & Optimization",
    weightPercent: CATEGORY_WEIGHTS.performance_optimization,
    pillarScore,
    weightedContribution: Math.round((pillarScore * CATEGORY_WEIGHTS.performance_optimization) / 100),
    detail: `Live connections=${s.liveConnections}; legacy hints=${m.legacyHints}; optimized hints=${m.optimizedHints}; widget density index=${m.densityTimes100}.`,
    recommendations: recs.length ? recs : ["Establish performance test pack with representative filters and drill paths."],
  };
}

function scoreGovernanceLineage(s: AssetSummary, m: ReturnType<typeof aggregateMetrics>): ScoreCategoryBreakdown {
  let score = 68;
  const recs: string[] = [];

  const sprawl = Math.max(0, s.dataSources - s.liveConnections * 2);
  score -= Math.min(18, sprawl * 2);
  score -= Math.min(12, m.unknownFiles * 4);
  if (s.dataSources > 8) {
    recs.push("Consolidate data source sprawl: target ≤N canonical facts with documented lineage from SAC models.");
  }
  if (m.unknownFiles > 0) {
    recs.push("Re-export unclassified JSON as typed SAC story/model/planning artefacts for complete governance coverage.");
  }
  recs.push("Attach data product owner, quality rules, and calculation lineage IDs to each migrated measure.");

  const pillarScore = clampInt(score, 0, 100);
  return {
    id: "governance_lineage",
    label: "Governance & Lineage",
    weightPercent: CATEGORY_WEIGHTS.governance_lineage,
    pillarScore,
    weightedContribution: Math.round((pillarScore * CATEGORY_WEIGHTS.governance_lineage) / 100),
    detail: `Data sources=${s.dataSources}; sprawl index=${sprawl}; unclassified files=${m.unknownFiles}.`,
    recommendations: recs,
  };
}

function complexityIndexFromCategories(categories: ScoreCategoryBreakdown[], m: ReturnType<typeof aggregateMetrics>): number {
  const calcPillar = categories.find((c) => c.id === "calculation_complexity")?.pillarScore ?? 50;
  const planPillar = categories.find((c) => c.id === "planning_readiness")?.pillarScore ?? 50;
  return (
    Math.floor((100 - calcPillar) * 1.4) +
    Math.floor((100 - planPillar) * 1.1) +
    m.legacyHints * 4 +
    m.unknownFiles * 12
  );
}

function effortFromIndex(idx: number, score: number): MigrationEffort {
  if (score < 38 || idx >= 200) return "High";
  if (score < 62 || idx >= 100) return "Medium";
  return "Low";
}

function workstreamEfforts(
  m: ReturnType<typeof aggregateMetrics>,
  s: AssetSummary,
  idx: number,
  score: number,
): Record<string, MigrationEffort> {
  const modelingHeavy =
    s.calculationComplexityTier === "critical" ||
    s.calculationComplexityTier === "high" ||
    m.calcTotal > 60;
  const governanceHeavy = s.dataSources > 10 || m.unknownFiles > 0;
  const testingHeavy = s.widgets + s.pages > 50 || m.legacyHints > 5;
  const changeHeavy = s.planningModels > 0 || (s.planningLogicHits ?? 0) > 8;

  const tier = (heavy: boolean): MigrationEffort => {
    if (heavy) return idx >= 150 || score < 50 ? "High" : "Medium";
    return effortFromIndex(idx, score);
  };

  return {
    modeling: tier(modelingHeavy),
    governance: tier(governanceHeavy),
    testing: tier(testingHeavy),
    changeManagement: tier(changeHeavy),
  };
}

export function computeDeterministicMigrationScore(
  summary: AssetSummary,
  files: ParsedFileInsight[],
): DeterministicScoreResult {
  const m = aggregateMetrics(summary, files);

  const categories: ScoreCategoryBreakdown[] = [
    scoreSemanticLayerMaturity(summary, m),
    scoreCalculationComplexity(summary, m),
    scorePlanningReadiness(summary),
    scorePerformanceOptimization(summary, m),
    scoreGovernanceLineage(summary, m),
  ];

  const rawSum = categories.reduce((acc, c) => acc + c.weightedContribution, 0);
  const finalScore = clampInt(rawSum, 0, 100);

  const breakdown: ScoreBreakdownLine[] = categories.map((c) => ({
    id: c.id,
    label: `${c.label} (${c.weightPercent}%)`,
    delta: c.weightedContribution,
    detail: `Pillar ${c.pillarScore}/100 → +${c.weightedContribution} pts. ${c.detail}`,
  }));

  if (breakdown.reduce((a, l) => a + l.delta, 0) !== finalScore) {
    breakdown.push({
      id: "score_rounding",
      label: "Rounding adjustment",
      delta: finalScore - breakdown.reduce((a, l) => a + l.delta, 0),
      detail: "Integer rounding on weighted pillars.",
    });
  }

  const idx = complexityIndexFromCategories(categories, m);
  const effort = effortFromIndex(idx, finalScore);
  const effortByWorkstream = workstreamEfforts(m, summary, idx, finalScore);

  return {
    score: finalScore,
    effort,
    effortByWorkstream,
    breakdown,
    categories,
    complexityIndex: idx,
  };
}
