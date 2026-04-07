"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut } from "@/lib/api/request";
import type { Subscription, SubscribeTenantRequest, ChangePlanRequest, CancelSubscriptionRequest } from "@/types/billing";

interface PaginatedResponse<T> {
  data: T[];
  meta?: {
    skip?: number;
    limit?: number;
    total?: number;
  };
}

interface UseSubscriptionsParams {
  tenant_id?: string;
  status?: string;
  skip?: number;
  limit?: number;
}

/**
 * Fetch all subscriptions with optional filtering and pagination
 */
export function useSubscriptions(params?: UseSubscriptionsParams) {
  return useQuery<PaginatedResponse<Subscription>>({
    queryKey: ["subscriptions", params],
    queryFn: () => apiGet<PaginatedResponse<Subscription>>("/v1/subscriptions", params),
  });
}

/**
 * Fetch a single subscription by ID
 */
export function useSubscription(subscriptionId: string) {
  return useQuery<Subscription>({
    queryKey: ["subscriptions", subscriptionId],
    queryFn: () => apiGet<Subscription>(`/v1/subscriptions/${subscriptionId}`),
    enabled: !!subscriptionId,
  });
}

/**
 * Fetch the active subscription for a tenant
 */
export function useActiveSubscription(tenantId: string) {
  return useQuery<Subscription>({
    queryKey: ["subscriptions", "tenant", tenantId, "active"],
    queryFn: () => apiGet<Subscription>(`/v1/subscriptions/tenant/${tenantId}/active`),
    enabled: !!tenantId,
  });
}

/**
 * Create a new subscription
 */
export function useCreateSubscription() {
  const queryClient = useQueryClient();

  return useMutation<Subscription, Error, SubscribeTenantRequest>({
    mutationFn: (data) => apiPost<Subscription>("/v1/subscriptions", data),
    onSuccess: (subscription) => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      queryClient.invalidateQueries({
        queryKey: ["subscriptions", "tenant", subscription.tenant_id, "active"],
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
    mutationFn: (data) => apiPost<Subscription>("/v1/subscriptions/change-plan", data),
    onSuccess: (subscription) => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      queryClient.invalidateQueries({
        queryKey: ["subscriptions", subscription.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["subscriptions", "tenant", subscription.tenant_id, "active"],
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
    mutationFn: (data) => apiPost<Subscription>("/v1/subscriptions/cancel", data),
    onSuccess: (subscription) => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      queryClient.invalidateQueries({
        queryKey: ["subscriptions", subscription.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["subscriptions", "tenant", subscription.tenant_id, "active"],
      });
    },
  });
}

interface UpdateOverridesRequest {
  feature_overrides?: Record<string, unknown>;
  crud_limit_overrides?: Record<string, unknown>;
  retrieval_quota_overrides?: Record<string, unknown>;
  tenant_cap_overrides?: Record<string, unknown>;
}

/**
 * Update subscription overrides
 */
export function useUpdateOverrides(subscriptionId: string) {
  const queryClient = useQueryClient();

  return useMutation<Subscription, Error, UpdateOverridesRequest>({
    mutationFn: (data) => apiPut<Subscription>(`/v1/subscriptions/${subscriptionId}/overrides`, data),
    onSuccess: (subscription) => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions", subscriptionId] });
      queryClient.invalidateQueries({
        queryKey: ["subscriptions", "tenant", subscription.tenant_id, "active"],
      });
    },
  });
}
