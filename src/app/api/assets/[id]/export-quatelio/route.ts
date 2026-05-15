import { NextResponse } from "next/server";
import { getAssetById, getKv, getProject } from "@/db/repository";
import { requireSessionRole } from "@/lib/auth-server";
import { buildConsultingExportZip } from "@/lib/consulting-export";
import { normalizeLogoBase64 } from "@/lib/pdf-logo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Legacy alias — same consulting package, Quatelio filename prefix. */
export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireSessionRole();
  if (!gate.ok) return gate.response;

  const { id } = await context.params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId) || numericId <= 0) {
    return NextResponse.json({ error: "Invalid asset id." }, { status: 400 });
  }

  const asset = await getAssetById(numericId);
  if (!asset) {
    return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  }

  const project = await getProject(asset.projectId);
  const [companyName, confidentialityFooter, logoB64] = await Promise.all([
    getKv("company_name"),
    getKv("confidentiality_footer"),
    getKv("branding_logo_png_base64"),
  ]);

  const logoBase64 = logoB64 ? normalizeLogoBase64(logoB64) : undefined;

  const { buffer, filename } = await buildConsultingExportZip({
    asset,
    project: project ?? null,
    branding: {
      clientLabel: project
        ? `${project.clientName} · ${project.projectCode} (${project.consultantOwner})`
        : undefined,
      companyName: companyName ?? "BDC Pulse",
      confidentialityFooter:
        confidentialityFooter ?? "CONFIDENTIAL · For authorized recipients only.",
      logoBase64,
    },
    filenameVariant: "quatelio",
  });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
