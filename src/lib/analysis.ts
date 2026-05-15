import type { AssetSummary, ParsedFileInsight } from "@/lib/types";
import { scanSacPayload } from "@/lib/sac-semantic-parser";
export { PARSER_ENGINE_VERSION } from "@/lib/parser-version";
export { scanSacPayload, type FileSemanticScan } from "@/lib/sac-semantic-parser";

type InputFile = { fileName: string; payload: unknown };
export type ParsedPortfolio = {
  files: ParsedFileInsight[];
  summary: AssetSummary;
  /** Per-file semantic scans (same order as `files`). */
  fileScans: ReturnType<typeof scanSacPayload>[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v) => typeof v === "string") as string[];
}

/** Lowercase match for legacy / deprecated UX (deterministic keyword hits). */
function legacyHit(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("classic") ||
    t.includes("legacy") ||
    t.includes("deprecated") ||
    t.includes("geo map legacy") ||
    t.includes("old chart")
  );
}

function optimizedHit(text: string): boolean {
  const t = text.toLowerCase();
  return t.includes("optimized") || t.includes("responsive") || t.includes("new chart");
}

function looksLikeFormula(text: string): boolean {
  const s = text.trim();
  if (s.startsWith("=")) return true;
  if (s.length < 8) return false;
  const u = s.toUpperCase();
  return (
    u.includes("RESULTLOOKUP") ||
    u.includes("LOOKUP(") ||
    u.includes("IF(") ||
    u.includes("AGGREGATE") ||
    u.includes("CALCULATION")
  );
}

function isPlanningStructureKey(keyLower: string): boolean {
  return (
    keyLower === "versioning" ||
    keyLower === "allocation" ||
    keyLower.includes("datalock") ||
    keyLower.includes("copyrule") ||
    keyLower.includes("planningsequence") ||
    keyLower.includes("publicversion") ||
    keyLower.includes("privateversion") ||
    (keyLower.includes("reverse") && keyLower.includes("sign")) ||
    keyLower === "dataaction" ||
    keyLower.includes("planningstep") ||
    keyLower.includes("dataslice")
  );
}

function inferAssetType(root: Record<string, unknown>): ParsedFileInsight["assetType"] {
  const typeField = typeof root.type === "string" ? (root.type as string).toLowerCase() : "";
  if (typeField.includes("planning")) return "planning_model";
  if (typeField === "story" || typeField.includes("story")) return "story";
  if (typeField === "model" || typeField.includes("model")) return "model";

  const keys = Object.keys(root).map((k) => k.toLowerCase());
  const has = (name: string) => keys.includes(name);
  const hasLike = (value: string) => keys.some((k) => k.includes(value));

  const storyScore =
    Number(has("storyname")) +
    Number(has("pages")) +
    Number(has("widgets")) +
    Number(has("charts")) +
    Number(hasLike("story"));

  const planningScore =
    Number(has("planningmodelname")) +
    Number(has("versioning")) +
    Number(has("allocation")) +
    Number(hasLike("planning"));

  const modelScore =
    Number(has("modelname")) +
    Number(has("dimensions")) +
    Number(has("measures")) +
    Number(has("calculations")) +
    Number(hasLike("datasource")) +
    Number(hasLike("model"));

  if (planningScore >= 2) return "planning_model";
  if (storyScore >= 2) return "story";
  if (modelScore >= 3) return "model";
  return "unknown";
}

function extractInsight(fileName: string, payload: unknown): ParsedFileInsight {
  /** Some exports wrap the document in `definition`, `content`, or `data`. */
  let doc: unknown = payload;
  const wrap = asRecord(payload);
  if (wrap) {
    if (wrap.definition && typeof wrap.definition === "object") doc = wrap.definition;
    else if (wrap.content && typeof wrap.content === "object") doc = wrap.content;
    else if (wrap.data && typeof wrap.data === "object") doc = wrap.data;
  }

  const inner = asRecord(doc);
  if (inner) {
    const nestedKeys = ["sacStory", "sacModel", "story", "model", "planningModel", "resource", "artifact"] as const;
    for (const nk of nestedKeys) {
      const v = inner[nk];
      if (v && typeof v === "object" && !Array.isArray(v)) {
        doc = v;
        break;
      }
    }
  }

  const rootForMeta =
    Array.isArray(doc) && doc.length > 0
      ? (asRecord(doc[0]) ?? {})
      : (asRecord(doc) ?? {});
  const counters = {
    pages: 0,
    widgets: 0,
    calculations: 0,
    dimensions: 0,
    measures: 0,
    classicCharts: 0,
    liveConnections: 0,
    hasSemanticLayer: false,
    legacyOrClassicHints: 0,
    formulaLeafCount: 0,
    optimizedLayoutHints: 0,
  };
  const semKeys = { plKeys: 0 };
  const dataSources = new Set<string>();
  const usedModels = new Set<string>();

  const bumpLegacy = (text: string) => {
    if (legacyHit(text)) counters.legacyOrClassicHints += 1;
  };

  const bumpOptimized = (text: string) => {
    if (optimizedHit(text)) counters.optimizedLayoutHints += 1;
  };

  const visit = (node: unknown, keyHint?: string) => {
    if (typeof node === "string") {
      const value = node;
      bumpLegacy(value);
      bumpOptimized(value);
      if (value.toLowerCase().includes("live connection") || value.toLowerCase().includes("livedata")) {
        counters.liveConnections += 1;
      }
      if (looksLikeFormula(value)) counters.formulaLeafCount += 1;
      if (value.toLowerCase().includes("semantic") || value.toLowerCase().includes("hierarchy")) {
        counters.hasSemanticLayer = true;
      }
      const lk = (keyHint ?? "").toLowerCase();
      if (lk.includes("datasource") || lk.includes("source") || lk === "connection") {
        dataSources.add(value);
      }
      if (lk.includes("model") && lk.includes("name")) usedModels.add(value);
      return;
    }

    if (typeof node === "number" || typeof node === "boolean") {
      return;
    }

    if (Array.isArray(node)) {
      const lk = (keyHint ?? "").toLowerCase();
      if (lk.includes("page")) counters.pages += node.length;
      if (lk.includes("widget") || lk.includes("chart")) counters.widgets += node.length;
      if (lk.includes("calculation") || lk.includes("formula")) counters.calculations += node.length;
      if (lk.includes("dimension")) counters.dimensions += node.length;
      if (lk.includes("measure") || lk.includes("kpi")) counters.measures += node.length;
      node.forEach((item) => visit(item, keyHint));
      return;
    }

    const record = asRecord(node);
    if (!record) return;

    for (const [key, value] of Object.entries(record)) {
      const lk = key.toLowerCase();

      if (isPlanningStructureKey(lk)) {
        semKeys.plKeys += 1;
      }

      if (lk === "semanticlayer" || lk === "hassemanticlayer") {
        if (value === true || value === "true" || value === 1) counters.hasSemanticLayer = true;
      }

      if (lk === "connectiontype" && typeof value === "string") {
        if (value.toLowerCase().includes("live")) counters.liveConnections += 1;
      }

      if (
        lk.includes("hierarchy") ||
        lk.includes("association") ||
        lk === "associations" ||
        lk === "hierarchies"
      ) {
        if (value === true) counters.hasSemanticLayer = true;
        if (Array.isArray(value) && value.length > 0) counters.hasSemanticLayer = true;
      }

      if (lk.includes("widget") && Array.isArray(value)) counters.widgets += value.length;
      if (lk.includes("chart") && Array.isArray(value)) {
        counters.widgets += value.length;
        for (const ch of value) {
          const cr = asRecord(ch);
          const ct = typeof cr?.chartType === "string" ? cr.chartType : typeof cr?.type === "string" ? cr.type : "";
          if (ct && legacyHit(ct)) {
            counters.legacyOrClassicHints += 1;
            counters.classicCharts += 1;
          }
          if (ct && optimizedHit(ct)) counters.optimizedLayoutHints += 1;
        }
      }
      if (lk.includes("page") && Array.isArray(value)) counters.pages += value.length;
      if (lk.includes("calculation") || lk.includes("formula")) {
        if (Array.isArray(value)) {
          counters.calculations += value.length;
          for (const item of value) {
            if (typeof item === "string" && looksLikeFormula(item)) counters.formulaLeafCount += 1;
            visit(item, key);
          }
          continue;
        }
        counters.calculations += 1;
      }
      if (lk.includes("dimension")) {
        counters.dimensions += Array.isArray(value) ? value.length : 1;
      }
      if (lk.includes("measure") || lk.includes("kpi")) {
        counters.measures += Array.isArray(value) ? value.length : 1;
      }
      if (lk.includes("datasource") || lk === "datasources" || lk.includes("source")) {
        if (typeof value === "string") dataSources.add(value);
        asStringArray(value).forEach((v) => dataSources.add(v));
        if (Array.isArray(value)) {
          for (const item of value) {
            const dr = asRecord(item);
            if (dr) {
              const dsName = dr.name ?? dr.id ?? dr.dataSource;
              if (typeof dsName === "string") dataSources.add(dsName);
            }
          }
        }
      }
      if (lk === "model" || lk === "models" || lk.includes("modelname")) {
        if (typeof value === "string") usedModels.add(value);
        asStringArray(value).forEach((v) => usedModels.add(v));
      }
      if (lk.includes("connection") && typeof value === "string" && value.toLowerCase().includes("live")) {
        counters.liveConnections += 1;
      }

      if (legacyHit(key)) counters.legacyOrClassicHints += 1;
      if (optimizedHit(key)) counters.optimizedLayoutHints += 1;

      visit(value, key);
    }
  };

  if (Array.isArray(doc)) {
    for (const el of doc) visit(el);
  } else {
    visit(doc);
  }

  const semanticScan = scanSacPayload(payload);
  const c = semanticScan.counters;
  const planningLogicHits = c.planningLogicHits + semKeys.plKeys;

  const storyName =
    (typeof rootForMeta.storyName === "string" && rootForMeta.storyName) ||
    (typeof rootForMeta.story === "string" && rootForMeta.story) ||
    null;
  const title = (typeof rootForMeta.title === "string" && rootForMeta.title) || null;
  const assetType = inferAssetType(rootForMeta);
  const planningModel = assetType === "planning_model";

  return {
    fileName,
    assetType,
    storyName,
    title,
    pages: counters.pages,
    widgets: counters.widgets,
    calculations: counters.calculations,
    dimensions: counters.dimensions,
    measures: counters.measures,
    planningModel,
    dataSources: [...dataSources].sort((a, b) => a.localeCompare(b, "en")),
    usedModels: [...usedModels].sort((a, b) => a.localeCompare(b, "en")),
    classicCharts: counters.classicCharts,
    liveConnections: counters.liveConnections,
    hasSemanticLayer: counters.hasSemanticLayer,
    legacyOrClassicHints: counters.legacyOrClassicHints,
    formulaLeafCount: counters.formulaLeafCount,
    optimizedLayoutHints: counters.optimizedLayoutHints,
    resultLookupHits: c.resultLookupHits,
    restrictedMeasureHits: c.restrictedMeasureHits,
    exceptionAggregationHits: c.exceptionAggregationHits,
    planningLogicHits,
    dataLockHits: c.dataLockHits,
    versionHits: c.versionHits,
    allocationHits: c.allocationHits,
    reverseSignHits: c.reverseSignHits,
    planningSequenceHits: c.planningSequenceHits,
    associationHits: c.associationHits,
    hierarchyHits: c.hierarchyHits,
    calculationComplexityTier: semanticScan.complexity.tier,
    calculationComplexityIndex: semanticScan.complexity.index,
    semanticPatterns: semanticScan.patternHits.map((h) => ({
      patternId: h.patternId,
      count: h.count,
      sample: h.sample,
    })),
  };
}

function summarizeInsights(files: ParsedFileInsight[]): AssetSummary {
  const tierOrder = { low: 0, medium: 1, high: 2, critical: 3 } as const;
  let maxTier: AssetSummary["calculationComplexityTier"] = "low";
  let maxIndex = 0;
  for (const f of files) {
    const t = f.calculationComplexityTier ?? "low";
    if (tierOrder[t] > tierOrder[maxTier]) maxTier = t;
    maxIndex = Math.max(maxIndex, f.calculationComplexityIndex ?? 0);
  }

  return {
    stories: files.filter((f) => f.assetType === "story").length,
    models: files.filter((f) => f.assetType === "model").length,
    planningModels: files.filter((f) => f.planningModel).length,
    calculations: files.reduce((acc, f) => acc + f.calculations, 0),
    dimensions: files.reduce((acc, f) => acc + f.dimensions, 0),
    measures: files.reduce((acc, f) => acc + f.measures, 0),
    pages: files.reduce((acc, f) => acc + f.pages, 0),
    widgets: files.reduce((acc, f) => acc + f.widgets, 0),
    dataSources: new Set(files.flatMap((f) => f.dataSources)).size,
    classicCharts: files.reduce((acc, f) => acc + f.classicCharts, 0),
    liveConnections: files.reduce((acc, f) => acc + f.liveConnections, 0),
    hasSemanticLayer: files.some((f) => f.hasSemanticLayer),
    resultLookupHits: files.reduce((acc, f) => acc + (f.resultLookupHits ?? 0), 0),
    restrictedMeasureHits: files.reduce((acc, f) => acc + (f.restrictedMeasureHits ?? 0), 0),
    exceptionAggregationHits: files.reduce((acc, f) => acc + (f.exceptionAggregationHits ?? 0), 0),
    planningLogicHits: files.reduce((acc, f) => acc + (f.planningLogicHits ?? 0), 0),
    dataLockHits: files.reduce((acc, f) => acc + (f.dataLockHits ?? 0), 0),
    versionHits: files.reduce((acc, f) => acc + (f.versionHits ?? 0), 0),
    allocationHits: files.reduce((acc, f) => acc + (f.allocationHits ?? 0), 0),
    reverseSignHits: files.reduce((acc, f) => acc + (f.reverseSignHits ?? 0), 0),
    planningSequenceHits: files.reduce((acc, f) => acc + (f.planningSequenceHits ?? 0), 0),
    associationHits: files.reduce((acc, f) => acc + (f.associationHits ?? 0), 0),
    hierarchyHits: files.reduce((acc, f) => acc + (f.hierarchyHits ?? 0), 0),
    calculationComplexityTier: maxTier,
    calculationComplexityIndex: maxIndex,
  };
}

/**
 * Parse SAC-like JSON exports into a stable portfolio view.
 * Input files are ordered by `fileName` so identical uploads in different order still match.
 */
export function parseSacAssets(inputFiles: InputFile[]): ParsedPortfolio {
  const ordered = [...inputFiles].sort((a, b) => a.fileName.localeCompare(b.fileName, "en"));
  const fileScans = ordered.map((file) => scanSacPayload(file.payload));
  const files = ordered.map((file) => extractInsight(file.fileName, file.payload));
  const summary = summarizeInsights(files);
  return { files, summary, fileScans };
}
