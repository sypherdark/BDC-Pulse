import type { ScoreCategoryId } from "@/lib/types";

export const PRODUCT_TAGLINE =
  "Deterministic readiness scoring • Semantic translation • Professional migration deliverables";

export const PRODUCT_TITLE = "BDC Pulse — SAC to SAP Business Data Cloud Migration Accelerator";

export const PRODUCT_BADGE = "Built for SAP Analytics Consultants & Startups";

export const PILLAR_TOOLTIPS: Record<
  ScoreCategoryId,
  { label: string; weight: number; tooltip: string }
> = {
  semantic_layer_maturity: {
    label: "Semantic Layer Maturity",
    weight: 25,
    tooltip:
      "Measures how well SAC models, dimensions, and semantic constructs map to BDC/Datasphere artifacts — associations, hierarchies, and reusable views.",
  },
  calculation_complexity: {
    label: "Calculation Complexity",
    weight: 25,
    tooltip:
      "Scores formula depth, RESULTLOOKUP usage, restricted measures, and exception aggregation — the main drivers of rewrite effort in BDC.",
  },
  planning_readiness: {
    label: "Planning Readiness",
    weight: 20,
    tooltip:
      "Evaluates planning-specific patterns: versions, allocations, data locks, copy rules, and planning sequences that need explicit BDC planning design.",
  },
  performance_optimization: {
    label: "Performance & Optimization",
    weight: 15,
    tooltip:
      "Flags widget density, classic charts, live connections, and layout patterns that may become performance risks after migration.",
  },
  governance_lineage: {
    label: "Governance & Lineage",
    weight: 15,
    tooltip:
      "Assesses traceability signals — data sources, model usage, unknown asset types, and structural consistency for enterprise governance.",
  },
};

export const TERM_TOOLTIPS = {
  readinessScore:
    "Weighted sum of five deterministic pillars (25/25/20/15/15). Same SAC export always yields the same score.",
  semanticTranslation:
    "Rule-based SAC pattern → recommended BDC/Datasphere pattern mapping with justification — auditable without LLM.",
  rulesOnly:
    "Assessment saved using the versioned parser and scoring engine only; LLM narrative is optional.",
  complexityTier:
    "Portfolio-wide tier (low → critical) derived from calculation and planning signal density across uploaded files.",
} as const;
