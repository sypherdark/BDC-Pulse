import type { AssetRecord } from "@/db/schema";
import type {
  AnalysisIssue,
  AnalysisResult,
  AssetSummary,
  ConfidenceItem,
  GanttTask,
  ParsedFileInsight,
  ScoreCategoryBreakdown,
  SemanticTranslationEntry,
} from "@/lib/types";
import { decryptSecret } from "@/lib/crypto";

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (raw === null || raw === undefined || raw === "") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function emptySummary(): AssetSummary {
  return {
    stories: 0,
    models: 0,
    planningModels: 0,
    calculations: 0,
    dimensions: 0,
    measures: 0,
    pages: 0,
    widgets: 0,
    dataSources: 0,
    classicCharts: 0,
    liveConnections: 0,
    hasSemanticLayer: false,
    resultLookupHits: 0,
    restrictedMeasureHits: 0,
    exceptionAggregationHits: 0,
    planningLogicHits: 0,
    dataLockHits: 0,
    versionHits: 0,
    allocationHits: 0,
    reverseSignHits: 0,
    planningSequenceHits: 0,
    associationHits: 0,
    hierarchyHits: 0,
    calculationComplexityTier: "low",
    calculationComplexityIndex: 0,
  };
}

export function analysisFromAssetRow(asset: AssetRecord): AnalysisResult {
  const estimatedRaw = asset.llmEstimatedCostUsd;
  let estimatedCostUsd = 0;
  if (estimatedRaw !== null && estimatedRaw !== undefined && estimatedRaw !== "") {
    const n = Number.parseFloat(String(estimatedRaw));
    estimatedCostUsd = Number.isFinite(n) ? n : 0;
  }

  const hasPromptTokens = asset.llmPromptTokens != null;
  const hasCompletionTokens = asset.llmCompletionTokens != null;
  const hasCostHint = estimatedCostUsd > 0;
  const usage =
    hasPromptTokens || hasCompletionTokens || hasCostHint
      ? {
          promptTokens: asset.llmPromptTokens ?? 0,
          completionTokens: asset.llmCompletionTokens ?? 0,
          estimatedCostUsd,
        }
      : undefined;

  const rawSummary = parseJson<Partial<AssetSummary>>(asset.summaryJson, {});
  const summary: AssetSummary = { ...emptySummary(), ...rawSummary };

  let promptStored = asset.llmPrompt ?? "";
  let responseStored = asset.llmResponse ?? "";
  const encrypted = asset.llmAuditEncrypted === 1;
  if (encrypted && promptStored && responseStored) {
    try {
      promptStored = decryptSecret(promptStored);
      responseStored = decryptSecret(responseStored);
    } catch {
      promptStored = "[Could not decrypt audit payload — check BDC_PULSE_ENCRYPTION_SECRET.]";
      responseStored = "";
    }
  }

  const trace =
    promptStored || responseStored ? { prompt: promptStored, response: responseStored } : undefined;

  const rawBreakdown = parseJson<unknown>(asset.scoreBreakdownJson, []);
  let scoreBreakdown: NonNullable<AnalysisResult["scoreBreakdown"]> = [];
  let scoreCategories: ScoreCategoryBreakdown[] = [];
  let scoringEngineVersion: string | undefined;
  let parserEngineVersionStored: string | undefined;
  if (Array.isArray(rawBreakdown)) {
    scoreBreakdown = rawBreakdown as NonNullable<AnalysisResult["scoreBreakdown"]>;
  } else if (rawBreakdown && typeof rawBreakdown === "object" && "breakdown" in rawBreakdown) {
    const o = rawBreakdown as {
      version?: string;
      parserVersion?: string;
      breakdown?: AnalysisResult["scoreBreakdown"];
      categories?: ScoreCategoryBreakdown[];
    };
    scoringEngineVersion = o.version || undefined;
    parserEngineVersionStored = o.parserVersion || undefined;
    scoreBreakdown = Array.isArray(o.breakdown) ? o.breakdown : [];
    scoreCategories = Array.isArray(o.categories) ? o.categories : [];
  }

  const semanticTranslationLog = parseJson<SemanticTranslationEntry[]>(asset.semanticTranslationLogJson, []);

  const parserEngineVersion = asset.parserEngineVersion ?? parserEngineVersionStored;

  const llmUnavailable = asset.llmUnavailable === 1;

  return {
    score: asset.score,
    effort: asset.effort as AnalysisResult["effort"],
    scoringEngineVersion,
    parserEngineVersion: parserEngineVersion ?? undefined,
    semanticTranslationLog: semanticTranslationLog.length ? semanticTranslationLog : undefined,
    llmUnavailable: llmUnavailable ? true : undefined,
    scoreBreakdown: scoreBreakdown.length ? scoreBreakdown : undefined,
    scoreCategories: scoreCategories.length ? scoreCategories : undefined,
    summary,
    files: parseJson<ParsedFileInsight[]>(asset.filesJson, []),
    provider: (asset.provider ?? undefined) as AnalysisResult["provider"],
    model: asset.model ?? undefined,
    executiveSummary: asset.executiveSummary ?? undefined,
    keyFindings: parseJson<string[]>(asset.keyFindingsJson, []),
    recommendations: parseJson<string[]>(asset.recommendationsJson, []),
    dataProductSuggestions: parseJson<string[]>(asset.dataProductSuggestionsJson, []),
    issues: parseJson<AnalysisIssue[]>(asset.issuesJson, []),
    migrationPath: parseJson<string[]>(asset.migrationPathJson, []),
    effortByWorkstream:
      parseJson<Record<string, AnalysisResult["effort"]>>(asset.effortBreakdownJson, {}) ?? undefined,
    ganttTasks: parseJson<GanttTask[]>(asset.ganttJson, []),
    enrichedFindings: parseJson<ConfidenceItem[]>(asset.enrichedFindingsJson, []),
    enrichedRecommendations: parseJson<ConfidenceItem[]>(asset.enrichedRecommendationsJson, []),
    locale: (asset.reportLocale === "en" ? "en" : "de") as "de" | "en",
    usage,
    trace,
  };
}
