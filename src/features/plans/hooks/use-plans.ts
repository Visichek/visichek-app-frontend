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
    queryFn: () => apiGet<PaginatedResponse<Plan>>("/plans", params),
  });
}

/**
 * Fetch a single plan by ID
 */
export function usePlan(planId: string) {
  return useQuery<Plan>({
    queryKey: ["plans", planId],
    queryFn: () => apiGet<Plan>(`/plans/${planId}`),
    enabled: !!planId,
  });
}

interface CreatePlanRequest {
  name: string;
  displayName?: string;
  tier: string;
  priceMinor?: number;
  currency?: string;
  billingCycle?: string;
  description?: string;
  isPublic?: boolean;
  featureRules?: Plan["featureRules"];
  crudLimits?: Plan["crudLimits"];
  retrievalQuotas?: Plan["retrievalQuotas"];
  storageLimits?: Plan["storageLimits"];
  tenantCapLimits?: Plan["tenantCapLimits"];
}

/**
 * Create a new plan
 */
export function useCreatePlan() {
  const queryClient = useQueryClient();

  return useMutation<Plan, Error, CreatePlanRequest>({
    mutationFn: (data) => apiPost<Plan>("/plans", data),
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
    mutationFn: (data) => apiPut<Plan>(`/plans/${planId}`, data),
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
    mutationFn: (planId) => apiPost<Plan>(`/plans/${planId}/activate`),
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
    mutationFn: (planId) => apiPost<Plan>(`/plans/${planId}/archive`),
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
        `/plans/${sourcePlanId}/clone`,
        {},
        {
          params: {
            new_name: newName,
            ...(newDisplayName && { new_displayName: newDisplayName }),
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
    mutationFn: (planId) => apiDelete(`/plans/${planId}`),
    onSuccess: (_, planId) => {
      queryClient.invalidateQueries({ queryKey: ["plans", planId] });
      queryClient.invalidateQueries({ queryKey: ["plans"] });
    },
  });
}
