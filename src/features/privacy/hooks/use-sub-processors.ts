"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api/request";
import type { SubProcessor } from "@/types/dpo";

interface PaginatedResponse<T> {
  data: T[];
  meta?: {
    total?: number;
    start?: number;
    stop?: number;
  };
}

export interface CreateSubProcessorRequest {
  name: string;
  purpose?: string;
  dataCategories?: string;
  country?: string;
}

export interface UpdateSubProcessorRequest {
  name?: string;
  purpose?: string;
  dataCategories?: string;
  country?: string;
}

interface UseSubProcessorsParams {
  start?: number;
  stop?: number;
}

/**
 * Fetch all sub-processors with optional pagination
 */
export function useSubProcessors(params?: UseSubProcessorsParams) {
  return useQuery<PaginatedResponse<SubProcessor>>({
    queryKey: ["sub-processors", params],
    queryFn: () =>
      apiGet<PaginatedResponse<SubProcessor>>(
        "/sub-processors",
        params
      ),
  });
}

/**
 * Create a new sub-processor
 */
export function useCreateSubProcessor() {
  const queryClient = useQueryClient();

  return useMutation<SubProcessor, Error, CreateSubProcessorRequest>({
    mutationFn: (data) =>
      apiPost<SubProcessor>("/sub-processors", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sub-processors"] });
    },
  });
}

/**
 * Update an existing sub-processor
 */
export function useUpdateSubProcessor(spId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    SubProcessor,
    Error,
    UpdateSubProcessorRequest
  >({
    mutationFn: (data) =>
      apiPatch<SubProcessor>(
        `/sub-processors/${spId}`,
        data
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["sub-processors"],
      });
    },
  });
}

/**
 * Delete a sub-processor
 */
export function useDeleteSubProcessor() {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, string>({
    mutationFn: (spId) =>
      apiDelete(`/sub-processors/${spId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["sub-processors"],
      });
    },
  });
}
