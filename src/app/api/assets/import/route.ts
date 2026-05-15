import { runImportAnalysis } from "@/server/import-analysis";
import { requireMutateRole } from "@/lib/auth-server";

/** @deprecated Prefer /api/import/analyze — kept for compatibility. */
export async function POST(request: Request) {
  const auth = await requireMutateRole();
  if (!auth.ok) return auth.response;
  return runImportAnalysis(request);
}
