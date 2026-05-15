"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const providerModels = {
  gemini: ["gemini-2.5-flash", "gemini-2.5-pro"],
  openai: ["gpt-4o", "gpt-4-turbo"],
  anthropic: ["claude-3-5-sonnet-latest", "claude-3-opus-latest"],
  grok: ["grok-3", "grok-3-mini"],
};

type Provider = keyof typeof providerModels;

export default function SettingsPage() {
  const [provider, setProvider] = useState<Provider>("gemini");
  const [model, setModel] = useState(providerModels.gemini[0]);
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [configuredInfo, setConfiguredInfo] = useState<string>("");

  const [storeLlmTraces, setStoreLlmTraces] = useState(false);
  const [storeLlmAudit, setStoreLlmAudit] = useState(false);
  const [encryptLlmAuditAtRest, setEncryptLlmAuditAtRest] = useState(false);
  const [defaultLocale, setDefaultLocale] = useState<"de" | "en">("de");
  const [companyName, setCompanyName] = useState("");
  const [confFooter, setConfFooter] = useState("");
  const [logoHint, setLogoHint] = useState<string>("");
  const [prefsLoading, setPrefsLoading] = useState(false);

  useEffect(() => {
    fetch("/api/settings/llm")
      .then((res) => res.json())
      .then((data) => {
        if (!data?.configured) return;
        setProvider(data.provider);
        setModel(data.model);
        setConfiguredInfo(`Configured (${data.provider} / ${data.model}) - ${data.maskedKey}`);
      });
  }, []);

  useEffect(() => {
    fetch("/api/settings/app")
      .then((res) => res.json())
      .then((data) => {
        if (!data || data.error) return;
        setStoreLlmTraces(!!data.storeLlmTraces);
        setStoreLlmAudit(!!data.storeLlmAudit);
        setEncryptLlmAuditAtRest(!!data.encryptLlmAuditAtRest);
        setDefaultLocale(data.defaultLocale === "en" ? "en" : "de");
        setCompanyName(data.companyName ?? "");
        setConfFooter(data.confidentialityFooter ?? "");
        setLogoHint(data.brandingLogoUploaded ? "Logo stored" : "");
      })
      .catch(() => null);
  }, []);

  const savePrefs = async () => {
    setPrefsLoading(true);
    const res = await fetch("/api/settings/app", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeLlmTraces,
        storeLlmAudit,
        encryptLlmAuditAtRest,
        defaultLocale,
        companyName,
        confidentialityFooter: confFooter,
      }),
    });
    setPrefsLoading(false);
    if (!res.ok) {
      toast.error("Could not save app preferences.");
      return;
    }
    toast.success("App preferences saved.");
  };

  const onLogoPick = async (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const raw = String(reader.result ?? "");
      const b64 = raw.includes(",") ? raw.split(",", 2)[1] : raw;
      const res = await fetch("/api/settings/app", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoPngBase64: b64 }),
      });
      if (!res.ok) {
        toast.error("Logo upload failed.");
        return;
      }
      setLogoHint("Logo stored");
      toast.success("Logo saved for PDF reports.");
    };
    reader.readAsDataURL(file);
  };

  const clearLogo = async () => {
    const res = await fetch("/api/settings/app", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logoPngBase64: null }),
    });
    if (!res.ok) {
      toast.error("Could not remove logo.");
      return;
    }
    setLogoHint("");
    toast.success("Logo cleared.");
  };

  const save = async () => {
    if (!apiKey) {
      toast.error("Please enter an API key.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/settings/llm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, model, apiKey }),
    });
    setLoading(false);
    if (!res.ok) {
      toast.error("Saving LLM settings failed.");
      return;
    }
    toast.success("LLM settings saved securely.");
    setConfiguredInfo(`Configured (${provider} / ${model})`);
    setApiKey("");
  };

  const testConnection = async () => {
    setTesting(true);
    const res = await fetch("/api/settings/llm/test", { method: "POST" });
    setTesting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      toast.error(data?.error ?? "Connection test failed.");
      return;
    }
    toast.success("LLM connection successful.");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Settings</h2>
        <p className="text-slate-600">
          Tenant defaults for LLMs, auditing, localization, and client-facing PDF branding.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workspace preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={storeLlmTraces}
              onChange={(e) => setStoreLlmTraces(e.target.checked)}
            />
            <span>
              <span className="font-semibold">Store LLM prompt/response traces</span>
              <span className="block text-xs text-slate-600">
                Improves auditability; disable when working with highly confidential client data.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={storeLlmAudit}
              onChange={(e) => setStoreLlmAudit(e.target.checked)}
            />
            <span>
              <span className="font-semibold">Persist full LLM audit (prompt + response)</span>
              <span className="block text-xs text-slate-600">
                Stores the narrative prompt and provider payload on each analysis, independent of UI traces. Use only
                when your retention policy allows.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={encryptLlmAuditAtRest}
              onChange={(e) => setEncryptLlmAuditAtRest(e.target.checked)}
              disabled={!storeLlmAudit && !storeLlmTraces}
            />
            <span>
              <span className="font-semibold">Encrypt stored LLM audit at rest</span>
              <span className="block text-xs text-slate-600">
                Uses BDC_PULSE_ENCRYPTION_SECRET (same as API keys). Required for decrypt on read — keep the secret
                stable across backups.
              </span>
            </span>
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Default report language</label>
              <select
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                value={defaultLocale}
                onChange={(e) => setDefaultLocale(e.target.value as "de" | "en")}
              >
                <option value="de">Deutsch</option>
                <option value="en">English</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Company name on PDF header</label>
              <input
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">Confidentiality footer</label>
            <textarea
              className="min-h-[72px] w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              value={confFooter}
              onChange={(e) => setConfFooter(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">Logo (PNG) for PDF reports</label>
            <input
              type="file"
              accept="image/png"
              onChange={(e) => void onLogoPick(e.target.files?.[0])}
              className="text-sm"
            />
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              {logoHint ? <span>{logoHint}</span> : null}
              <Button type="button" variant="outline" size="sm" onClick={() => void clearLogo()}>
                Remove logo
              </Button>
            </div>
          </div>

          <Button onClick={() => void savePrefs()} disabled={prefsLoading}>
            {prefsLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save preferences
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>LLM API Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Provider</label>
              <select
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                value={provider}
                onChange={(e) => {
                  const p = e.target.value as Provider;
                  setProvider(p);
                  setModel(providerModels[p][0]);
                }}
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="grok">Grok (xAI)</option>
                <option value="gemini">Gemini</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Model</label>
              <select
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              >
                {providerModels[provider].map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">API Key (encrypted at rest)</label>
            <input
              type="password"
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste provider API key"
            />
          </div>

          {configuredInfo ? (
            <p className="rounded-md bg-muted px-3 py-2 text-sm text-slate-700">{configuredInfo}</p>
          ) : null}

          <div className="flex gap-3">
            <Button onClick={save} disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : "Save Configuration"}
            </Button>
            <Button variant="outline" onClick={testConnection} disabled={testing}>
              {testing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Testing...</> : "Test Connection"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
