"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { JobsListView } from "@/features/jobs/components";
import { useSession } from "@/hooks/use-session";

export default function JobsPage() {
  const router = useRouter();
  const { isAdmin } = useSession();

  useEffect(() => {
    if (isAdmin) router.replace("/admin/jobs");
  }, [isAdmin, router]);

  if (isAdmin) return null;
  return <JobsListView basePath="/app/jobs" />;
}
