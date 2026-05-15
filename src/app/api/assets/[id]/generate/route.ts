import { NextResponse } from "next/server";
import { analysisFromAssetRow } from "@/lib/analysis-from-record";
import { getAssetById, saveBlueprint } from "@/db/repository";
import { generateDataProduct } from "@/lib/data-product";
import { requireMutateRole } from "@/lib/auth-server";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireMutateRole();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const numericId = Number(id);
  const asset = await getAssetById(numericId);

  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  const analysis = analysisFromAssetRow(asset);
  const blueprint = generateDataProduct(analysis);
  await saveBlueprint(numericId, JSON.stringify(blueprint));
  return NextResponse.json({ blueprint });
}
