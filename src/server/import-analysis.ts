import { NextResponse } from "next/server";
import { collectJsonFromUpload } from "@/lib/extract-uploads";
import { parseSacPortfolio } from "@/lib/import-pipeline";
import { decryptSecret } from "@/lib/crypto";
import { buildNarrativePrompt, runLlmAnalysis } from "@/lib/llm";
import { buildRuleBasedAnalysisResult } from "@/lib/rule-based-analysis";
import { buildSemanticTranslationLog } from "@/lib/semantic-translation-log";
import { createAssetFromAnalysis, getKv, getLlmSettings, getProject } from "@/db/repository";
import type { AnalysisResult } from "@/lib/types";

export async function runImportAnalysis(request: Request) {
  const formData = await request.formData();
  const uploads = formData.getAll("files") as File[];
  const projectIdRaw = formData.get("projectId")?.toString();
  const localeRaw = (formData.get("locale")?.toString().toLowerCase() ?? "") as "" | "de" | "en";
  const locale = localeRaw === "en" ? "en" : "de";

  if (!uploads.length) {
    return NextResponse.json(
      { error: "No files selected. Add at least one .json file or a .zip that contains JSON exports." },
      { status: 400 },
    );
  }

  const parsedProjectId = Number(projectIdRaw ?? "");
  if (!Number.isFinite(parsedProjectId) || parsedProjectId <= 0) {
    return NextResponse.json(
      { error: "Choose a project from the list, or create one under Projects before analyzing." },
      { status: 400 },
    );
  }

  const projectRow = await getProject(parsedProjectId);
  if (!projectRow) {
    return NextResponse.json({ error: "That project no longer exists. Refresh and pick a valid project." }, { status: 404 });
  }

  let collectResult: Awaited<ReturnType<typeof collectJsonFromUpload>>;
  try {
    collectResult = await collectJsonFromUpload(uploads);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown read error";
    return NextResponse.json(
      {
        error: `Could not read the uploaded files: ${msg}. If the archive is large, ensure it is under the size limit and not corrupted.`,
      },
      { status: 400 },
    );
  }

  const { payloads, report: ingest, fatalError } = collectResult;

  if (!payloads.length) {
    return NextResponse.json(
      {
        error: fatalError ?? "No valid JSON found.",
        ingest,
      },
      { status: 400 },
    );
  }

  const outcome = parseSacPortfolio(payloads);
  if (!outcome.ok) {
    return NextResponse.json(
      {
        error: outcome.error ?? "Files could not be interpreted as SAC exports.",
        nonSacFiles: outcome.nonSacFiles,
        ingest,
      },
      { status: 400 },
    );
  }

  const portfolio = outcome.parsedPortfolio;
  const translationLog = buildSemanticTranslationLog(
    portfolio.files,
    portfolio.summary,
    portfolio.fileScans,
  );

  const traceEnabled = (await getKv("store_llm_traces")) === "1";
  const auditEnabled = (await getKv("store_llm_audit")) === "1";
  const auditEncrypt = (await getKv("encrypt_llm_audit_at_rest")) === "1";
  const includeCapture = traceEnabled || auditEnabled;

  const llmSettings = await getLlmSettings();

  let finalAnalysis: AnalysisResult;
  let llmCapture: { prompt: string; response: string; encrypt: boolean } | null = null;

  if (llmSettings) {
    try {
      finalAnalysis = await runLlmAnalysis({
        provider: llmSettings.provider as "openai" | "anthropic" | "grok" | "gemini",
        model: llmSettings.model,
        apiKey: decryptSecret(llmSettings.encryptedApiKey),
        summary: portfolio.summary,
        files: portfolio.files,
        locale,
        includeTrace: includeCapture,
      });
      finalAnalysis = {
        ...finalAnalysis,
        semanticTranslationLog: translationLog,
        llmUnavailable: false,
      };
      if (includeCapture && finalAnalysis.trace) {
        llmCapture = {
          prompt: finalAnalysis.trace.prompt,
          response: finalAnalysis.trace.response,
          encrypt: auditEncrypt,
        };
      }
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : "The model request failed. Check the API key, model name, and network.";
      const prompt = buildNarrativePrompt(portfolio.summary, portfolio.files, locale);
      const failBody = JSON.stringify(
        { error: true, message: msg, at: new Date().toISOString() },
        null,
        2,
      );
      finalAnalysis = buildRuleBasedAnalysisResult({
        summary: portfolio.summary,
        files: portfolio.files,
        translationLog,
        locale,
        llmUnavailableReason: "provider_error",
        providerErrorMessage: msg,
      });
      if (auditEnabled) {
        llmCapture = { prompt, response: failBody, encrypt: auditEncrypt };
      }
    }
  } else {
    finalAnalysis = buildRuleBasedAnalysisResult({
      summary: portfolio.summary,
      files: portfolio.files,
      translationLog,
      locale,
      llmUnavailableReason: "not_configured",
    });
  }

  const analysisForPersist: AnalysisResult = {
    ...finalAnalysis,
    trace: traceEnabled ? finalAnalysis.trace : undefined,
  };

  const validSacFiles = portfolio.files.filter((file) => file.assetType !== "unknown");
  const created = await createAssetFromAnalysis({
    projectId: parsedProjectId,
    name:
      validSacFiles.length === 1
        ? validSacFiles[0].fileName
        : `${validSacFiles.length}-file SAC bundle`,
    type: "SAC Export",
    analysis: analysisForPersist,
    llmCapture,
  });

  const responsePayload: AnalysisResult = { ...finalAnalysis };
  if (!traceEnabled) delete responsePayload.trace;

  return NextResponse.json({
    assetId: created.id,
    projectId: parsedProjectId,
    analysis: responsePayload,
    ingest,
  });
}
