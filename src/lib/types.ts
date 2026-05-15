export type Severity = "low" | "medium" | "high";

export type IssueCategory =
  | "Deprecated Feature"
  | "Performance"
  | "Semantics"
  | "Data Product Candidate";

export interface AnalysisIssue {
  id: string;
  category: IssueCategory;
  title: string;
  explanation: string;
  recommendation: string;
  severity: Severity;
  /** Optional: model-assigned confidence 0–100 */
  confidence?: number;
}

export interface AssetSummary {
  stories: number;
  models: number;
  planningModels: number;
  calculations: number;
  dimensions: number;
  measures: number;
  pages: number;
  widgets: number;
  dataSources: number;
  classicCharts: number;
  liveConnections: number;
  hasSemanticLayer: boolean;
  /** Deterministic semantic scan totals (same export → same integers). */
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
  /** Portfolio calculation complexity tier (max across files). */
  calculationComplexityTier: "low" | "medium" | "high" | "critical";
  calculationComplexityIndex: number;
}

export interface ParsedFileInsight {
  fileName: string;
  assetType: "story" | "model" | "planning_model" | "unknown";
  storyName: string | null;
  title: string | null;
  pages: number;
  widgets: number;
  calculations: number;
  dimensions: number;
  measures: number;
  planningModel: boolean;
  dataSources: string[];
  usedModels: string[];
  classicCharts: number;
  liveConnections: number;
  hasSemanticLayer: boolean;
  /**
   * Deterministic scoring hints (same JSON → same counts).
   * Parsed via structural walk; not LLM-derived.
   */
  legacyOrClassicHints?: number;
  formulaLeafCount?: number;
  optimizedLayoutHints?: number;
  /** RESULTLOOKUP() occurrences in string formulas / definitions. */
  resultLookupHits?: number;
  /** Restricted measure / restrict expression signals. */
  restrictedMeasureHits?: number;
  /** Exception aggregation (e.g. FIRST, LAST, COUNT) style markers. */
  exceptionAggregationHits?: number;
  /** Planning-specific keys and tokens (versioning, allocation, locks, copy rules). */
  planningLogicHits?: number;
  dataLockHits?: number;
  versionHits?: number;
  allocationHits?: number;
  reverseSignHits?: number;
  planningSequenceHits?: number;
  associationHits?: number;
  hierarchyHits?: number;
  calculationComplexityTier?: "low" | "medium" | "high" | "critical";
  calculationComplexityIndex?: number;
  /** Top SAC patterns detected in this file (deterministic). */
  semanticPatterns?: Array<{ patternId: string; count: number; sample?: string }>;
}

export type MigrationEffort = "Low" | "Medium" | "High";

export interface ConfidenceItem {
  text: string;
  confidence: number;
}

export interface GanttTask {
  name: string;
  weekStart: number;
  durationWeeks: number;
}

export interface AnalysisUsage {
  promptTokens: number;
  completionTokens: number;
  estimatedCostUsd: number;
}

export type ScoreCategoryId =
  | "semantic_layer_maturity"
  | "calculation_complexity"
  | "planning_readiness"
  | "performance_optimization"
  | "governance_lineage";

/** Weighted pillar in the deterministic readiness model (weights sum to 100). */
export interface ScoreCategoryBreakdown {
  id: ScoreCategoryId;
  label: string;
  weightPercent: number;
  /** Sub-score 0–100 for this pillar before portfolio weighting. */
  pillarScore: number;
  /** Contribution to final score: round(pillarScore * weightPercent / 100). */
  weightedContribution: number;
  detail: string;
  recommendations: string[];
}

/** One deterministic row for SAC → BDC / Datasphere semantics (no LLM). */
export interface SemanticTranslationEntry {
  id: string;
  sacConcept: string;
  datasphereTarget: string;
  transformation: string;
  evidence: string;
  /** SAC Pattern → Recommended BDC/Datasphere Pattern (consultant headline). */
  sacPattern?: string;
  bdcPattern?: string;
  justification?: string;
  /** Concrete migration example (illustrative, not executed). */
  example?: string;
  recommendation?: string;
  severity?: Severity;
  category?: "Semantics" | "Planning" | "Performance" | "Governance" | "Calculation";
}

export interface AnalysisResult {
  score: number;
  effort: MigrationEffort;
  /** Rule engine version that produced `score` / `effort` (when hybrid analysis is enabled). */
  scoringEngineVersion?: string;
  /** Parser / semantic extract version (track score drift after code updates). */
  parserEngineVersion?: string;
  /** Deterministic SAC → Datasphere translation notes (same parse → same rows). */
  semanticTranslationLog?: SemanticTranslationEntry[];
  /** True when narrative was not produced by LLM (missing config or provider error). */
  llmUnavailable?: boolean;
  /** Deterministic score audit trail (same inputs → same breakdown). */
  scoreBreakdown?: Array<{ id: string; label: string; delta: number; detail: string }>;
  /** Weighted category model (v3): pillars that compose the readiness score. */
  scoreCategories?: ScoreCategoryBreakdown[];
  summary: AssetSummary;
  files?: ParsedFileInsight[];
  provider?: "openai" | "anthropic" | "grok" | "gemini";
  model?: string;
  executiveSummary?: string;
  keyFindings?: string[];
  recommendations?: string[];
  dataProductSuggestions?: string[];
  issues: AnalysisIssue[];
  migrationPath: string[];
  effortByWorkstream?: Record<string, MigrationEffort>;
  ganttTasks?: GanttTask[];
  enrichedFindings?: ConfidenceItem[];
  enrichedRecommendations?: ConfidenceItem[];
  locale?: "de" | "en";
  usage?: AnalysisUsage;
  trace?: {
    prompt: string;
    response: string;
  };
}

export interface LlmConfig {
  provider: "openai" | "anthropic" | "grok" | "gemini";
  model: string;
  encryptedApiKey: string;
  updatedAt: string;
}

export interface DataProductSemanticMapping {
  id: string;
  sacSignal: string;
  bdcArtifact: string;
  comment: string;
}

export interface DataProductBlueprint {
  factViews: string[];
  dimensionViews: string[];
  hierarchies: string[];
  associations: string[];
  /** Consultant-facing mapping rows with rationale. */
  semanticMappings: DataProductSemanticMapping[];
  datasphereJson: Record<string, unknown>;
}
