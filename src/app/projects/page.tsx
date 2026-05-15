import Link from "next/link";
import { listProjects } from "@/db/repository";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateProjectSection } from "./create-project-section";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProjectsPage() {
  const rows = await listProjects();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Projects</h2>
        <p className="text-slate-600">
          Every analysis is stored under a project with client metadata. Create a project here, then attach uploads on{" "}
          <Link className="font-semibold text-[#0a6ed1]" href="/import">
            Import
          </Link>
          .
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Catalog</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.length === 0 ? (
            <p className="text-sm text-slate-600">No projects yet.</p>
          ) : (
            rows.map((p) => (
              <div
                key={p.id}
                className="flex flex-col gap-1 rounded-lg border border-border bg-white p-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">
                    {p.clientName}{" "}
                    <span className="text-slate-500">
                      · {p.projectCode} · {p.industry}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500">
                    Owner: {p.consultantOwner} · Date: {p.projectDate}
                  </p>
                </div>
                <p className="text-xs text-slate-400">ID #{p.id}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create project</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateProjectSection />
        </CardContent>
      </Card>
    </div>
  );
}
