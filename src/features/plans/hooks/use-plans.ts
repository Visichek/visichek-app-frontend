"use client";

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api/request";
import { apiGetList } from "@/lib/api/list";
import { bulkAction } from "@/lib/api/bulk";
import type { Plan, PlanFeatureCatalogEntry, Limitations } from "@/types/billing";
import type { ListResponse, BulkJobResult } from "@/types/list";

interface UsePlansParams {
  status?: string;
  tier?: string;
  includedFeature?: string;
  q?: string;
  sort?: string;
  facets?: string;
  skip?: number;
  limit?: number;
}

/**
 * Fetch the paginated plan list. Returns the new `{ items, meta }` envelope
 * per tables.txt §1.2.
 */
export function usePlans(params?: UsePlansParams) {
  return useQuery<ListResponse<Plan>>({
    queryKey: ["plans", params],
    queryFn: () => apiGetList<Plan>("/plans", params as Record<string, unknown> | undefined),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
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
    staleTime: 5 * 60 * 1000,
  });
}

interface CreatePlanRequest {
  name: string;
  displayName?: string;
  tier: string;
  basePriceMonthly?: number;
  basePriceYearly?: number;
  currency?: string;
  description?: string;
  isPublic?: boolean;
  sortOrder?: number;
  prioritySupport?: boolean;
  slaResponseHours?: number | null;
  customBranding?: boolean;
  apiAccess?: boolean;
  featureRules?: Plan["featureRules"];
  crudLimits?: Plan["crudLimits"];
  retrievalQuotas?: Plan["retrievalQuotas"];
  storageLimits?: Plan["storageLimits"];
  tenantCaps?: Plan["tenantCaps"];
}

export interface UpdatePlanRequest {
  displayName?: string;
  tier?: string;
  description?: string;
  isPublic?: boolean;
  sortOrder?: number;
  basePriceMonthly?: number;
  basePriceYearly?: number;
  currency?: string;
  prioritySupport?: boolean;
  slaResponseHours?: number | null;
  customBranding?: boolean;
  apiAccess?: boolean;
  storageLimits?: Plan["storageLimits"];
  tenantCaps?: Plan["tenantCaps"];
  featureRules?: Plan["featureRules"];
  crudLimits?: Plan["crudLimits"];
  retrievalQuotas?: Plan["retrievalQuotas"];
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
    mutationFn: (planId) => apiDelete(`/plans/${planId}`),
    onSuccess: (_, planId) => {
      queryClient.invalidateQueries({ queryKey: ["plans", planId] });
      queryClient.invalidateQueries({ queryKey: ["plans"] });
    },
  });
}

/**
 * Bulk activate / archive / delete plans via a single queued job per
 * tables.txt §1.2.
 */
export function useBulkPlanAction(action: "activate" | "archive" | "delete") {
  const queryClient = useQueryClient();
  return useMutation<BulkJobResult, Error, { ids: string[]; atomic?: boolean }>({
    mutationFn: ({ ids, atomic }) =>
      bulkAction(`/plans/bulk/${action}`, ids, { atomic }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
    },
  });
}

/**
 * Fetch the catalog of togglable plan features. The list is driven by the
 * backend's `TOGGLEABLE_FEATURES` registry, so new features appear here
 * automatically — the frontend doesn't need a code change to render them.
 */
export function useFeatureCatalog() {
  return useQuery<PlanFeatureCatalogEntry[]>({
    queryKey: ["plans", "features", "catalog"],
    queryFn: () => apiGet<PlanFeatureCatalogEntry[]>("/plans/features/catalog"),
    staleTime: 30 * 60 * 1000,
  });
}

/**
 * Enterprise composer review step: `POST /v1/admins/plans/{id}/preview-limitations`.
 * Merges a draft `PlanUpdate` body on top of the stored plan and re-runs the
 * same denied-endpoints / denied-features / caps composition used for a real
 * tenant — no persistence, so it's safe to call on every review-step render.
 */
export function usePreviewPlanLimitations(planId: string) {
  return useMutation<Limitations, Error, UpdatePlanRequest>({
    mutationFn: (draft) =>
      apiPost<Limitations>(`/admins/plans/${planId}/preview-limitations`, draft),
  });
}

interface TogglePlanFeatureVariables {
  featureKey: string;
  enabled: boolean;
}

/**
 * Toggle a single feature on a plan. The backend queues the write and
 * `apiPost` auto-polls the resulting job, so the mutation stays pending
 * until the worker has committed and the plan-cache fanout has run.
 */
export function useTogglePlanFeature(planId: string) {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, TogglePlanFeatureVariables>({
    mutationFn: ({ featureKey, enabled }) =>
      apiPost(`/plans/${planId}/features/${featureKey}`, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans", planId] });
      queryClient.invalidateQueries({ queryKey: ["plans"] });
    },
  });
}
