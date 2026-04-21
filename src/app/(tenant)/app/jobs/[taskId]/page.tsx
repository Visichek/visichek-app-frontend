"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { JobDetailView } from "@/features/jobs/components";
import { useSession } from "@/hooks/use-session";

export default function JobDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = use(params);
  const router = useRouter();
  const { isAdmin } = useSession();

  useEffect(() => {
    if (isAdmin) router.replace(`/admin/jobs/${taskId}`);
  }, [isAdmin, router, taskId]);

  if (isAdmin) return null;
  return <JobDetailView taskId={taskId} listHref="/app/jobs" />;
}
