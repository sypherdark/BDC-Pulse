import { getAssetById, getKv, getProject } from "@/db/repository";
import { buildMigrationPdf } from "@/lib/pdf";
import { normalizeLogoBase64 } from "@/lib/pdf-logo";
import { NextResponse } from "next/server";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const asset = await getAssetById(Number(id));
  if (!asset) {
    return new NextResponse("Not found", { status: 404 });
  }

  const url = new URL(request.url);
  const rulesOnly = url.searchParams.get("rulesOnly") === "1" || url.searchParams.get("variant") === "rules";

  const project = await getProject(asset.projectId);
  const [companyName, confidentialityFooter, logoB64] = await Promise.all([
    getKv("company_name"),
    getKv("confidentiality_footer"),
    getKv("branding_logo_png_base64"),
  ]);

  const logoBase64 = logoB64 ? normalizeLogoBase64(logoB64) : undefined;

  try {
    const pdfBytes = await buildMigrationPdf(
      asset,
      {
        clientLabel: project
          ? `${project.clientName} · ${project.projectCode} (${project.consultantOwner})`
          : undefined,
        companyName: companyName ?? "",
        confidentialityFooter:
          confidentialityFooter ?? "CONFIDENTIAL · For authorized recipients only.",
        logoBase64,
      },
      { rulesOnly },
    );
    const filename = rulesOnly
      ? `bdc-pulse-rules-report-${asset.id}.pdf`
      : `bdc-pulse-report-${asset.id}.pdf`;
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown PDF error";
    return NextResponse.json(
      { error: "PDF generation failed.", detail: message },
      { status: 500 },
    );
  }
}
