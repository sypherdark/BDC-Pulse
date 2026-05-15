import type { PDFDocument } from "pdf-lib";

/** Strip data-URL prefix; return raw base64 payload. */
export function normalizeLogoBase64(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const comma = trimmed.indexOf(",");
  if (trimmed.startsWith("data:") && comma >= 0) {
    return trimmed.slice(comma + 1).replace(/\s/g, "");
  }
  return trimmed.replace(/\s/g, "");
}

/**
 * Embed logo from base64 (PNG or JPEG). Returns dimensions for layout.
 */
export async function embedLogoFromBase64(
  pdf: PDFDocument,
  base64: string,
): Promise<{ image: Awaited<ReturnType<PDFDocument["embedPng"]>>; width: number; height: number } | null> {
  const payload = normalizeLogoBase64(base64);
  if (payload.length < 16) return null;

  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(Buffer.from(payload, "base64"));
  } catch {
    return null;
  }

  if (bytes.length < 8) return null;

  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;

  try {
    if (isPng) {
      const image = await pdf.embedPng(bytes);
      return { image, width: image.width, height: image.height };
    }
    if (isJpeg) {
      const image = await pdf.embedJpg(bytes);
      return { image, width: image.width, height: image.height };
    }
    try {
      const image = await pdf.embedPng(bytes);
      return { image, width: image.width, height: image.height };
    } catch {
      const image = await pdf.embedJpg(bytes);
      return { image, width: image.width, height: image.height };
    }
  } catch {
    return null;
  }
}
