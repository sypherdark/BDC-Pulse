import type { IngestReport, IngestSkippedItem } from "@/lib/extract-uploads";

const REASON_LABEL: Record<IngestSkippedItem["reason"], string> = {
  unsupported_type: "Unsupported type",
  file_too_large: "Too large",
  zip_corrupt: "ZIP error",
  zip_entry_not_json: "Not JSON (in ZIP)",
  invalid_json: "Invalid JSON",
  empty_file: "Empty file",
};

export function IngestReportCard({ report }: { report: IngestReport }) {
  const processed = report.processed.length;
  const skipped = report.skipped.length;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/90 p-4 text-sm">
      <p className="font-semibold text-slate-900">Upload summary</p>
      <p className="mt-1 text-xs text-slate-600">
        Limits: JSON ≤ {report.limits.maxJsonLabel} · ZIP ≤ {report.limits.maxZipLabel}
      </p>
      <div className="mt-3 flex flex-wrap gap-4 text-xs">
        <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-900">
          {processed} processed
        </span>
        {skipped > 0 ? (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-950">
            {skipped} skipped
          </span>
        ) : null}
      </div>

      {processed > 0 ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-slate-700">Processed files</summary>
          <ul className="mt-2 max-h-32 space-y-1 overflow-auto text-xs text-slate-600">
            {report.processed.map((p) => (
              <li key={`${p.sourceArchive ?? ""}-${p.fileName}`}>
                {p.fileName}
                {p.sourceArchive ? <span className="text-slate-400"> (from {p.sourceArchive})</span> : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {skipped > 0 ? (
        <details className="mt-2" open={processed === 0}>
          <summary className="cursor-pointer text-xs font-medium text-amber-900">Skipped items</summary>
          <ul className="mt-2 max-h-40 space-y-2 overflow-auto">
            {report.skipped.map((s, i) => (
              <li key={`${s.name}-${s.reason}-${i}`} className="rounded border border-amber-100 bg-white px-2 py-1.5 text-xs">
                <span className="font-medium text-slate-800">{s.name}</span>
                {s.sourceArchive ? (
                  <span className="text-slate-500"> · in {s.sourceArchive}</span>
                ) : null}
                <span className="ml-1 rounded bg-amber-50 px-1 text-[10px] font-semibold uppercase text-amber-800">
                  {REASON_LABEL[s.reason]}
                </span>
                <p className="mt-0.5 text-slate-600">{s.detail}</p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
