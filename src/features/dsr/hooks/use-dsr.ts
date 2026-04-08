"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch } from "@/lib/api/request";
import type {
  DataSubjectRequest,
  CreateDSRRequest,
} from "@/types/dpo";

interface PaginatedResponse<T> {
  data: T[];
  meta?: {
    total?: number;
    start?: number;
    stop?: number;
  };
}

interface UseDataSubjectRequestsParams {
  status?: string;
  type?: string;
  start?: number;
  stop?: number;
}

interface UpdateDSRRequest {
  status?: string;
  description?: string;
}

/**
 * Fetch all data subject requests with optional filtering and pagination
 */
export function useDataSubjectRequests(
  params?: UseDataSubjectRequestsParams
) {
  return useQuery<PaginatedResponse<DataSubjectRequest>>({
    queryKey: ["dsr", params],
    queryFn: () =>
      apiGet<PaginatedResponse<DataSubjectRequest>>("/dsr", params),
  });
}

/**
 * Fetch a single data subject request by ID
 */
export function useDataSubjectRequest(dsrId: string) {
  return useQuery<DataSubjectRequest>({
    queryKey: ["dsr", dsrId],
    queryFn: () => apiGet<DataSubjectRequest>(`/dsr/${dsrId}`),
    enabled: !!dsrId,
  });
}

/**
 * Create a new data subject request
 */
export function useCreateDSR() {
  const queryClient = useQueryClient();

  return useMutation<DataSubjectRequest, Error, CreateDSRRequest>({
    mutationFn: (data) => apiPost<DataSubjectRequest>("/dsr", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dsr"] });
    },
  });
}

/**
 * Update an existing data subject request
 */
export function useUpdateDSR(dsrId: string) {
  const queryClient = useQueryClient();

  return useMutation<DataSubjectRequest, Error, UpdateDSRRequest>({
    mutationFn: (data) =>
      apiPatch<DataSubjectRequest>(`/dsr/${dsrId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dsr", dsrId] });
      queryClient.invalidateQueries({ queryKey: ["dsr"] });
    },
  });
}
