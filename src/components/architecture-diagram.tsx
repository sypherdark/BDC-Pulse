import type { DataProductBlueprint } from "@/lib/types";

export function ArchitectureDiagram({ blueprint }: { blueprint: DataProductBlueprint }) {
  const facts = blueprint.factViews.join(", ");
  const dims = blueprint.dimensionViews.join(", ");

  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <svg viewBox="0 0 900 300" className="w-full">
        <rect x="20" y="95" width="220" height="110" rx="12" fill="#e9f2ff" stroke="#0a6ed1" />
        <text x="45" y="130" fontSize="16" fill="#0f172a">SAC Assets</text>
        <text x="45" y="155" fontSize="12" fill="#334155">Stories, Models, Planning</text>

        <rect x="340" y="70" width="220" height="160" rx="12" fill="#dbeafe" stroke="#0a6ed1" />
        <text x="362" y="108" fontSize="16" fill="#0f172a">BDC Data Product</text>
        <text x="362" y="133" fontSize="11" fill="#334155">{facts.slice(0, 65)}</text>
        <text x="362" y="150" fontSize="11" fill="#334155">{dims.slice(0, 65)}</text>

        <rect x="660" y="95" width="220" height="110" rx="12" fill="#f1f5f9" stroke="#1e293b" />
        <text x="685" y="130" fontSize="16" fill="#0f172a">SAP Datasphere</text>
        <text x="685" y="155" fontSize="12" fill="#334155">Fact + Dimension + Hierarchy</text>

        <line x1="240" y1="150" x2="340" y2="150" stroke="#0a6ed1" strokeWidth="3" />
        <line x1="560" y1="150" x2="660" y2="150" stroke="#0a6ed1" strokeWidth="3" />
      </svg>
    </div>
  );
}
