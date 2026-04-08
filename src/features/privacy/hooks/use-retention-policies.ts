"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch } from "@/lib/api/request";
import type { RetentionPolicy } from "@/types/dpo";
import type { DeletionAction } from "@/types/enums";

interface PaginatedResponse<T> {
  data: T[];
  meta?: {
    total?: number;
    start?: number;
    stop?: number;
  };
}

export interface CreateRetentionPolicyRequest {
  dataType: string;
  retentionDays: number;
  action: DeletionAction;
  autoExecute?: boolean;
}

export interface UpdateRetentionPolicyRequest {
  dataType?: string;
  retentionDays?: number;
  action?: DeletionAction;
  autoExecute?: boolean;
}

interface UseRetentionPoliciesParams {
  start?: number;
  stop?: number;
}

/**
 * Fetch all retention policies with optional pagination
 */
export function useRetentionPolicies(params?: UseRetentionPoliciesParams) {
  return useQuery<PaginatedResponse<RetentionPolicy>>({
    queryKey: ["retention-policies", params],
    queryFn: () =>
      apiGet<PaginatedResponse<RetentionPolicy>>(
        "/retention-policies",
        params
      ),
  });
}

/**
 * Create a new retention policy
 */
export function useCreateRetentionPolicy() {
  const queryClient = useQueryClient();

  return useMutation<RetentionPolicy, Error, CreateRetentionPolicyRequest>({
    mutationFn: (data) =>
      apiPost<RetentionPolicy>("/retention-policies", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retention-policies"] });
    },
  });
}

/**
 * Update an existing retention policy
 */
export function useUpdateRetentionPolicy(policyId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    RetentionPolicy,
    Error,
    UpdateRetentionPolicyRequest
  >({
    mutationFn: (data) =>
      apiPatch<RetentionPolicy>(
        `/retention-policies/${policyId}`,
        data
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["retention-policies"],
      });
    },
  });
}
