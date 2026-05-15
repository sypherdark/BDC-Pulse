import type { AnalysisIssue, AnalysisResult, AssetSummary, ParsedFileInsight, SemanticTranslationEntry } from "@/lib/types";
import { computeDeterministicMigrationScore, SCORING_ENGINE_VERSION } from "@/lib/scoring-engine";
import { PARSER_ENGINE_VERSION } from "@/lib/parser-version";

function deterministicIssues(summary: AssetSummary, files: ParsedFileInsight[]): AnalysisIssue[] {
  const issues: AnalysisIssue[] = [];
  let idx = 0;
  const add = (partial: Omit<AnalysisIssue, "id">) => {
    idx += 1;
    issues.push({ id: `rule-${idx}`, ...partial });
  };

  if (summary.resultLookupHits > 0) {
    add({
      category: "Semantics",
      title: "RESULTLOOKUP / cross-model logic detected",
      explanation: `${summary.resultLookupHits} RESULTLOOKUP-style token(s) imply join paths that must be rebuilt as governed associations and calculated measures in Datasphere.`,
      recommendation: "Inventory each RESULTLOOKUP target model and map join keys before fact-view design.",
      severity: "high",
    });
  }

  if (summary.restrictedMeasureHits > 0) {
    add({
      category: "Semantics",
      title: "Restricted / FILTER-style measures",
      explanation: `${summary.restrictedMeasureHits} signal(s) for restricted or context-dependent measures.`,
      recommendation: "Define restricted measures explicitly in the semantic layer with documented filter context.",
      severity: "medium",
    });
  }

  if (summary.exceptionAggregationHits > 0) {
    add({
      category: "Semantics",
      title: "Exception aggregation footprint",
      explanation: `${summary.exceptionAggregationHits} exception-aggregation marker(s) affect consumption grain.`,
      recommendation: "Validate aggregation behaviour per dimension in target consumption views.",
      severity: "medium",
    });
  }

  if (summary.planningModels > 0 || summary.planningLogicHits > 0) {
    add({
      category: "Data Product Candidate",
      title: "Planning complexity",
      explanation: `${summary.planningModels} planning model(s); ${summary.planningLogicHits} planning token/key hit(s).`,
      recommendation: "Align versioning, locks, and allocations with BDC planning governance before cutover.",
      severity: "high",
    });
  }

  if (summary.dataLockHits > 0) {
    add({
      category: "Semantics",
      title: "Data locks detected",
      explanation: `${summary.dataLockHits} data-lock signal(s) — cutover must preserve lock matrix on versions/categories.`,
      recommendation: "Map SAC lock definitions to BDC planning locks and test unlock workflow with finance.",
      severity: "high",
    });
  }

  if (summary.calculationComplexityTier === "critical" || summary.calculationComplexityTier === "high") {
    add({
      category: "Semantics",
      title: `Calculation complexity: ${summary.calculationComplexityTier}`,
      explanation: `Portfolio complexity index ${summary.calculationComplexityIndex} — formula-heavy migration.`,
      recommendation: "Use phased waves and a RESULTLOOKUP / restricted-measure inventory before building views.",
      severity: "high",
    });
  }

  if (summary.liveConnections > 0) {
    add({
      category: "Performance",
      title: "Live connectivity",
      explanation: `${summary.liveConnections} live connection marker(s) in the export metadata.`,
      recommendation: "Plan BW bridge / remote table strategy and latency budgets for BDC consumption.",
      severity: "low",
    });
  }

  if (!summary.hasSemanticLayer && (summary.models > 0 || summary.stories > 0)) {
    add({
      category: "Semantics",
      title: "Limited semantic layer metadata",
      explanation: "Models or stories without strong semantic-layer markers in the JSON walk.",
      recommendation: "Confirm dimensions, hierarchies, and associations in SAC before Datasphere modelling.",
      severity: "medium",
    });
  }

  const legacyHints = files.reduce((a, f) => a + (f.legacyOrClassicHints ?? 0), 0);
  if (legacyHints > 0) {
    add({
      category: "Deprecated Feature",
      title: "Legacy / classic UI signals",
      explanation: `${legacyHints} legacy or classic chart/widget hint(s).`,
      recommendation: "Replace deprecated visualizations with optimized equivalents prior to migration testing.",
      severity: "medium",
    });
  }

  if (issues.length === 0) {
    add({
      category: "Data Product Candidate",
      title: "Portfolio parsed successfully",
      explanation: "No high-severity structural blockers were inferred from deterministic counters alone.",
      recommendation: "Proceed to workshop validation with functional owners and representative data slices.",
      severity: "low",
    });
  }

  return issues.slice(0, 12);
}

function ruleMigrationPath(locale: "de" | "en"): string[] {
  if (locale === "de") {
    return [
      "Semantische Extraktion und Migrations-Readiness-Score (regelbasiert) dokumentieren.",
      "SAC-Artefakte gegen Ziel-Datenprodukt im Datasphere Space abstimmen.",
      "Schrittweise Testmigration mit repräsentativen Stories und Kennzahlen durchführen.",
    ];
  }
  return [
    "Capture semantic extract and deterministic readiness score in the workpaper.",
    "Align SAC artefacts with the target Datasphere data product in a Space.",
    "Execute a phased test migration with representative stories and KPIs.",
  ];
}

export function buildRuleBasedAnalysisResult(input: {
  summary: AssetSummary;
  files: ParsedFileInsight[];
  translationLog: SemanticTranslationEntry[];
  locale: "de" | "en";
  llmUnavailableReason?: "not_configured" | "provider_error";
  providerErrorMessage?: string;
}): AnalysisResult {
  const { summary, files, translationLog, locale } = input;
  const rules = computeDeterministicMigrationScore(summary, files);
  const issues = deterministicIssues(summary, files);

  const isDe = locale === "de";
  let exec = isDe
    ? `Regelbasierte Bewertung (ohne LLM): Migrations-Readiness ${rules.score} %, Aufwand ${rules.effort}. Portfolio: ${summary.stories} Stories, ${summary.models} Modelle, ${summary.widgets} Widgets, ${summary.dataSources} Datenquellen.`
    : `Rule-based assessment (no LLM): Migration Readiness ${rules.score}%, effort ${rules.effort}. Portfolio: ${summary.stories} stor${summary.stories === 1 ? "y" : "ies"}, ${summary.models} model(s), ${summary.widgets} widgets, ${summary.dataSources} data source(s).`;

  if (input.llmUnavailableReason === "not_configured") {
    exec += isDe
      ? " LLM ist nicht konfiguriert — es wird nur die regelbasierte Bewertung angezeigt."
      : " LLM is not configured — showing rule-based assessment only.";
  } else if (input.llmUnavailableReason === "provider_error") {
    exec += isDe
      ? ` LLM-Analyse nicht verfügbar — es wird nur die regelbasierte Bewertung angezeigt.${input.providerErrorMessage ? ` (${input.providerErrorMessage})` : ""}`
      : ` LLM analysis unavailable – showing rule-based assessment only.${input.providerErrorMessage ? ` (${input.providerErrorMessage})` : ""}`;
  }

  const keyFindings: string[] = [];
  if (summary.resultLookupHits > 0) {
    keyFindings.push(
      isDe
        ? `RESULTLOOKUP: ${summary.resultLookupHits} Treffer — Cross-Model-Logik muss in Datasphere explizit modelliert werden.`
        : `RESULTLOOKUP: ${summary.resultLookupHits} hit(s) — cross-model logic must be explicitly modelled in Datasphere.`,
    );
  }
  if (summary.restrictedMeasureHits > 0) {
    keyFindings.push(
      isDe
        ? `Eingeschränkte Kennzahlen: ${summary.restrictedMeasureHits} Signal(e) — Filterkontext für Zielmeasures festlegen.`
        : `Restricted-style measures: ${summary.restrictedMeasureHits} signal(s) — lock down filter context for target measures.`,
    );
  }
  if (summary.exceptionAggregationHits > 0) {
    keyFindings.push(
      isDe
        ? `Ausnahmeaggregation: ${summary.exceptionAggregationHits} Marker — Aggregationskorn prüfen.`
        : `Exception aggregation: ${summary.exceptionAggregationHits} marker(s) — validate aggregation grain.`,
    );
  }
  if (summary.planningModels > 0 || summary.planningLogicHits > 0) {
    keyFindings.push(
      isDe
        ? `Planning: ${summary.planningModels} Modelle, ${summary.planningLogicHits} Struktur-/Token-Treffer — Versionierung und Sperren adressieren.`
        : `Planning: ${summary.planningModels} model(s), ${summary.planningLogicHits} structure/token hit(s) — address versioning and locks.`,
    );
  }
  if (keyFindings.length === 0) {
    keyFindings.push(
      isDe
        ? "Keine schweren semantischen Warnungen aus den deterministischen Zählern — fachliche Validierung bleibt erforderlich."
        : "No heavy semantic warnings from deterministic counters — business validation is still required.",
    );
  }

  const recommendations = keyFindings.map((_, i) =>
    isDe
      ? `Punkt ${i + 1} in einem Datasphere-Workshop mit Fachbereich und Datenbesitzer verifizieren.`
      : `Verify item ${i + 1} in a Datasphere workshop with business and data owners.`,
  );

  const dataProductSuggestions = isDe
    ? [
        "Fact Views für Kernfakten mit dokumentierten Join-Pfaden anlegen.",
        "Gemeinsame Dimensionen und Hierarchien als wiederverwendbare Views modellieren.",
        "Governance-Metadaten (Owner, Qualitätsregeln) im Datenprodukt hinterlegen.",
      ]
    : [
        "Author fact views for core facts with documented join paths.",
        "Model shared dimensions and hierarchies as reusable views.",
        "Attach governance metadata (owners, quality rules) to the data product.",
      ];

  return {
    score: rules.score,
    effort: rules.effort,
    scoringEngineVersion: SCORING_ENGINE_VERSION,
    parserEngineVersion: PARSER_ENGINE_VERSION,
    semanticTranslationLog: translationLog,
    llmUnavailable: true,
    scoreBreakdown: rules.breakdown,
    scoreCategories: rules.categories,
    summary,
    files,
    executiveSummary: exec,
    keyFindings,
    recommendations,
    dataProductSuggestions,
    issues,
    migrationPath: ruleMigrationPath(locale),
    effortByWorkstream: rules.effortByWorkstream,
    locale,
  };
}
