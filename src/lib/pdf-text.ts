import type { PDFFont } from "pdf-lib";

/** Unicode → ASCII fallbacks for StandardFonts (WinAnsi) PDF output. */
const UNICODE_FALLBACK: Record<string, string> = {
  "\u2192": "->", // →
  "\u2190": "<-", // ←
  "\u21D2": "=>", // ⇒
  "\u2194": "<->", // ↔
  "\u2013": "-", // –
  "\u2014": "-", // —
  "\u2212": "-", // −
  "\u00B7": " | ", // ·
  "\u2022": "*", // •
  "\u2026": "...", // …
  "\u2018": "'", // '
  "\u2019": "'", // '
  "\u201C": '"', // "
  "\u201D": '"', // "
  "\u00A0": " ", // nbsp
  "\u00AD": "", // soft hyphen
};

function canEncode(font: PDFFont, char: string): boolean {
  try {
    font.encodeText(char);
    return true;
  } catch {
    return false;
  }
}

/**
 * Make text safe for pdf-lib StandardFonts (WinAnsi). Replaces arrows, smart quotes,
 * bullets, and any remaining unencodable characters before drawText().
 */
export function sanitizePdfText(text: string, font: PDFFont): string {
  let out = "";
  for (const char of text) {
    const mapped = UNICODE_FALLBACK[char];
    if (mapped !== undefined) {
      out += mapped;
      continue;
    }
    if (canEncode(font, char)) {
      out += char;
      continue;
    }
    out += "?";
  }
  return out;
}
