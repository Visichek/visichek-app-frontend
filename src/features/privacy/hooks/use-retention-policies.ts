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
  data_type: string;
  retention_days: number;
  action: DeletionAction;
  auto_execute?: boolean;
}

export interface UpdateRetentionPolicyRequest {
  data_type?: string;
  retention_days?: number;
  action?: DeletionAction;
  auto_execute?: boolean;
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
        "/v1/retention-policies",
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
      apiPost<RetentionPolicy>("/v1/retention-policies", data),
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
        `/v1/retention-policies/${policyId}`,
        data
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["retention-policies"],
      });
    },
  });
}
