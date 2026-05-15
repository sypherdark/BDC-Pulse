"use client";

import { useRouter } from "next/navigation";
import { CreateProjectForm } from "@/components/create-project-form";

export function CreateProjectSection() {
  const router = useRouter();
  return <CreateProjectForm onCreated={() => router.refresh()} variant="inline" />;
}
