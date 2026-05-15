import { NextResponse } from "next/server";
import { listAssets } from "@/db/repository";
import { requireSessionRole } from "@/lib/auth-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const gate = await requireSessionRole();
  if (!gate.ok) return gate.response;

  const rows = await listAssets();
  return NextResponse.json(rows, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
