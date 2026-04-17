"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut } from "@/lib/api/request";
import type { Subscription, SubscribeTenantRequest, ChangePlanRequest, CancelSubscriptionRequest } from "@/types/billing";

interface UseSubscriptionsParams {
  tenantId?: string;
  status?: string;
  skip?: number;
  limit?: number;
}

/**
 * Fetch all subscriptions with optional filtering and pagination.
 * The backend returns a flat Subscription[] array (envelope is unwrapped by the axios interceptor).
 */
export function useSubscriptions(params?: UseSubscriptionsParams) {
  return useQuery<Subscription[]>({
    queryKey: ["subscriptions", params],
    queryFn: () => apiGet<Subscription[]>("/subscriptions", params),
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
