"use client";

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch } from "@/lib/api/request";
import { apiGetList } from "@/lib/api/list";
import { bulkAction } from "@/lib/api/bulk";
import type {
  Incident,
  CreateIncidentRequest,
  UpdateIncidentRequest,
} from "@/types/incident";
import type { ListResponse, BulkJobResult } from "@/types/list";

interface UseIncidentsParams {
  status?: string;
  severity?: string;
  type?: string;
  riskLevel?: string;
  ndpcNotified?: boolean;
  approachingDeadline?: boolean;
  q?: string;
  sort?: string;
  facets?: string;
  skip?: number;
  limit?: number;
}

/**
 * Fetch the paginated incidents list. Returns the new `{ items, meta }`
 * envelope per tables.txt §2.8.
 */
export function useIncidents(params?: UseIncidentsParams) {
  return useQuery<ListResponse<Incident>>({
    queryKey: ["incidents", params],
    queryFn: () =>
      apiGetList<Incident>(
        "/incidents",
        params as Record<string, unknown> | undefined,
      ),
    placeholderData: keepPreviousData,
  });
}

/**
 * Fetch a single incident by ID
 */
export function useIncident(incidentId: string) {
  return useQuery<Incident>({
    queryKey: ["incidents", incidentId],
    queryFn: () => apiGet<Incident>(`/incidents/${incidentId}`),
    enabled: !!incidentId,
  });
}

/**
 * Create a new incident
 */
export function useCreateIncident() {
  const queryClient = useQueryClient();

  return useMutation<Incident, Error, CreateIncidentRequest>({
    mutationFn: (data) => apiPost<Incident>("/incidents", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
    },
  });
}

/**
 * Update an existing incident
 */
export function useUpdateIncident(incidentId: string) {
  const queryClient = useQueryClient();

  return useMutation<Incident, Error, UpdateIncidentRequest>({
    mutationFn: (data) =>
      apiPatch<Incident>(`/incidents/${incidentId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incidents", incidentId] });
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
    },
  });
}

/**
 * Fetch incidents approaching their 72h NDPC notification deadline.
 * Auto-refreshes every 60 seconds. Reuses the main list endpoint with the
 * `approachingDeadline=true` filter per tables.txt §2.8.
 */
export function useApproachingDeadlineIncidents() {
  return useQuery<ListResponse<Incident>>({
    queryKey: ["incidents", "approaching-deadline"],
    queryFn: () =>
      apiGetList<Incident>("/incidents", { approachingDeadline: true }),
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
    staleTime: 30000,
  });
}

/**
 * Bulk mark incidents as notified to NDPC, or set their status, per
 * tables.txt §2.8.
 */
export function useBulkMarkIncidentsNotified() {
  const queryClient = useQueryClient();
  return useMutation<
    BulkJobResult,
    Error,
    { ids: string[]; notificationSentAt?: number; atomic?: boolean }
  >({
    mutationFn: ({ ids, notificationSentAt, atomic }) =>
      bulkAction("/incidents/bulk/mark-notified", ids, {
        atomic,
        extras:
          notificationSentAt !== undefined ? { notificationSentAt } : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
    },
  });
}

export function useBulkSetIncidentStatus() {
  const queryClient = useQueryClient();
  return useMutation<
    BulkJobResult,
    Error,
    { ids: string[]; status: string; atomic?: boolean }
  >({
    mutationFn: ({ ids, status, atomic }) =>
      bulkAction("/incidents/bulk/status", ids, {
        atomic,
        extras: { status },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
    },
  });
}
