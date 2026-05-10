"use client";

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut } from "@/lib/api/request";
import { apiGetList } from "@/lib/api/list";
import { bulkAction } from "@/lib/api/bulk";
import type { Subscription, SubscribeTenantRequest, ChangePlanRequest, CancelSubscriptionRequest } from "@/types/billing";
import type { ListResponse, BulkJobResult } from "@/types/list";

interface UseSubscriptionsParams {
  tenantId?: string;
  planId?: string;
  status?: string;
  billingCycle?: string;
  q?: string;
  sort?: string;
  facets?: string;
  skip?: number;
  limit?: number;
}

/**
 * Fetch the paginated subscriptions list. Returns the new `{ items, meta }`
 * envelope per tables.txt §1.3.
 */
export function useSubscriptions(params?: UseSubscriptionsParams) {
  return useQuery<ListResponse<Subscription>>({
    queryKey: ["subscriptions", params],
    queryFn: () =>
      apiGetList<Subscription>(
        "/subscriptions",
        params as Record<string, unknown> | undefined,
      ),
    placeholderData: keepPreviousData,
  });
}

/**
 * Bulk cancel subscriptions per tables.txt §1.3. `reason` is one per
 * batch — the worker applies it to every cancellation in the call.
 */
export function useBulkCancelSubscriptions() {
  const queryClient = useQueryClient();
  return useMutation<
    BulkJobResult,
    Error,
    { ids: string[]; reason: string; immediate: boolean; atomic?: boolean }
  >({
    mutationFn: ({ ids, reason, immediate, atomic }) =>
      bulkAction("/subscriptions/bulk/cancel", ids, {
        atomic,
        extras: { reason, immediate },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
    },
  });
}

/**
 * Fetch a single subscription by ID
 */
export function useSubscription(subscriptionId: string) {
  return useQuery<Subscription>({
    queryKey: ["subscriptions", subscriptionId],
    queryFn: () => apiGet<Subscription>(`/subscriptions/${subscriptionId}`),
    enabled: !!subscriptionId,
  });
}

/**
 * Fetch the active subscription for a tenant
 */
export function useActiveSubscription(tenantId: string) {
  return useQuery<Subscription>({
    queryKey: ["subscriptions", "tenant", tenantId, "active"],
    queryFn: () => apiGet<Subscription>(`/subscriptions/tenant/${tenantId}/active`),
    enabled: !!tenantId,
  });
}

/**
 * Create a new subscription
 */
export function useCreateSubscription() {
  const queryClient = useQueryClient();

  return useMutation<Subscription, Error, SubscribeTenantRequest>({
    mutationFn: (data) => apiPost<Subscription>("/subscriptions", data),
    onSuccess: (subscription) => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      queryClient.invalidateQueries({
        queryKey: ["subscriptions", "tenant", subscription.tenantId, "active"],
      });
    },
  });
}

/**
 * Change the plan for a subscription
 */
export function useChangePlan() {
  const queryClient = useQueryClient();

  return useMutation<Subscription, Error, ChangePlanRequest>({
    mutationFn: (data) => apiPost<Subscription>("/subscriptions/change-plan", data),
    onSuccess: (subscription) => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      queryClient.invalidateQueries({
        queryKey: ["subscriptions", subscription.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["subscriptions", "tenant", subscription.tenantId, "active"],
      });
      queryClient.invalidateQueries({ queryKey: ["me", "limitations"] });
      queryClient.invalidateQueries({ queryKey: ["usage"] });
    },
  });
}

/**
 * Cancel a subscription
 */
export function useCancelSubscription() {
  const queryClient = useQueryClient();

  return useMutation<Subscription, Error, CancelSubscriptionRequest>({
    mutationFn: (data) => apiPost<Subscription>("/subscriptions/cancel", data),
    onSuccess: (subscription) => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      queryClient.invalidateQueries({
        queryKey: ["subscriptions", subscription.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["subscriptions", "tenant", subscription.tenantId, "active"],
      });
      // Cancel rotates the active plan (immediate → Free now, end-of-period
      // → Free at period end). Refresh the limitations manifest so locked
      // entities and denied features re-render.
      queryClient.invalidateQueries({ queryKey: ["me", "limitations"] });
      queryClient.invalidateQueries({ queryKey: ["usage"] });
    },
  });
}

interface UpdateOverridesRequest {
  featureOverrides?: Record<string, unknown>;
  crudLimitOverrides?: Record<string, unknown>;
  retrievalQuotaOverrides?: Record<string, unknown>;
  tenantCapOverrides?: Record<string, unknown>;
}

/**
 * Update subscription overrides
 */
export function useUpdateOverrides(subscriptionId: string) {
  const queryClient = useQueryClient();

  return useMutation<Subscription, Error, UpdateOverridesRequest>({
    mutationFn: (data) => apiPut<Subscription>(`/subscriptions/${subscriptionId}/overrides`, data),
    onSuccess: (subscription) => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions", subscriptionId] });
      queryClient.invalidateQueries({
        queryKey: ["subscriptions", "tenant", subscription.tenantId, "active"],
      });
    },
  });
}
