"use client";

import { JobsListView } from "@/features/jobs/components";

export default function AdminJobsPage() {
  return <JobsListView basePath="/admin/jobs" />;
}
