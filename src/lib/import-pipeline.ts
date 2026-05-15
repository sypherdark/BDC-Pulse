import { parseSacAssets } from "@/lib/analysis";
import type { UploadPayload } from "@/lib/extract-uploads";

export type SaCParseOutcome =
  | { ok: true; parsedPortfolio: ReturnType<typeof parseSacAssets> }
  | { ok: false; error: string; invalidJson?: string[]; nonSacFiles?: string[] };

export function parseSacPortfolio(inputFiles: UploadPayload[]): SaCParseOutcome {
  if (!inputFiles.length) return { ok: false, error: "No SAC JSON payloads found.", invalidJson: [] };

  const parsedPortfolio = parseSacAssets(inputFiles);
  const parsedFiles = parsedPortfolio.files;
  const nonSacFiles = parsedFiles.filter((file) => file.assetType === "unknown").map((file) => file.fileName);

  if (nonSacFiles.length > 0) {
    return {
      ok: false,
      error: `Non-SAC JSON file(s) rejected: ${nonSacFiles.join(", ")}.`,
      nonSacFiles,
    };
  }

  const validSacFiles = parsedFiles.filter((file) => file.assetType !== "unknown");
  if (!validSacFiles.length) {
    return { ok: false, error: "No SAC export structure detected.", nonSacFiles: [] };
  }

  return { ok: true, parsedPortfolio };
}
