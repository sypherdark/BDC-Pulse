/** Max size for a single .json upload (25 MB). */
export const MAX_JSON_FILE_BYTES = 25 * 1024 * 1024;

/** Max size for a .zip archive (100 MB). */
export const MAX_ZIP_FILE_BYTES = 100 * 1024 * 1024;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Client-side pre-check before upload (same limits as server). */
export function validateFilesClient(files: File[]): { ok: true } | { ok: false; message: string } {
  for (const file of files) {
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".zip") && file.size > MAX_ZIP_FILE_BYTES) {
      return {
        ok: false,
        message: `"${file.name}" is ${formatBytes(file.size)}. ZIP limit is ${formatBytes(MAX_ZIP_FILE_BYTES)}.`,
      };
    }
    if (lower.endsWith(".json") && file.size > MAX_JSON_FILE_BYTES) {
      return {
        ok: false,
        message: `"${file.name}" is ${formatBytes(file.size)}. JSON limit is ${formatBytes(MAX_JSON_FILE_BYTES)}.`,
      };
    }
    if (!lower.endsWith(".json") && !lower.endsWith(".zip")) {
      return { ok: false, message: `"${file.name}" is not a .json or .zip file.` };
    }
  }
  return { ok: true };
}
