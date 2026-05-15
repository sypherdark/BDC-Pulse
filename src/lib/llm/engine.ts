import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import type { AnalysisIssue, AnalysisResult, AssetSummary, ParsedFileInsight } from "@/lib/types";
import { estimateUsd } from "@/lib/llm-pricing";
import { computeDeterministicMigrationScore, SCORING_ENGINE_VERSION } from "@/lib/scoring-engine";
import { PARSER_ENGINE_VERSION } from "@/lib/parser-version";

type Provider = "openai" | "anthropic" | "grok" | "gemini";
type MigrationEffort = AnalysisResult["effort"];

type TokenUsage = { promptTokens: number; completionTokens: number };

/**
 * LLM output contract: narrative and consulting structure ONLY.
 * Migration Readiness Score and Effort come from `computeDeterministicMigrationScore` — never from the model.
 */
/** LLM returns only narrative fields — no scores, effort, Gantt, or structured confidence (keeps output lean). */
type LlmNarrativeResponse = {
  executiveSummary: string;
  keyFindings: string[];
  recommendations: string[];
  dataProductSuggestions: string[];
  migrationPath: string[];
};

/** Gemini JSON schema: five string fields only (strict narrative contract). */
const GEMINI_NARRATIVE_SCHEMA = {
  type: "OBJECT" as const,
  required: [
    "executiveSummary",
    "keyFindings",
    "recommendations",
    "dataProductSuggestions",
    "migrationPath",
  ],
  properties: {
    executiveSummary: { type: "STRING" },
    keyFindings: { type: "ARRAY", items: { type: "STRING" } },
    recommendations: { type: "ARRAY", items: { type: "STRING" } },
    dataProductSuggestions: { type: "ARRAY", items: { type: "STRING" } },
    migrationPath: { type: "ARRAY", items: { type: "STRING" } },
  },
};

async function callGrokChat(input: {
  apiKey: string;
  model: string;
  messages: Array<{ role: "system" | "user"; content: string }>;
  maxTokens?: number;
}): Promise<{ text: string; usage?: TokenUsage }> {
  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: input.model,
      messages: input.messages,
      temperature: 0,
      max_tokens: input.maxTokens ?? 3200,
      response_format: { type: "json_object" },
    }),
  });
  if (!response.ok) {
    throw new Error(`Grok request failed (${response.status}).`);
  }
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  return {
    text: data.choices?.[0]?.message?.content ?? "",
    usage: data.usage
      ? { promptTokens: data.usage.prompt_tokens ?? 0, completionTokens: data.usage.completion_tokens ?? 0 }
      : undefined,
  };
}

async function callGemini(input: {
  apiKey: string;
  model: string;
  prompt: string;
  maxTokens?: number;
  useStructuredNarrativeJson?: boolean;
}): Promise<{ text: string; usage?: TokenUsage }> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${input.model}:generateContent?key=${input.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: input.prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: input.maxTokens ?? 3200,
          temperature: 0,
          ...(input.useStructuredNarrativeJson === true ? { responseSchema: GEMINI_NARRATIVE_SCHEMA } : {}),
        },
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`Gemini request failed (${response.status}).`);
  }
  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  const um = data.usageMetadata;
  return {
    text: data.candidates?.[0]?.content?.parts?.[0]?.text ?? "",
    usage: um
      ? {
          promptTokens: um.promptTokenCount ?? 0,
          completionTokens: um.candidatesTokenCount ?? 0,
        }
      : undefined,
  };
}

export function buildNarrativePrompt(summary: AssetSummary, files: ParsedFileInsight[], locale: "de" | "en") {
  const compactFiles = files.map((file) => ({
    fileName: file.fileName,
    assetType: file.assetType,
    storyName: file.storyName,
    title: file.title,
    pages: file.pages,
    widgets: file.widgets,
    calculations: file.calculations,
    dimensions: file.dimensions,
    measures: file.measures,
    planningModel: file.planningModel,
    dataSources: file.dataSources,
    usedModels: file.usedModels,
    hasSemanticLayer: file.hasSemanticLayer,
    liveConnections: file.liveConnections,
    classicCharts: file.classicCharts,
    legacyOrClassicHints: file.legacyOrClassicHints ?? 0,
    formulaLeafCount: file.formulaLeafCount ?? 0,
    optimizedLayoutHints: file.optimizedLayoutHints ?? 0,
    resultLookupHits: file.resultLookupHits ?? 0,
    restrictedMeasureHits: file.restrictedMeasureHits ?? 0,
    exceptionAggregationHits: file.exceptionAggregationHits ?? 0,
    planningLogicHits: file.planningLogicHits ?? 0,
  }));

  const langHint =
    locale === "de"
      ? "Antwortsprache fuer alle Freitext-Felder: Deutsch."
      : "Answer all narrative fields in English.";

  return `${langHint}
You are a senior SAP Analytics Cloud → SAP Business Data Cloud / Datasphere migration consultant.

IMPORTANT: A deterministic rule engine already computed the official Migration Readiness Score (0–100) and Effort from the same JSON. You MUST NOT output scores, effort, Gantt, or confidence numbers — only narrative text.

Your job is ONLY:
- executiveSummary (short professional paragraph)
- keyFindings (4–8 bullet strings)
- recommendations (same count as findings when possible)
- dataProductSuggestions (3–6 bullets)
- migrationPath (ordered step strings)

Portfolio summary JSON:
${JSON.stringify(summary)}

Per-file extracts JSON:
${JSON.stringify(compactFiles)}

Return ONE JSON object with exactly these keys and no others:
{
  "executiveSummary": string,
  "keyFindings": string[],
  "recommendations": string[],
  "dataProductSuggestions": string[],
  "migrationPath": string[]
}

Rules:
- Base every statement ONLY on the quoted counters and attributes.
- Do not mention a numeric readiness score in the text (the UI shows the rule-based score separately).`;
}

function extractLikelyJson(text: string): string {
  const fenceMatch = text.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenceMatch?.[1]) return fenceMatch[1].trim();
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1).trim();
  }
  return text.trim();
}

function coerceNarrativeResponse(text: string): LlmNarrativeResponse {
  const parsed = JSON.parse(extractLikelyJson(text)) as LlmNarrativeResponse & {
    migrationReadinessScore?: unknown;
    effortEstimation?: unknown;
  };
  return {
    executiveSummary: parsed.executiveSummary ?? "",
    keyFindings: Array.isArray(parsed.keyFindings) ? parsed.keyFindings : [],
    recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
    dataProductSuggestions: Array.isArray(parsed.dataProductSuggestions) ? parsed.dataProductSuggestions : [],
    migrationPath: Array.isArray(parsed.migrationPath) ? parsed.migrationPath : [],
  };
}

async function callProviderRaw(input: {
  provider: Provider;
  model: string;
  apiKey: string;
  prompt: string;
  maxTokens?: number;
  structuredGeminiNarrativeRepair?: boolean;
}): Promise<{ text: string; usage?: TokenUsage }> {
  if (input.provider === "openai") {
    const openai = new OpenAI({ apiKey: input.apiKey });
    const response = await openai.chat.completions.create({
      model: input.model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Return strict JSON only. Do not include migrationReadinessScore or effort fields." },
        { role: "user", content: input.prompt },
      ],
    });
    const usageMap = (
      response as unknown as {
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      }
    ).usage;
    return {
      text: response.choices[0]?.message?.content ?? "",
      usage: usageMap
        ? { promptTokens: usageMap.prompt_tokens ?? 0, completionTokens: usageMap.completion_tokens ?? 0 }
        : undefined,
    };
  }

  if (input.provider === "anthropic") {
    const anthropic = new Anthropic({ apiKey: input.apiKey });
    const response = await anthropic.messages.create({
      model: input.model,
      max_tokens: input.maxTokens ?? 3200,
      temperature: 0,
      system: "Return strict JSON only. No markdown. Never output migrationReadinessScore or effortEstimation.",
      messages: [{ role: "user", content: input.prompt }],
    });
    const combined = response.content
      .map((part) => (part.type === "text" ? part.text : ""))
      .join("");
    const usage = (
      response as unknown as {
        usage?: { input_tokens?: number; output_tokens?: number };
      }
    ).usage;
    return {
      text: combined,
      usage: usage
        ? { promptTokens: usage.input_tokens ?? 0, completionTokens: usage.output_tokens ?? 0 }
        : undefined,
    };
  }

  if (input.provider === "grok") {
    return callGrokChat({
      apiKey: input.apiKey,
      model: input.model,
      messages: [
        { role: "system", content: "Return strict JSON only. No migrationReadinessScore or effort fields." },
        { role: "user", content: input.prompt },
      ],
      maxTokens: input.maxTokens,
    });
  }

  return callGemini({
    apiKey: input.apiKey,
    model: input.model,
    prompt: input.prompt,
    maxTokens: input.maxTokens,
    useStructuredNarrativeJson: input.structuredGeminiNarrativeRepair === true,
  });
}

function buildIssues(structured: LlmNarrativeResponse): AnalysisIssue[] {
  if (!structured.keyFindings.length) return [];
  return structured.keyFindings.slice(0, 8).map((finding, idx) => ({
    id: `llm-issue-${idx + 1}`,
    category: "Data Product Candidate" as const,
    title: finding.length > 90 ? `${finding.slice(0, 87)}...` : finding,
    explanation: finding,
    recommendation:
      structured.recommendations[idx] ??
      structured.recommendations[0] ??
      "Review SAC artefacts for BDC / Datasphere alignment.",
    severity: (idx < 2 ? "high" : "medium") as AnalysisIssue["severity"],
  }));
}

export async function runLlmAnalysis(input: {
  provider: Provider;
  model: string;
  apiKey: string;
  summary: AssetSummary;
  files: ParsedFileInsight[];
  locale?: "de" | "en";
  includeTrace: boolean;
}): Promise<AnalysisResult> {
  const locale = input.locale ?? "de";
  const rules = computeDeterministicMigrationScore(input.summary, input.files);

  const prompt = buildNarrativePrompt(input.summary, input.files, locale);
  const usageTotals: TokenUsage = { promptTokens: 0, completionTokens: 0 };

  const accumulate = (usage?: TokenUsage) => {
    if (!usage) return;
    usageTotals.promptTokens += usage.promptTokens;
    usageTotals.completionTokens += usage.completionTokens;
  };

  const useGeminiStruct = input.provider === "gemini";
  const first = await callProviderRaw({
    provider: input.provider,
    model: input.model,
    apiKey: input.apiKey,
    prompt,
    maxTokens: input.provider === "gemini" ? 3600 : 3200,
    structuredGeminiNarrativeRepair: useGeminiStruct,
  });
  accumulate(first.usage);

  let structured: LlmNarrativeResponse;

  try {
    structured = coerceNarrativeResponse(first.text);
  } catch {
    const repaired = await callProviderRaw({
      provider: input.provider,
      model: input.model,
      apiKey: input.apiKey,
      prompt: `Convert the following text into valid JSON with only keys: executiveSummary, keyFindings, recommendations, dataProductSuggestions, migrationPath (all arrays of strings except executiveSummary). JSON only:\n${first.text}`,
      maxTokens: 3200,
      structuredGeminiNarrativeRepair: input.provider === "gemini",
    });
    accumulate(repaired.usage);
    structured = coerceNarrativeResponse(repaired.text);
  }

  const issues = buildIssues(structured);
  const cost = estimateUsd(input.model, usageTotals.promptTokens, usageTotals.completionTokens);

  const tracePayload = {
    deterministic: {
      scoringEngineVersion: SCORING_ENGINE_VERSION,
      parserEngineVersion: PARSER_ENGINE_VERSION,
      score: rules.score,
      effort: rules.effort,
      effortByWorkstream: rules.effortByWorkstream,
      breakdown: rules.breakdown,
      categories: rules.categories,
    },
    llmNarrative: structured,
  };

  return {
    score: rules.score,
    effort: rules.effort,
    scoringEngineVersion: SCORING_ENGINE_VERSION,
    parserEngineVersion: PARSER_ENGINE_VERSION,
    scoreBreakdown: rules.breakdown,
    scoreCategories: rules.categories,
    summary: input.summary,
    files: input.files,
    provider: input.provider,
    model: input.model,
    executiveSummary: structured.executiveSummary,
    keyFindings: structured.keyFindings,
    recommendations: structured.recommendations,
    dataProductSuggestions: structured.dataProductSuggestions,
    issues,
    migrationPath: structured.migrationPath,
    effortByWorkstream: rules.effortByWorkstream,
    locale,
    usage: {
      promptTokens: usageTotals.promptTokens,
      completionTokens: usageTotals.completionTokens,
      estimatedCostUsd: Number(cost.toFixed(4)),
    },
    ...(input.includeTrace
      ? {
          trace: {
            prompt,
            response: JSON.stringify(tracePayload),
          },
        }
      : {}),
  };
}

export async function testLlmConnection(input: { provider: Provider; model: string; apiKey: string }) {
  await callProviderRaw({
    provider: input.provider,
    model: input.model,
    apiKey: input.apiKey,
    prompt: '{"executiveSummary":"ping","keyFindings":[],"recommendations":[],"dataProductSuggestions":[],"migrationPath":[]}',
    maxTokens: 120,
    structuredGeminiNarrativeRepair: false,
  });
}
