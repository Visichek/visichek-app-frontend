"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/request";
import { POLLING_INTERVALS, pollWhenAuthenticated } from "@/lib/query/polling";
import type { JobListParams, JobListResponse, JobRecord } from "@/types/job";

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
 */
export function useJobs(params?: JobListParams) {
  return useQuery<JobListResponse>({
    queryKey: jobKeys.list(params),
    queryFn: async () => {
      const data = await apiGet<JobListResponse | JobRecord[]>("/jobs", params);
      // Older backend builds returned a bare array — normalise both shapes.
      if (Array.isArray(data)) {
        return {
          items: data,
          total: data.length,
          skip: params?.skip ?? 0,
          limit: params?.limit ?? data.length,
        };
      }
      return data;
    },
    placeholderData: keepPreviousData,
    // Jobs change fast; keep the list fresh without beating the endpoint.
    refetchInterval: () => pollWhenAuthenticated(POLLING_INTERVALS.jobsList),
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
      return pollWhenAuthenticated(POLLING_INTERVALS.jobDetail);
    },
  });
}
