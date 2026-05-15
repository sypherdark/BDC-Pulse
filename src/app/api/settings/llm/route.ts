import { NextResponse } from "next/server";
import { z } from "zod";
import { getLlmSettings, upsertLlmSettings } from "@/db/repository";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { requireMutateRole, requireSessionRole } from "@/lib/auth-server";

const schema = z.object({
  provider: z.enum(["openai", "anthropic", "grok", "gemini"]),
  model: z.string().min(2),
  apiKey: z.string().min(10),
});

export async function GET() {
  const gate = await requireSessionRole();
  if (!gate.ok) return gate.response;

  const config = await getLlmSettings();
  if (!config) {
    return NextResponse.json({
      configured: false,
      provider: "gemini",
      model: "gemini-2.5-flash",
    });
  }
  let maskedKey = "********";
  try {
    maskedKey = `${decryptSecret(config.encryptedApiKey).slice(0, 4)}********`;
  } catch {
    maskedKey = "********";
  }
  return NextResponse.json({
    configured: true,
    provider: config.provider,
    model: config.model,
    updatedAt: config.updatedAt,
    maskedKey,
  });
}

export async function POST(request: Request) {
  const gate = await requireMutateRole();
  if (!gate.ok) return gate.response;

  const json = await request.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid LLM settings payload." }, { status: 400 });
  }

  await upsertLlmSettings({
    provider: parsed.data.provider,
    model: parsed.data.model,
    encryptedApiKey: encryptSecret(parsed.data.apiKey),
  });

  return NextResponse.json({ ok: true });
}
