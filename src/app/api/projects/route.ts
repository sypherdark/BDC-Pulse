import { NextResponse } from "next/server";
import { z } from "zod";
import { createProject, listProjects } from "@/db/repository";
import { requireMutateRole, requireSessionRole } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireSessionRole();
  if (!session.ok) return session.response;
  const rows = await listProjects();
  return NextResponse.json(rows);
}

const createSchema = z.object({
  clientName: z.string().min(1),
  industry: z.string().min(1),
  projectCode: z.string().min(1),
  consultantOwner: z.string().min(1),
  projectDate: z.string().min(1),
});

export async function POST(request: Request) {
  const auth = await requireMutateRole();
  if (!auth.ok) return auth.response;

  const json = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid project payload." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const project = await createProject({
    clientName: parsed.data.clientName,
    industry: parsed.data.industry,
    projectCode: parsed.data.projectCode,
    consultantOwner: parsed.data.consultantOwner,
    projectDate: parsed.data.projectDate,
    createdAt: now,
  });

  return NextResponse.json(project);
}
