import AdmZip from "adm-zip";
import { formatBytes, MAX_JSON_FILE_BYTES, MAX_ZIP_FILE_BYTES } from "@/lib/upload-limits";

export type UploadPayload = { fileName: string; payload: unknown };

export type IngestSkipReason =
  | "unsupported_type"
  | "file_too_large"
  | "zip_corrupt"
  | "zip_entry_not_json"
  | "invalid_json"
  | "empty_file";

export type IngestSkippedItem = {
  name: string;
  reason: IngestSkipReason;
  detail: string;
  sourceArchive?: string;
};

export type IngestProcessedItem = {
  fileName: string;
  sourceArchive?: string;
};

export type IngestReport = {
  processed: IngestProcessedItem[];
  skipped: IngestSkippedItem[];
  limits: {
    maxJsonBytes: number;
    maxZipBytes: number;
    maxJsonLabel: string;
    maxZipLabel: string;
  };
};

export type CollectUploadResult = {
  payloads: UploadPayload[];
  report: IngestReport;
  /** Top-level validation errors (no payloads extracted). */
  fatalError?: string;
};

function emptyReport(): IngestReport {
  return {
    processed: [],
    skipped: [],
    limits: {
      maxJsonBytes: MAX_JSON_FILE_BYTES,
      maxZipBytes: MAX_ZIP_FILE_BYTES,
      maxJsonLabel: formatBytes(MAX_JSON_FILE_BYTES),
      maxZipLabel: formatBytes(MAX_ZIP_FILE_BYTES),
    },
  };
}

/** Normalize UTF-8 JSON text (strip BOM, trim) so identical files parse identically. */
function normalizeJsonText(text: string): string {
  let t = text.trim();
  if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
  if (t.startsWith("\uFEFF")) t = t.slice(1);
  return t.trim();
}

function pushJsonFromText(
  fileName: string,
  text: string,
  results: UploadPayload[],
  report: IngestReport,
  sourceArchive?: string,
): boolean {
  const trimmed = normalizeJsonText(text);
  if (!trimmed.length) {
    report.skipped.push({
      name: fileName,
      reason: "empty_file",
      detail: "File is empty or contains only whitespace.",
      sourceArchive,
    });
    return false;
  }
  try {
    results.push({ fileName, payload: JSON.parse(trimmed) });
    report.processed.push({ fileName, sourceArchive });
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid JSON syntax";
    report.skipped.push({
      name: fileName,
      reason: "invalid_json",
      detail: `Could not parse JSON: ${msg}`,
      sourceArchive,
    });
    return false;
  }
}

function processZip(
  archiveName: string,
  buffer: Buffer,
  results: UploadPayload[],
  report: IngestReport,
): void {
  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Archive is unreadable";
    report.skipped.push({
      name: archiveName,
      reason: "zip_corrupt",
      detail: `ZIP could not be opened: ${msg}. Re-export the bundle or upload individual .json files.`,
    });
    return;
  }

  const entries = zip.getEntries();
  if (!entries.length) {
    report.skipped.push({
      name: archiveName,
      reason: "zip_corrupt",
      detail: "ZIP archive contains no entries.",
    });
    return;
  }

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const entryPath = entry.entryName;
    const baseName = entryPath.split("/").pop() ?? entryPath;

    if (!baseName.toLowerCase().endsWith(".json")) {
      report.skipped.push({
        name: baseName || entryPath,
        reason: "zip_entry_not_json",
        detail: "Only entries ending in .json are imported; other files are ignored.",
        sourceArchive: archiveName,
      });
      continue;
    }

    let text: string;
    try {
      text = entry.getData().toString("utf8");
    } catch {
      report.skipped.push({
        name: baseName,
        reason: "invalid_json",
        detail: "Could not read entry bytes as UTF-8 text.",
        sourceArchive: archiveName,
      });
      continue;
    }

    pushJsonFromText(baseName, text, results, report, archiveName);
  }
}

/**
 * Extract SAC JSON payloads from uploads with size limits and a full ingest report.
 */
export async function collectJsonFromUpload(files: File[]): Promise<CollectUploadResult> {
  const report = emptyReport();
  const results: UploadPayload[] = [];

  if (!files.length) {
    return { payloads: [], report, fatalError: "No files were uploaded." };
  }

  for (const file of files) {
    const lower = file.name.toLowerCase();
    const size = file.size;

    if (lower.endsWith(".zip")) {
      if (size > MAX_ZIP_FILE_BYTES) {
        report.skipped.push({
          name: file.name,
          reason: "file_too_large",
          detail: `ZIP is ${formatBytes(size)} (limit ${report.limits.maxZipLabel}). Split the archive or upload individual JSON files.`,
        });
        continue;
      }
      if (size === 0) {
        report.skipped.push({
          name: file.name,
          reason: "empty_file",
          detail: "ZIP file is empty.",
        });
        continue;
      }
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        processZip(file.name, buffer, results, report);
      } catch {
        report.skipped.push({
          name: file.name,
          reason: "zip_corrupt",
          detail: "Failed to read ZIP from upload. The file may be corrupted or incomplete.",
        });
      }
      continue;
    }

    if (lower.endsWith(".json")) {
      if (size > MAX_JSON_FILE_BYTES) {
        report.skipped.push({
          name: file.name,
          reason: "file_too_large",
          detail: `JSON is ${formatBytes(size)} (limit ${report.limits.maxJsonLabel}).`,
        });
        continue;
      }
      if (size === 0) {
        report.skipped.push({
          name: file.name,
          reason: "empty_file",
          detail: "JSON file is empty.",
        });
        continue;
      }
      try {
        const text = await file.text();
        pushJsonFromText(file.name, text, results, report);
      } catch {
        report.skipped.push({
          name: file.name,
          reason: "invalid_json",
          detail: "Could not read file as text.",
        });
      }
      continue;
    }

    report.skipped.push({
      name: file.name,
      reason: "unsupported_type",
      detail: "Only .json files and .zip archives are accepted.",
    });
  }

  results.sort((a, b) => a.fileName.localeCompare(b.fileName, "en"));

  let fatalError: string | undefined;
  if (!results.length) {
    const skippedCount = report.skipped.length;
    if (skippedCount === 0) {
      fatalError = "No .json or .zip files were recognized in the upload.";
    } else {
      const reasons = [...new Set(report.skipped.map((s) => s.reason))];
      fatalError =
        reasons.includes("file_too_large")
          ? `All ${skippedCount} file(s) exceeded size limits or could not be parsed. See ingest details below.`
          : reasons.includes("invalid_json") || reasons.includes("empty_file")
            ? `No valid SAC JSON could be parsed (${skippedCount} file(s) skipped). Check that exports are UTF-8 JSON from SAC.`
            : `No valid JSON extracted (${skippedCount} item(s) skipped). Use .json files or a .zip containing .json entries.`;
    }
  }

  return { payloads: results, report, fatalError };
}

