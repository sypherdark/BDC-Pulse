import { NextResponse } from "next/server";
import { z } from "zod";
import { getKv, setKv } from "@/db/repository";
import { requireMutateRole, requireSessionRole } from "@/lib/auth-server";

const KEYS = {
  storeLlmTraces: "store_llm_traces",
  storeLlmAudit: "store_llm_audit",
  encryptLlmAuditAtRest: "encrypt_llm_audit_at_rest",
  defaultLocale: "default_locale",
  companyName: "company_name",
  confidentialityFooter: "confidentiality_footer",
  logoPngBase64: "branding_logo_png_base64",
} as const;

const patchSchema = z.object({
  storeLlmTraces: z.boolean().optional(),
  storeLlmAudit: z.boolean().optional(),
  encryptLlmAuditAtRest: z.boolean().optional(),
  defaultLocale: z.enum(["de", "en"]).optional(),
  companyName: z.string().max(120).optional(),
  confidentialityFooter: z.string().max(500).optional(),
  logoPngBase64: z.string().max(8_000_000).nullable().optional(),
});

export async function GET() {
  const session = await requireSessionRole();
  if (!session.ok) return session.response;

  const [tracesRaw, auditRaw, encRaw, locale, companyName, confidentialityFooter] = await Promise.all([
    getKv(KEYS.storeLlmTraces),
    getKv(KEYS.storeLlmAudit),
    getKv(KEYS.encryptLlmAuditAtRest),
    getKv(KEYS.defaultLocale),
    getKv(KEYS.companyName),
    getKv(KEYS.confidentialityFooter),
  ]);

  const hasLogo = !!(await getKv(KEYS.logoPngBase64));

  return NextResponse.json({
    storeLlmTraces: tracesRaw === "1",
    storeLlmAudit: auditRaw === "1",
    encryptLlmAuditAtRest: encRaw === "1",
    defaultLocale: locale === "en" ? "en" : "de",
    companyName: companyName ?? "",
    confidentialityFooter:
      confidentialityFooter ?? "CONFIDENTIAL · For authorized recipients only.",
    brandingLogoUploaded: hasLogo,
  });
}

export async function POST(request: Request) {
  const auth = await requireMutateRole();
  if (!auth.ok) return auth.response;

  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid app settings payload." }, { status: 400 });
  }

  const data = parsed.data;
  if (data.storeLlmTraces !== undefined) {
    await setKv(KEYS.storeLlmTraces, data.storeLlmTraces ? "1" : "0");
  }
  if (data.storeLlmAudit !== undefined) {
    await setKv(KEYS.storeLlmAudit, data.storeLlmAudit ? "1" : "0");
  }
  if (data.encryptLlmAuditAtRest !== undefined) {
    await setKv(KEYS.encryptLlmAuditAtRest, data.encryptLlmAuditAtRest ? "1" : "0");
  }
  if (data.defaultLocale !== undefined) {
    await setKv(KEYS.defaultLocale, data.defaultLocale);
  }
  if (data.companyName !== undefined) {
    await setKv(KEYS.companyName, data.companyName);
  }
  if (data.confidentialityFooter !== undefined) {
    await setKv(KEYS.confidentialityFooter, data.confidentialityFooter);
  }
  if (data.logoPngBase64 !== undefined) {
    if (data.logoPngBase64 === null || data.logoPngBase64 === "") {
      await setKv(KEYS.logoPngBase64, "");
    } else {
      await setKv(KEYS.logoPngBase64, data.logoPngBase64);
    }
  }

  return NextResponse.json({ ok: true });
}
