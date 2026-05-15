import type { AssetSummary, ParsedFileInsight, SemanticTranslationEntry, Severity } from "@/lib/types";
import type { SacPatternHit, SacPatternId } from "@/lib/sac-semantic-parser";
import { mergePortfolioPatternHits, type FileSemanticScan } from "@/lib/sac-semantic-parser";

type PatternPlaybook = {
  sacPattern: string;
  bdcPattern: string;
  datasphereTarget: string;
  transformation: string;
  justification: string;
  example: string;
  recommendation: string;
  severity: Severity;
  category: SemanticTranslationEntry["category"];
};

const PLAYBOOK: Record<SacPatternId, PatternPlaybook> = {
  result_lookup: {
    sacPattern: "RESULTLOOKUP([Model], [Measure], …)",
    bdcPattern: "Calculated measure on fact view + explicit join to bridge model",
    datasphereTarget: "Fact view calculated measure with association context",
    transformation:
      "Each RESULTLOOKUP resolves a tuple from another model at runtime. In Datasphere, model this as a calculated measure on the consuming fact view with join keys materialized in a bridge or shared dimension — never as an opaque script.",
    justification:
      "Cross-model reads are the highest-risk migration surface: wrong grain or missing join keys produce silent KPI drift.",
    example:
      "SAC: =RESULTLOOKUP([Sales], [Amount], [Date]=CurrentMember) → Datasphere: CM_AMOUNT_LOOKUP on FV_SALES with assoc to DIM_DATE and documented filter context.",
    recommendation:
      "Produce a RESULTLOOKUP inventory spreadsheet (source model, target measure, dimensions in scope) and sign off join paths before building views.",
    severity: "high",
    category: "Calculation",
  },
  cross_model_lookup: {
    sacPattern: "LOOKUP() / cross-model reference",
    bdcPattern: "Association + calculated column or SQL view join",
    datasphereTarget: "Analytic / SQL view with governed join",
    transformation:
      "Generic LOOKUP and cross-model references become explicit joins between entities in the data product, with cardinality validated per dimension.",
    justification: "Implicit lookups hide join cardinality; BDC requires explicit semantic relationships for lineage.",
    example:
      "SAC LOOKUP on [Product] → shared DIM_PRODUCT in Space with association FV_PLANNING → DIM_PRODUCT (product_id).",
    recommendation: "Validate many-to-one paths and avoid fan-out on planning versions.",
    severity: "medium",
    category: "Calculation",
  },
  restricted_measure: {
    sacPattern: "RESTRICTED_MEASURE / restricted measure type",
    bdcPattern: "Datasphere restricted measure",
    datasphereTarget: "Semantic layer restricted measure",
    transformation:
      "SAC restricted measures carry filter context that must be frozen as predicates on the target measure definition, with the same default aggregation behaviour.",
    justification: "Filter context is often embedded only in SAC UI metadata — losing it breaks parity with financial statements.",
    example:
      "SAC restricted measure Revenue (Actual) with version=Actual → restricted measure REV_ACTUAL with predicate VERSION=ACTUAL.",
    recommendation: "Pair each restricted measure with a test story widget that asserts the same numeric result pre/post migration.",
    severity: "high",
    category: "Semantics",
  },
  filter_context: {
    sacPattern: "RESTRICT() / FILTER() in formulas",
    bdcPattern: "Restricted measure or calculation view WHERE clause",
    datasphereTarget: "Calculation view / restricted measure",
    transformation:
      "Inline RESTRICT/FILTER blocks become either restricted measures or guarded SQL in calculation views, with predicates checked into the translation log.",
    justification: "Ad-hoc filters in formulas are difficult to discover without static analysis of export JSON.",
    example: "=RESTRICT([Amount], [Region]='EMEA') → restricted measure or view filter Region IN ('EMEA').",
    recommendation: "Extract all RESTRICT/FILTER fragments from exports and map to named restricted measures for reuse.",
    severity: "medium",
    category: "Calculation",
  },
  grandtotal: {
    sacPattern: "GRANDTOTAL()",
    bdcPattern: "Exception aggregation / subtotal rules in consumption",
    datasphereTarget: "Consumption view subtotal configuration",
    transformation:
      "Grandtotal semantics define how subtotals interact with exception aggregation — replicate in consumption layer metadata.",
    justification: "Subtotal behaviour differs between SAC runtime and SQL engines without explicit configuration.",
    example: "GRANDTOTAL([Margin]) → consumption view with defined subtotal dimension order and include/exclude rules.",
    recommendation: "Reconcile grandtotal vs exception aggregation order in a single test case per key story.",
    severity: "medium",
    category: "Calculation",
  },
  exception_aggregation: {
    sacPattern: "EXCEPTION_AGGREGATION / AGGREGATE(FIRST|LAST|…)",
    bdcPattern: "Exception aggregation on analytic/consumption view",
    datasphereTarget: "View-level aggregation exception metadata",
    transformation:
      "Exception aggregation types (FIRST, LAST, COUNT, etc.) must be documented per dimension hierarchy with the same grain as SAC stories.",
    justification: "Wrong exception type is a common source of planning vs actual mismatches after migration.",
    example: "EXCEPTION_AGGREGATION LAST on Time → consumption view TIME_EXCEPTION=LAST documented on fiscal period hierarchy.",
    recommendation: "Build golden-test queries per hierarchy where exception aggregation is used.",
    severity: "high",
    category: "Calculation",
  },
  nested_aggregate: {
    sacPattern: "Nested AGGREGATE(… AGGREGATE(…))",
    bdcPattern: "Layered calculation views or staged CTEs",
    datasphereTarget: "Stacked calculation views",
    transformation:
      "Deeply nested aggregates should be decomposed into staged calculation views with intermediate grain documented at each step.",
    justification: "Nested aggregates are hard to optimize and debug in a single SQL view.",
    example: "Inner AGGREGATE at day grain → CV_DAILY; outer AGGREGATE at month → CV_MONTHLY on top of CV_DAILY.",
    recommendation: "Refactor to ≤2 aggregation layers where possible before go-live.",
    severity: "high",
    category: "Calculation",
  },
  planning_sequence: {
    sacPattern: "Planning sequence / planningSequence",
    bdcPattern: "Ordered data actions in planning-enabled Space",
    datasphereTarget: "BDC planning data actions (sequenced)",
    transformation:
      "Planning sequences become explicit ordered data actions with dependencies, equivalent to SAC planning process steps.",
    justification: "Sequence order affects locks, versions, and allocation results — must be preserved.",
    example: "Sequence: Load drivers → Allocate → Post adjustments → three named data actions with dependency graph.",
    recommendation: "Document rollback and audit trail per sequence step for SOX environments.",
    severity: "high",
    category: "Planning",
  },
  data_lock: {
    sacPattern: "Data lock / dataLock",
    bdcPattern: "Planning data lock in BDC",
    datasphereTarget: "Planning area lock configuration",
    transformation:
      "SAC data locks map to BDC planning locks on version/category intersections; lock matrix must be reproduced.",
    justification: "Missing locks allow post-close edits that break compliance controls.",
    example: "Lock Actual/2024/Q4 for all entities → planning lock definition on VERSION=ACTUAL, PERIOD=Q4.",
    recommendation: "Align lock owners and unlock workflow with finance calendar before cutover.",
    severity: "high",
    category: "Planning",
  },
  version_public_private: {
    sacPattern: "Public / private version members",
    bdcPattern: "Version dimension in planning model",
    datasphereTarget: "Planning version dimension + access control",
    transformation:
      "Public and private versions become version dimension members with access policies in the planning footprint.",
    justification: "Version scope drives who sees which planning numbers — critical for collaboration models.",
    example: "Private.InputUser1 → version member with user-scoped write; Public.Forecast → shared read/write per role.",
    recommendation: "Map SAC version security to BDC identity and planning privileges.",
    severity: "medium",
    category: "Planning",
  },
  allocation: {
    sacPattern: "Allocation step / allocation rules",
    bdcPattern: "Allocation data action",
    datasphereTarget: "Planning allocation data action",
    transformation:
      "Allocation definitions become parameterized data actions with driver sources and targets traced in the semantic log.",
    justification: "Allocations are business-critical; driver logic must be regression-tested.",
    example: "Allocate HQ overhead by FTE drivers → data action ALLOC_OVH with driver view DV_FTE.",
    recommendation: "Keep driver tables in governed facts with lineage to HR or operational sources.",
    severity: "high",
    category: "Planning",
  },
  copy_rule: {
    sacPattern: "Copy rule / copyRule",
    bdcPattern: "Copy data action between versions",
    datasphereTarget: "Planning copy data action",
    transformation:
      "Copy rules translate to copy data actions (source version/category → target) with slice definitions.",
    justification: "Copy rules often underpin forecast initialization — errors propagate entire planning cycle.",
    example: "Copy Actual → Forecast baseline for open months → COPY_ACT_TO_FC data action with time slice.",
    recommendation: "Validate copied slices with row counts and checksums per entity.",
    severity: "medium",
    category: "Planning",
  },
  reverse_sign: {
    sacPattern: "Reverse sign / reverseSign",
    bdcPattern: "Sign flip in calculation or data action",
    datasphereTarget: "Measure sign convention + data action",
    transformation:
      "Reverse sign flags become explicit sign multipliers on measures or dedicated reversal steps in planning actions.",
    justification: "Sign conventions differ between accounts — must match financial reporting standards.",
    example: "Expense accounts stored positive with reverse sign for display → measure EXPENSE with signRule='invert'.",
    recommendation: "Document sign convention per account type in the data product dictionary.",
    severity: "medium",
    category: "Planning",
  },
  data_action: {
    sacPattern: "Data action / dataAction",
    bdcPattern: "BDC data action",
    datasphereTarget: "Planning or analytic data action",
    transformation:
      "SAC data actions map to BDC data actions with equivalent parameters, triggers, and audit logging.",
    justification: "Data actions encode business process automation beyond pure SQL.",
    example: "Clear input schedule → data action CLEAR_INPUT with scope on private versions.",
    recommendation: "Catalog all data actions with owner, schedule, and dependency on sequences.",
    severity: "medium",
    category: "Planning",
  },
  data_slice: {
    sacPattern: "Data slice / dataSlice",
    bdcPattern: "Planning slice scope on data action",
    datasphereTarget: "Slice definition on planning API",
    transformation:
      "Data slices define the tuple scope for planning operations — preserve as explicit slice parameters on each action.",
    justification: "Too-broad slices cause performance issues; too-narrow slices miss data.",
    example: "Slice: Entity=DE01, Version=Forecast, Time=2025.* → parameterized slice on forecast data action.",
    recommendation: "Performance-test largest slice patterns on representative data volumes.",
    severity: "low",
    category: "Planning",
  },
  currency_conversion: {
    sacPattern: "Currency conversion",
    bdcPattern: "Currency conversion in semantic / fact",
    datasphereTarget: "Currency conversion type on measure",
    transformation:
      "Currency conversion rules attach to measures with rate types and date keys aligned to group reporting.",
    justification: "FX logic must match group reporting standards (average vs closing rates).",
    example: "Amount in local currency with group currency EUR → conversion type GROUP_EUR on measure AMOUNT_LC.",
    recommendation: "Align rate tables with SAP Group Reporting or master data service.",
    severity: "medium",
    category: "Semantics",
  },
  unit_conversion: {
    sacPattern: "Unit conversion",
    bdcPattern: "Unit of measure on semantic measure",
    datasphereTarget: "UoM metadata",
    transformation: "Unit conversions become UoM metadata and optional conversion measures in the semantic layer.",
    justification: "Mixed units break aggregation without normalization.",
    example: "Quantity in KG vs TON → UoM column with conversion to base unit.",
    recommendation: "Standardize base units in the data product before story migration.",
    severity: "low",
    category: "Semantics",
  },
  time_dependency: {
    sacPattern: "Time navigation (YTD/QTD/PREVIOUS)",
    bdcPattern: "Time hierarchy + restricted time measures",
    datasphereTarget: "Time dimension + calculated time measures",
    transformation:
      "Time-relative functions become hierarchy-aware calculated measures or restricted measures on fiscal time.",
    justification: "Time intelligence is sensitive to fiscal calendar and incomplete periods.",
    example: "YTD([Revenue]) → calculated measure REV_YTD with time hierarchy FISCAL_PERIOD.",
    recommendation: "Validate YTD/QTD against SAC for boundary months and leap-week calendars.",
    severity: "medium",
    category: "Calculation",
  },
  calculated_dimension: {
    sacPattern: "Calculated dimension",
    bdcPattern: "Derived dimension attributes in dimension view",
    datasphereTarget: "Dimension view calculated attribute",
    transformation:
      "Calculated dimensions become derived attributes or hierarchies in dimension views, not ad-hoc story-only fields.",
    justification: "Story-only calculated dimensions do not migrate unless modeled semantically.",
    example: "Calculated dim 'Region Group' from Country → attribute REGION_GROUP on DIM_GEO.",
    recommendation: "Promote frequently used calculated dimensions to shared dimension views.",
    severity: "medium",
    category: "Semantics",
  },
  link_formula: {
    sacPattern: "LINK() formula",
    bdcPattern: "Link via association / blended model",
    datasphereTarget: "Multi-fact association or composite view",
    transformation:
      "LINK formulas imply blended queries — rebuild as governed associations or composite models with documented cardinality.",
    justification: "Blending without governance creates duplicate facts and ambiguous totals.",
    example: "LINK([Actuals],[Forecast]) → composite consumption view with clear grain per source fact.",
    recommendation: "Avoid many-to-many blends; prefer conformed dimensions.",
    severity: "medium",
    category: "Calculation",
  },
  semantic_association: {
    sacPattern: "Model association",
    bdcPattern: "Association in data product",
    datasphereTarget: "Entity association (fact ↔ dimension)",
    transformation:
      "SAC associations become first-class associations in the data product with cardinality and role names.",
    justification: "Associations are the backbone of correct join behaviour for RESULTLOOKUP and blends.",
    example: "Association Sales→Product on product_id → assoc FV_SALES__DIM_PRODUCT.",
    recommendation: "Review all associations for optional vs mandatory and default join direction.",
    severity: "medium",
    category: "Semantics",
  },
  hierarchy: {
    sacPattern: "Hierarchy definition",
    bdcPattern: "Shared hierarchy in dimension view",
    datasphereTarget: "Hierarchy view / parent-child",
    transformation:
      "SAC hierarchies map to Datasphere hierarchy views with stable parent-child keys and time-dependent flags if used.",
    justification: "Hierarchy drift breaks drill paths and planning rollups.",
    example: "Org hierarchy COMPANY→REGION→COST_CENTER → H_ORG in DIM_ORG.",
    recommendation: "Version hierarchies where HR or master data changes apply.",
    severity: "medium",
    category: "Semantics",
  },
  input_control: {
    sacPattern: "Input control",
    bdcPattern: "Parameter / variable in consumption",
    datasphereTarget: "Input parameter on story / view",
    transformation:
      "Input controls become consumption parameters with defaults and allowed value lists tied to dimensions.",
    justification: "Parameters must map to filter variables that perform on large facts.",
    example: "Input control Version → parameter P_VERSION bound to DIM_VERSION.",
    recommendation: "Limit high-cardinality input controls; prefer cascading filters.",
    severity: "low",
    category: "Performance",
  },
};

function entryFromHit(hit: SacPatternHit, scope: string, fileName?: string): SemanticTranslationEntry | null {
  const book = PLAYBOOK[hit.patternId];
  if (!book) return null;
  const slug = (fileName ?? "portfolio").replace(/[^a-zA-Z0-9]+/g, "_");
  return {
    id: `sem-${slug}-${hit.patternId}`,
    sacConcept: book.sacPattern + (fileName ? ` (${fileName})` : ""),
    datasphereTarget: book.datasphereTarget,
    transformation: book.transformation,
    evidence: `${hit.count} occurrence(s)${hit.sample ? ` — e.g. "${hit.sample}"` : ""}. Scope: ${scope}.`,
    sacPattern: book.sacPattern,
    bdcPattern: book.bdcPattern,
    justification: book.justification,
    example: book.example,
    recommendation: book.recommendation,
    severity: book.severity,
    category: book.category,
  };
}

/**
 * Rich deterministic SAC → Datasphere translation log (consultant-grade).
 */
export function buildSemanticTranslationLog(
  files: ParsedFileInsight[],
  summary: AssetSummary,
  fileScans?: FileSemanticScan[],
): SemanticTranslationEntry[] {
  const ordered = [...files].sort((a, b) => a.fileName.localeCompare(b.fileName, "en"));
  const rows: SemanticTranslationEntry[] = [];
  const seen = new Set<string>();

  const push = (e: SemanticTranslationEntry | null) => {
    if (!e || seen.has(e.id)) return;
    seen.add(e.id);
    rows.push(e);
  };

  const portfolioHits =
    fileScans && fileScans.length > 0
      ? mergePortfolioPatternHits(fileScans)
      : ordered.flatMap(
          (f) =>
            (f.semanticPatterns ?? []).map((p) => ({
              patternId: p.patternId as SacPatternId,
              count: p.count,
              sample: p.sample,
              source: "formula" as const,
            })),
        );

  const sortedHits = [...portfolioHits].sort((a, b) => {
    const wa = PLAYBOOK[a.patternId]?.severity === "high" ? 0 : 1;
    const wb = PLAYBOOK[b.patternId]?.severity === "high" ? 0 : 1;
    if (wa !== wb) return wa - wb;
    return b.count - a.count;
  });

  for (const hit of sortedHits) {
    push(entryFromHit(hit, "Portfolio", undefined));
  }

  if (summary.hasSemanticLayer && !sortedHits.some((h) => h.patternId === "semantic_association")) {
    push({
      id: "sem-portfolio-semantic-maturity",
      sacConcept: "Semantic layer / associations (portfolio)",
      datasphereTarget: "Shared dimensions & associations in Data Product",
      transformation:
        "Consolidate SAC associations and hierarchies into a versioned data product with reusable dimension views.",
      evidence: "Semantic layer markers present in export JSON.",
      sacPattern: "Shared dimensions + associations",
      bdcPattern: "Datasphere data product entity model",
      justification: "A mature semantic layer reduces duplicate facts and eases RESULTLOOKUP retirement.",
      example: "One DIM_TIME, DIM_ORG, DIM_ACCOUNT reused across all fact views in the Space.",
      recommendation: "Publish a semantic ER diagram for sign-off before building fact views.",
      severity: "medium",
      category: "Semantics",
    });
  }

  if (summary.calculationComplexityTier === "critical" || summary.calculationComplexityTier === "high") {
    push({
      id: "sem-portfolio-complexity-tier",
      sacConcept: `Calculation complexity tier: ${summary.calculationComplexityTier}`,
      datasphereTarget: "Phased migration waves (calculation-heavy)",
      transformation:
        "High/critical complexity portfolios should migrate in waves: semantic foundation → core formulas → planning → stories.",
      evidence: `Portfolio complexity index ${summary.calculationComplexityIndex}; tier ${summary.calculationComplexityTier}.`,
      sacPattern: "Monolithic SAC model with heavy formulas",
      bdcPattern: "Layered data product + staged calculation views",
      justification: "Big-bang migration of critical formulas carries unacceptable regression risk.",
      example: "Wave 1: dimensions + actuals; Wave 2: RESULTLOOKUP measures; Wave 3: planning sequences.",
      recommendation: "Assign a dedicated formula workstream lead with SAC modeller pairing.",
      severity: "high",
      category: "Calculation",
    });
  }

  for (const f of ordered) {
    const scanIdx = fileScans ? ordered.findIndex((x) => x.fileName === f.fileName) : -1;
    const scan = scanIdx >= 0 ? fileScans?.[scanIdx] : undefined;
    const hits = scan?.patternHits ?? [];
    const top = [...hits].sort((a, b) => b.count - a.count).slice(0, 5);
    for (const hit of top) {
      push(entryFromHit(hit, `File: ${f.fileName}`, f.fileName));
    }
  }

  rows.sort((a, b) => {
    const sev = (s: Severity) => (s === "high" ? 0 : s === "medium" ? 1 : 2);
    const d = sev(a.severity ?? "medium") - sev(b.severity ?? "medium");
    if (d !== 0) return d;
    return a.id.localeCompare(b.id, "en");
  });

  return rows;
}
