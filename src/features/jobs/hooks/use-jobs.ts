"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/request";
import type { JobListParams, JobRecord } from "@/types/job";

// Centralised keys so anything that invalidates jobs can do so cleanly.
export const jobKeys = {
  all: ["jobs"] as const,
  list: (params?: JobListParams) => ["jobs", "list", params ?? {}] as const,
  detail: (taskId: string) => ["jobs", "detail", taskId] as const,
};

/**
 * Paginated list of queued writes for the caller's tenant — powers the
 * "Recent activity" page and the jobs detail deep-link from failure
 * notifications.
 *
 * Uses the `start` / `stop` pagination convention (not `skip` / `limit`).
 */
export function useJobs(params?: JobListParams) {
  return useQuery<JobRecord[]>({
    queryKey: jobKeys.list(params),
    queryFn: () => apiGet<JobRecord[]>("/jobs", params),
    placeholderData: keepPreviousData,
    // Jobs change fast; keep the list fresh without beating the endpoint.
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
    staleTime: 2_000,
  });
}

/**
 * Fetch a single job row. This shares the `["jobs", jobId]` key with
 * `useJobPolling`, so both stay in sync while a write is in flight.
 */
export function useJob(taskId: string | null | undefined) {
  return useQuery<JobRecord>({
    queryKey: ["jobs", taskId ?? ""],
    queryFn: () => apiGet<JobRecord>(`/jobs/${taskId}`),
    enabled: !!taskId,
    // Keep auto-refreshing while the job is still running.
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      if (status === "succeeded" || status === "failed") return false;
      return 1_000;
    },
  });
}
