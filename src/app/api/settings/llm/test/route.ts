import { NextResponse } from "next/server";
import { getLlmSettings } from "@/db/repository";
import { decryptSecret } from "@/lib/crypto";
import { testLlmConnection } from "@/lib/llm";
import { requireMutateRole } from "@/lib/auth-server";

export async function POST() {
  const gate = await requireMutateRole();
  if (!gate.ok) return gate.response;

  const config = await getLlmSettings();
  if (!config) {
    return NextResponse.json({ error: "No LLM API configuration found." }, { status: 400 });
  }

  try {
    await testLlmConnection({
      provider: config.provider as "openai" | "anthropic" | "grok" | "gemini",
      model: config.model,
      apiKey: decryptSecret(config.encryptedApiKey),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Connection test failed." },
      { status: 400 },
    );
  }
}
