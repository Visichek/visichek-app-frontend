"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api/request";
import type { Plan } from "@/types/billing";

interface PaginatedResponse<T> {
  data: T[];
  meta?: {
    skip?: number;
    limit?: number;
    total?: number;
  };
}

interface UsePlansParams {
  status?: string;
  tier?: string;
  skip?: number;
  limit?: number;
}

/**
 * Fetch all plans with optional filtering and pagination
 */
export function usePlans(params?: UsePlansParams) {
  return useQuery<PaginatedResponse<Plan>>({
    queryKey: ["plans", params],
    queryFn: () => apiGet<PaginatedResponse<Plan>>("/v1/plans", params),
  });
}

/**
 * Fetch a single plan by ID
 */
export function usePlan(planId: string) {
  return useQuery<Plan>({
    queryKey: ["plans", planId],
    queryFn: () => apiGet<Plan>(`/v1/plans/${planId}`),
    enabled: !!planId,
  });
}

interface CreatePlanRequest {
  name: string;
  display_name?: string;
  tier: string;
  price_minor?: number;
  currency?: string;
  billing_cycle?: string;
  description?: string;
  is_public?: boolean;
  feature_rules?: Plan["feature_rules"];
  crud_limits?: Plan["crud_limits"];
  retrieval_quotas?: Plan["retrieval_quotas"];
  storage_limits?: Plan["storage_limits"];
  tenant_cap_limits?: Plan["tenant_cap_limits"];
}

/**
 * Create a new plan
 */
export function useCreatePlan() {
  const queryClient = useQueryClient();

  return useMutation<Plan, Error, CreatePlanRequest>({
    mutationFn: (data) => apiPost<Plan>("/v1/plans", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
    },
  });
}

interface UpdatePlanRequest extends Partial<CreatePlanRequest> {}

/**
 * Update an existing plan
 */
export function useUpdatePlan(planId: string) {
  const queryClient = useQueryClient();

  return useMutation<Plan, Error, UpdatePlanRequest>({
    mutationFn: (data) => apiPut<Plan>(`/v1/plans/${planId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans", planId] });
      queryClient.invalidateQueries({ queryKey: ["plans"] });
    },
  });
}

/**
 * Activate a plan (change status to active)
 */
export function useActivatePlan() {
  const queryClient = useQueryClient();

  return useMutation<Plan, Error, string>({
    mutationFn: (planId) => apiPost<Plan>(`/v1/plans/${planId}/activate`),
    onSuccess: (_, planId) => {
      queryClient.invalidateQueries({ queryKey: ["plans", planId] });
      queryClient.invalidateQueries({ queryKey: ["plans"] });
    },
  });
}

/**
 * Archive a plan (change status to archived)
 */
export function useArchivePlan() {
  const queryClient = useQueryClient();

  return useMutation<Plan, Error, string>({
    mutationFn: (planId) => apiPost<Plan>(`/v1/plans/${planId}/archive`),
    onSuccess: (_, planId) => {
      queryClient.invalidateQueries({ queryKey: ["plans", planId] });
      queryClient.invalidateQueries({ queryKey: ["plans"] });
    },
  });
}

interface ClonePlanRequest {
  sourcePlanId: string;
  newName: string;
  newDisplayName?: string;
}

/**
 * Clone a plan
 */
export function useClonePlan() {
  const queryClient = useQueryClient();

  return useMutation<
    Plan,
    Error,
    ClonePlanRequest
  >({
    mutationFn: ({ sourcePlanId, newName, newDisplayName }) =>
      apiPost<Plan>(
        `/v1/plans/${sourcePlanId}/clone`,
        {},
        {
          params: {
            new_name: newName,
            ...(newDisplayName && { new_display_name: newDisplayName }),
          },
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
    },
  });
}

/**
 * Delete a plan
 */
export function useDeletePlan() {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, string>({
    mutationFn: (planId) => apiDelete(`/v1/plans/${planId}`),
    onSuccess: (_, planId) => {
      queryClient.invalidateQueries({ queryKey: ["plans", planId] });
      queryClient.invalidateQueries({ queryKey: ["plans"] });
    },
  });
}
