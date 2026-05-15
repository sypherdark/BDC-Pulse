import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { appKv, assets, llmSettings, projects } from "@/db/schema";
import type { AnalysisResult, LlmConfig } from "@/lib/types";
import { encryptSecret } from "@/lib/crypto";

export async function createProject(input: Omit<typeof projects.$inferInsert, "id">) {
  const [created] = await db.insert(projects).values(input).returning();
  return created;
}

export async function listProjects() {
  return db.select().from(projects).orderBy(desc(projects.createdAt));
}

export async function getProject(id: number) {
  const [row] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return row ?? null;
}

export async function createAssetFromAnalysis(input: {
  projectId: number;
  name: string;
  type: string;
  analysis: AnalysisResult;
  /** When set, persists prompt/response even if `analysis.trace` was stripped for the client. */
  llmCapture?: { prompt: string; response: string; encrypt: boolean } | null;
}) {
  const now = new Date().toISOString();

  const promptRaw = input.llmCapture?.prompt ?? input.analysis.trace?.prompt;
  const responseRaw = input.llmCapture?.response ?? input.analysis.trace?.response;
  const encrypt = input.llmCapture?.encrypt === true;
  const hasBoth = !!promptRaw && !!responseRaw;
  const llmAuditEncrypted = encrypt && hasBoth ? 1 : 0;
  const llmPrompt =
    hasBoth && encrypt ? encryptSecret(promptRaw as string) : (promptRaw ?? undefined);
  const llmResponse =
    hasBoth && encrypt ? encryptSecret(responseRaw as string) : (responseRaw ?? undefined);

  const [created] = await db
    .insert(assets)
    .values({
      projectId: input.projectId,
      name: input.name,
      type: input.type,
      score: input.analysis.score,
      effort: input.analysis.effort,
      summaryJson: JSON.stringify(input.analysis.summary),
      filesJson: JSON.stringify(input.analysis.files ?? []),
      provider: input.analysis.provider,
      model: input.analysis.model,
      executiveSummary: input.analysis.executiveSummary,
      keyFindingsJson: JSON.stringify(input.analysis.keyFindings ?? []),
      recommendationsJson: JSON.stringify(input.analysis.recommendations ?? []),
      dataProductSuggestionsJson: JSON.stringify(input.analysis.dataProductSuggestions ?? []),
      issuesJson: JSON.stringify(input.analysis.issues),
      migrationPathJson: JSON.stringify(input.analysis.migrationPath),
      effortBreakdownJson: JSON.stringify(input.analysis.effortByWorkstream ?? {}),
      ganttJson: JSON.stringify(input.analysis.ganttTasks ?? []),
      enrichedFindingsJson: JSON.stringify(input.analysis.enrichedFindings ?? []),
      enrichedRecommendationsJson: JSON.stringify(input.analysis.enrichedRecommendations ?? []),
      reportLocale: input.analysis.locale ?? "de",
      llmPrompt,
      llmResponse,
      llmPromptTokens: input.analysis.usage?.promptTokens,
      llmCompletionTokens: input.analysis.usage?.completionTokens,
      llmEstimatedCostUsd:
        input.analysis.usage !== undefined ? String(input.analysis.usage.estimatedCostUsd) : undefined,
      issueTriageJson: "{}",
      scoreBreakdownJson: JSON.stringify({
        version: input.analysis.scoringEngineVersion ?? "",
        parserVersion: input.analysis.parserEngineVersion ?? "",
        breakdown: input.analysis.scoreBreakdown ?? [],
        categories: input.analysis.scoreCategories ?? [],
      }),
      semanticTranslationLogJson: JSON.stringify(input.analysis.semanticTranslationLog ?? []),
      parserEngineVersion: input.analysis.parserEngineVersion ?? null,
      llmUnavailable: input.analysis.llmUnavailable ? 1 : 0,
      llmAuditEncrypted,
      createdAt: now,
    })
    .returning();

  return created;
}

export async function listAssetsWithProjects() {
  return db
    .select({ asset: assets, project: projects })
    .from(assets)
    .innerJoin(projects, eq(assets.projectId, projects.id))
    .orderBy(desc(assets.createdAt));
}

export async function listAssets() {
  return db.select().from(assets).orderBy(desc(assets.createdAt));
}

export async function getAssetById(id: number) {
  const [row] = await db.select().from(assets).where(eq(assets.id, id)).limit(1);
  return row ?? null;
}

export async function saveBlueprint(id: number, blueprintJson: string) {
  await db.update(assets).set({ blueprintJson }).where(eq(assets.id, id));
}

export async function getDashboardStats() {
  const totalResult = await db.select({ value: sql<number>`count(*)` }).from(assets);
  const avgResult = await db.select({ value: sql<number>`coalesce(avg(${assets.score}), 0)` }).from(assets);
  const recentJoined = await db
    .select({ asset: assets })
    .from(assets)
    .orderBy(desc(assets.createdAt))
    .limit(5);

  const recent = recentJoined.map((row) => row.asset);
  return {
    totalAssets: totalResult[0]?.value ?? 0,
    readinessScore: Math.round(avgResult[0]?.value ?? 0),
    recent,
  };
}

export async function upsertLlmSettings(input: Omit<LlmConfig, "updatedAt">) {
  const updatedAt = new Date().toISOString();
  const existing = await getLlmSettings();
  if (existing) {
    await db
      .update(llmSettings)
      .set({ provider: input.provider, model: input.model, encryptedApiKey: input.encryptedApiKey, updatedAt })
      .where(eq(llmSettings.id, 1));
  } else {
    await db.insert(llmSettings).values({
      id: 1,
      provider: input.provider,
      model: input.model,
      encryptedApiKey: input.encryptedApiKey,
      updatedAt,
    });
  }
}

export async function getLlmSettings() {
  const [row] = await db.select().from(llmSettings).where(eq(llmSettings.id, 1)).limit(1);
  return row ?? null;
}

/** App key/value helpers */
export async function getKv(key: string): Promise<string | null> {
  const [row] = await db.select().from(appKv).where(eq(appKv.key, key)).limit(1);
  return row?.value ?? null;
}

export async function setKv(key: string, value: string) {
  const existing = await getKv(key);
  if (existing === null) {
    await db.insert(appKv).values({ key, value });
    return;
  }
  await db.update(appKv).set({ value }).where(eq(appKv.key, key));
}
