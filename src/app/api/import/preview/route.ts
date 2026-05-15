import { NextResponse } from "next/server";
import { collectJsonFromUpload } from "@/lib/extract-uploads";
import { parseSacPortfolio } from "@/lib/analysis";
import { requireSessionRole } from "@/lib/auth-server";

export async function POST(request: Request) {
  const auth = await requireSessionRole();
  if (!auth.ok) return auth.response;

  const formData = await request.formData();
  const uploads = formData.getAll("files") as File[];
  if (!uploads.length) {
    return NextResponse.json({ error: "Select at least one .json or .zip file." }, { status: 400 });
  }

  let collectResult: Awaited<ReturnType<typeof collectJsonFromUpload>>;
  try {
    collectResult = await collectJsonFromUpload(uploads);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Could not read uploads: ${msg}` },
      { status: 400 },
    );
  }

  const { payloads, report: ingest, fatalError } = collectResult;

  if (!payloads.length) {
    return NextResponse.json(
      { error: fatalError ?? "No parseable JSON found.", ingest },
      { status: 400 },
    );
  }

  const outcome = parseSacPortfolio(payloads);
  if (!outcome.ok) {
    return NextResponse.json(
      { error: outcome.error, nonSacFiles: outcome.nonSacFiles, ingest },
      { status: 400 },
    );
  }

  const snippets = payloads.map((entry, idx) => {
    const serialized = JSON.stringify(entry.payload);
    return {
      index: idx,
      fileName: entry.fileName,
      preview: serialized.length > 3200 ? `${serialized.slice(0, 3200)}…` : serialized,
      parsed_summary:
        outcome.parsedPortfolio.files.find((file) => file.fileName === entry.fileName) ?? null,
    };
  });

  return NextResponse.json({
    summary: outcome.parsedPortfolio.summary,
    files: outcome.parsedPortfolio.files,
    previews: snippets,
    ingest,
  });
}
