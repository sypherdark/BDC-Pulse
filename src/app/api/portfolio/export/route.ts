import { listAssetsWithProjects } from "@/db/repository";
import { requireSessionRole } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

function csvEscape(value: string | number): string {
  const s = String(value);
  if (/[,"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET() {
  const auth = await requireSessionRole();
  if (!auth.ok) return auth.response;

  const rows = await listAssetsWithProjects();
  const header = [
    "asset_id",
    "asset_name",
    "score",
    "effort",
    "status",
    "created_at",
    "client_name",
    "industry",
    "project_code",
    "consultant_owner",
    "project_date",
    "prompt_tokens",
    "completion_tokens",
    "estimated_cost_usd",
    "provider",
    "model",
  ];

  const lines = [header.join(",")];
  for (const row of rows) {
    const a = row.asset;
    const p = row.project;
    const costRaw = a.llmEstimatedCostUsd ?? "";
    lines.push(
      [
        csvEscape(a.id),
        csvEscape(a.name),
        csvEscape(a.score),
        csvEscape(a.effort),
        csvEscape(a.status),
        csvEscape(a.createdAt),
        csvEscape(p.clientName),
        csvEscape(p.industry),
        csvEscape(p.projectCode),
        csvEscape(p.consultantOwner),
        csvEscape(p.projectDate),
        csvEscape(a.llmPromptTokens ?? ""),
        csvEscape(a.llmCompletionTokens ?? ""),
        csvEscape(costRaw),
        csvEscape(a.provider ?? ""),
        csvEscape(a.model ?? ""),
      ].join(","),
    );
  }

  const csv = lines.join("\n");
  const filename = `bdc-pulse-portfolio-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
