"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Props = { onCreated: () => void; variant?: "card" | "inline" };

export function CreateProjectForm({ onCreated, variant = "card" }: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    clientName: "",
    industry: "",
    projectCode: "",
    consultantOwner: "",
    projectDate: new Date().toISOString().slice(0, 10),
  });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("Could not create project (check permissions).");
      return;
    }
    toast.success("Project created.");
    setForm((f) => ({
      ...f,
      clientName: "",
      industry: "",
      projectCode: "",
    }));
    onCreated();
  };

  const wrapper = variant === "card" ? "rounded-xl border border-border bg-white p-4" : "";

  return (
    <div className={wrapper}>
      <p className="mb-3 text-sm font-semibold text-slate-900">Create project</p>
      <form className="grid gap-3 md:grid-cols-2" onSubmit={save}>
        <Field label="Client name" value={form.clientName} onChange={(v) => setForm({ ...form, clientName: v })} />
        <Field label="Industry" value={form.industry} onChange={(v) => setForm({ ...form, industry: v })} />
        <Field label="Project code" value={form.projectCode} onChange={(v) => setForm({ ...form, projectCode: v })} />
        <Field
          label="Consultant / owner"
          value={form.consultantOwner}
          onChange={(v) => setForm({ ...form, consultantOwner: v })}
        />
        <div className="space-y-1 md:col-span-2">
          <label className="text-sm font-semibold">Project date</label>
          <input
            type="date"
            required
            className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
            value={form.projectDate}
            onChange={(e) => setForm({ ...form, projectDate: e.target.value })}
          />
        </div>
        <div className="md:col-span-2">
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create project"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-semibold">{label}</label>
      <input
        required
        className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
