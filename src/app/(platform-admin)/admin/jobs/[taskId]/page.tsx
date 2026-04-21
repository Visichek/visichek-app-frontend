"use client";

import { use } from "react";
import { JobDetailView } from "@/features/jobs/components";

export default function AdminJobDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = use(params);
  return <JobDetailView taskId={taskId} listHref="/admin/jobs" />;
}
