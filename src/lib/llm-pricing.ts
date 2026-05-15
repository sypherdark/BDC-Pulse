/** Rough heuristic pricing USD per 1M tokens (adjust as vendor pricing changes). */
const RATES: Record<string, { in: number; out: number }> = {
  "gpt-4o": { in: 2.5, out: 10 },
  "gpt-4-turbo": { in: 10, out: 30 },
  "claude-3-5-sonnet-latest": { in: 3, out: 15 },
  "claude-3-opus-latest": { in: 15, out: 75 },
  "gemini-2.5-flash": { in: 0.3, out: 2.5 },
  "gemini-2.5-pro": { in: 1.25, out: 10 },
  "grok-3": { in: 3, out: 15 },
  "grok-3-mini": { in: 0.3, out: 0.6 },
};

export function estimateUsd(model: string, promptTokens: number, completionTokens: number): number {
  const rate = RATES[model] ?? { in: 1, out: 5 };
  return (promptTokens / 1_000_000) * rate.in + (completionTokens / 1_000_000) * rate.out;
}
