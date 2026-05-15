/**
 * Advanced deterministic SAC semantic extraction (formulas + JSON structure).
 * Same input → same pattern hits and complexity profile.
 */

export type SacPatternId =
  | "result_lookup"
  | "cross_model_lookup"
  | "restricted_measure"
  | "filter_context"
  | "exception_aggregation"
  | "nested_aggregate"
  | "planning_sequence"
  | "data_lock"
  | "version_public_private"
  | "allocation"
  | "copy_rule"
  | "reverse_sign"
  | "data_action"
  | "data_slice"
  | "currency_conversion"
  | "unit_conversion"
  | "time_dependency"
  | "calculated_dimension"
  | "link_formula"
  | "grandtotal"
  | "semantic_association"
  | "hierarchy"
  | "input_control";

export type ComplexityTier = "low" | "medium" | "high" | "critical";

export type SacPatternHit = {
  patternId: SacPatternId;
  count: number;
  /** Representative snippet (truncated, deterministic). */
  sample?: string;
  source: "formula" | "structure" | "metadata";
};

export type CalculationComplexityProfile = {
  tier: ComplexityTier;
  /** 0–100 deterministic complexity index from pattern weights. */
  index: number;
  formulaCount: number;
  nestedDepthEstimate: number;
  crossModelRefs: number;
  planningSurface: number;
  patternHits: SacPatternHit[];
};

export type FileSemanticScan = {
  patternHits: SacPatternHit[];
  complexity: CalculationComplexityProfile;
  /** Flat counters for legacy scoring / summary rollups. */
  counters: {
    resultLookupHits: number;
    restrictedMeasureHits: number;
    exceptionAggregationHits: number;
    planningLogicHits: number;
    dataLockHits: number;
    versionHits: number;
    allocationHits: number;
    reverseSignHits: number;
    planningSequenceHits: number;
    associationHits: number;
    hierarchyHits: number;
  };
};

const PATTERN_RULES: Array<{
  id: SacPatternId;
  re: RegExp;
  weight: number;
  source: SacPatternHit["source"];
  sampleMax?: number;
}> = [
  { id: "result_lookup", re: /RESULTLOOKUP\s*\(/gi, weight: 8, source: "formula", sampleMax: 120 },
  { id: "cross_model_lookup", re: /LOOKUP\s*\(|CROSSMODEL|MODEL\s*\[/gi, weight: 5, source: "formula", sampleMax: 100 },
  { id: "restricted_measure", re: /RESTRICTED_MEASURE|restrictedMeasure|"type"\s*:\s*"restricted"/gi, weight: 6, source: "formula", sampleMax: 80 },
  { id: "filter_context", re: /\bRESTRICT\s*\(|FILTER\s*\(|"filter"\s*:\s*\{/gi, weight: 4, source: "formula", sampleMax: 80 },
  { id: "grandtotal", re: /GRANDTOTAL\s*\(|"grandTotal"/gi, weight: 3, source: "formula" },
  {
    id: "exception_aggregation",
    re: /EXCEPTION_AGGREGATION|exceptionAggregation|"exceptionAggregation"|AGGREGATE\s*\(\s*["']?(FIRST|LAST|COUNT|AVERAGE|MIN|MAX)/gi,
    weight: 7,
    source: "formula",
    sampleMax: 90,
  },
  { id: "nested_aggregate", re: /AGGREGATE\s*\([^)]*AGGREGATE/gi, weight: 6, source: "formula", sampleMax: 100 },
  { id: "planning_sequence", re: /PLANNING_SEQUENCE|planningSequence|"planningSequence"/gi, weight: 6, source: "structure" },
  { id: "data_lock", re: /DATA_LOCK|dataLock|"dataLock"|"lockStatus"/gi, weight: 5, source: "structure" },
  { id: "version_public_private", re: /PUBLIC_VERSION|PRIVATE_VERSION|publicVersion|privateVersion|"versionId"/gi, weight: 4, source: "structure" },
  { id: "allocation", re: /\bALLOCATION\b|"allocationStep"|allocationRules/gi, weight: 5, source: "structure" },
  { id: "copy_rule", re: /COPY_RULE|copyRule|"copyRule"/gi, weight: 4, source: "structure" },
  { id: "reverse_sign", re: /REVERSE_SIGN|reverseSign|"reverseSign"/gi, weight: 4, source: "structure" },
  { id: "data_action", re: /DATAACTION|dataAction|"dataAction"/gi, weight: 5, source: "structure" },
  { id: "data_slice", re: /DATA_SLICE|dataSlice|"dataSlice"/gi, weight: 3, source: "structure" },
  { id: "currency_conversion", re: /CURRENCY_CONVERSION|currencyConversion|"currencyConversion"/gi, weight: 4, source: "formula" },
  { id: "unit_conversion", re: /UNIT_CONVERSION|unitConversion/gi, weight: 3, source: "formula" },
  { id: "time_dependency", re: /TIMENAVIGATION|PREVIOUS\(|NEXT\(|YTD|QTD|MTD/gi, weight: 4, source: "formula" },
  { id: "calculated_dimension", re: /CALCULATED_DIMENSION|calculatedDimension/gi, weight: 5, source: "structure" },
  { id: "link_formula", re: /LINK\s*\(|"linkFormula"/gi, weight: 4, source: "formula" },
  { id: "input_control", re: /INPUTCONTROL|inputControl|"inputControl"/gi, weight: 2, source: "structure" },
];

const STRUCTURE_KEY_MAP: Array<{ keyTest: (k: string) => boolean; patternId: SacPatternId }> = [
  { keyTest: (k) => k.includes("datalock"), patternId: "data_lock" },
  { keyTest: (k) => k.includes("planningsequence"), patternId: "planning_sequence" },
  { keyTest: (k) => k.includes("publicversion") || k.includes("privateversion"), patternId: "version_public_private" },
  { keyTest: (k) => k === "versioning" || k.includes("versionmember"), patternId: "version_public_private" },
  { keyTest: (k) => k === "allocation" || k.includes("allocationstep"), patternId: "allocation" },
  { keyTest: (k) => k.includes("copyrule"), patternId: "copy_rule" },
  { keyTest: (k) => k.includes("reverse") && k.includes("sign"), patternId: "reverse_sign" },
  { keyTest: (k) => k === "dataaction" || k.includes("dataaction"), patternId: "data_action" },
  { keyTest: (k) => k.includes("dataslice"), patternId: "data_slice" },
  { keyTest: (k) => k === "associations" || k.includes("association"), patternId: "semantic_association" },
  { keyTest: (k) => k === "hierarchies" || k.includes("hierarchy"), patternId: "hierarchy" },
];

function truncateSample(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function mergeHit(map: Map<SacPatternId, SacPatternHit>, hit: SacPatternHit) {
  const prev = map.get(hit.patternId);
  if (!prev) {
    map.set(hit.patternId, { ...hit });
    return;
  }
  prev.count += hit.count;
  if (!prev.sample && hit.sample) prev.sample = hit.sample;
}

function scanString(text: string, map: Map<SacPatternId, SacPatternHit>) {
  for (const rule of PATTERN_RULES) {
    const matches = text.match(rule.re);
    if (!matches?.length) continue;
    const sample = rule.sampleMax ? truncateSample(matches[0], rule.sampleMax) : undefined;
    mergeHit(map, {
      patternId: rule.id,
      count: matches.length,
      sample,
      source: rule.source,
    });
  }
}

function estimateNestedDepth(text: string): number {
  let depth = 0;
  let max = 0;
  for (const ch of text) {
    if (ch === "(") {
      depth += 1;
      max = Math.max(max, depth);
    } else if (ch === ")") {
      depth = Math.max(0, depth - 1);
    }
  }
  return max;
}

function buildComplexity(hits: SacPatternHit[], formulaLeaves: number): CalculationComplexityProfile {
  let index = 0;
  let crossModelRefs = 0;
  let planningSurface = 0;

  for (const h of hits) {
    const rule = PATTERN_RULES.find((r) => r.id === h.patternId);
    const w = rule?.weight ?? 3;
    index += h.count * w;
    if (h.patternId === "result_lookup" || h.patternId === "cross_model_lookup") {
      crossModelRefs += h.count;
    }
    if (
      h.patternId === "planning_sequence" ||
      h.patternId === "data_lock" ||
      h.patternId === "allocation" ||
      h.patternId === "data_action"
    ) {
      planningSurface += h.count;
    }
  }

  index += Math.min(40, formulaLeaves * 2);
  const nestedDepthEstimate = Math.min(
    12,
    hits.reduce((m, h) => {
      if (h.sample) return Math.max(m, estimateNestedDepth(h.sample));
      return m;
    }, 0),
  );
  if (nestedDepthEstimate > 3) index += (nestedDepthEstimate - 3) * 4;

  const capped = Math.min(100, index);
  let tier: ComplexityTier = "low";
  if (capped >= 75 || crossModelRefs >= 8 || planningSurface >= 10) tier = "critical";
  else if (capped >= 50 || crossModelRefs >= 4 || planningSurface >= 5) tier = "high";
  else if (capped >= 25 || crossModelRefs >= 1 || planningSurface >= 2) tier = "medium";

  return {
    tier,
    index: capped,
    formulaCount: formulaLeaves,
    nestedDepthEstimate,
    crossModelRefs,
    planningSurface,
    patternHits: [...hits].sort((a, b) => a.patternId.localeCompare(b.patternId, "en")),
  };
}

function hitsToCounters(hits: SacPatternHit[]): FileSemanticScan["counters"] {
  const sum = (ids: SacPatternId[]) =>
    hits.filter((h) => ids.includes(h.patternId)).reduce((a, h) => a + h.count, 0);

  return {
    resultLookupHits: sum(["result_lookup"]),
    restrictedMeasureHits: sum(["restricted_measure", "filter_context", "grandtotal"]),
    exceptionAggregationHits: sum(["exception_aggregation", "nested_aggregate"]),
    planningLogicHits: sum([
      "planning_sequence",
      "data_lock",
      "version_public_private",
      "allocation",
      "copy_rule",
      "reverse_sign",
      "data_action",
      "data_slice",
    ]),
    dataLockHits: sum(["data_lock"]),
    versionHits: sum(["version_public_private"]),
    allocationHits: sum(["allocation", "copy_rule"]),
    reverseSignHits: sum(["reverse_sign"]),
    planningSequenceHits: sum(["planning_sequence"]),
    associationHits: sum(["semantic_association"]),
    hierarchyHits: sum(["hierarchy"]),
  };
}

/** Walk SAC JSON and collect semantic pattern hits + complexity profile. */
export function scanSacPayload(payload: unknown): FileSemanticScan {
  const map = new Map<SacPatternId, SacPatternHit>();
  let formulaLeaves = 0;

  const visit = (node: unknown, keyHint?: string) => {
    if (typeof node === "string") {
      const s = node.trim();
      if (s.startsWith("=") || s.length >= 12) {
        scanString(s, map);
        if (/RESULTLOOKUP|RESTRICT|AGGREGATE|LOOKUP\s*\(/i.test(s)) formulaLeaves += 1;
      } else if (s.length >= 6) {
        scanString(s, map);
      }
      return;
    }
    if (typeof node !== "object" || node === null) return;

    if (Array.isArray(node)) {
      for (const item of node) visit(item, keyHint);
      return;
    }

    const record = node as Record<string, unknown>;
    for (const [key, value] of Object.entries(record)) {
      const lk = key.toLowerCase();
      for (const sk of STRUCTURE_KEY_MAP) {
        if (sk.keyTest(lk)) {
          mergeHit(map, { patternId: sk.patternId, count: 1, source: "structure" });
        }
      }
      if (lk.includes("formula") || lk.includes("calculation") || lk === "expression") {
        if (typeof value === "string") {
          scanString(value, map);
          formulaLeaves += 1;
        }
      }
      visit(value, key);
    }
  };

  visit(payload);

  const patternHits = [...map.values()].sort((a, b) => a.patternId.localeCompare(b.patternId, "en"));
  const complexity = buildComplexity(patternHits, formulaLeaves);
  return { patternHits, complexity, counters: hitsToCounters(patternHits) };
}

/** Merge file scans into portfolio-level pattern list (stable order). */
export function mergePortfolioPatternHits(scans: FileSemanticScan[]): SacPatternHit[] {
  const map = new Map<SacPatternId, SacPatternHit>();
  for (const scan of scans) {
    for (const h of scan.patternHits) mergeHit(map, h);
  }
  return [...map.values()].sort((a, b) => a.patternId.localeCompare(b.patternId, "en"));
}

export function portfolioComplexityTier(scans: FileSemanticScan[]): ComplexityTier {
  const maxIndex = scans.reduce((m, s) => Math.max(m, s.complexity.index), 0);
  if (maxIndex >= 75) return "critical";
  if (maxIndex >= 50) return "high";
  if (maxIndex >= 25) return "medium";
  return "low";
}
