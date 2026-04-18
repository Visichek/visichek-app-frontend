"use client";

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch } from "@/lib/api/request";
import type {
  Incident,
  CreateIncidentRequest,
  UpdateIncidentRequest,
} from "@/types/incident";

interface PaginatedResponse<T> {
  data: T[];
  meta?: {
    total?: number;
    start?: number;
    stop?: number;
  };
}

interface UseIncidentsParams {
  status?: string;
  severity?: string;
  type?: string;
  start?: number;
  stop?: number;
}

/**
 * Fetch all incidents with optional filtering and pagination
 */
export function useIncidents(params?: UseIncidentsParams) {
  return useQuery<PaginatedResponse<Incident>>({
    queryKey: ["incidents", params],
    queryFn: () => apiGet<PaginatedResponse<Incident>>("/incidents", params),
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
 * Auto-refreshes every 60 seconds.
 */
export function useApproachingDeadlineIncidents() {
  return useQuery<PaginatedResponse<Incident>>({
    queryKey: ["incidents", "approaching-deadline"],
    queryFn: () => apiGet<PaginatedResponse<Incident>>("/incidents/approaching-deadline"),
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
    staleTime: 30000,
  });
}
