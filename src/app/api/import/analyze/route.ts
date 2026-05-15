import { runImportAnalysis } from "@/server/import-analysis";
import { requireMutateRole } from "@/lib/auth-server";

export async function POST(request: Request) {
  const auth = await requireMutateRole();
  if (!auth.ok) return auth.response;
  return runImportAnalysis(request);
}
