"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/request";
import { POLLING_INTERVALS, pollWhenAuthenticated } from "@/lib/query/polling";
import type { AdminInsightsResponse, AdminTabId, Granularity } from "@/types/insights";

/**
 * Platform-admin insights — GET /v1/admins/dashboard/insights.
 * Range-aware, per-tab, filter-aware. The default now-anchored unfiltered view
 * polls; explicit ranges / filters are immutable and computed on demand.
 */

const STALE_TIME_MS = 30_000;

export interface AdminInsightsParams {
  tab: AdminTabId;
  start: number;
  stop: number;
  granularity?: Granularity;
  planTier?: string;
  subscriptionStatus?: string;
  billingCycle?: string;
  paymentProvider?: string;
  country?: string;
  tenantId?: string;
  incidentType?: string;
  incidentStatus?: string;
  supportStatus?: string;
  supportPriority?: string;
  onboardingStatus?: string;
}

const adminInsightsKeys = {
  all: ["admin", "insights"] as const,
  query: (params: AdminInsightsParams) => ["admin", "insights", params] as const,
};

const PARAM_TO_QUERY: Record<keyof AdminInsightsParams, string> = {
  tab: "tab",
  start: "start",
  stop: "stop",
  granularity: "granularity",
  planTier: "plan_tier",
  subscriptionStatus: "subscription_status",
  billingCycle: "billing_cycle",
  paymentProvider: "payment_provider",
  country: "country",
  tenantId: "tenant_id",
  incidentType: "incident_type",
  incidentStatus: "incident_status",
  supportStatus: "support_status",
  supportPriority: "support_priority",
  onboardingStatus: "onboarding_status",
};

export function toAdminInsightsQueryParams(params: AdminInsightsParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    out[PARAM_TO_QUERY[key as keyof AdminInsightsParams]] = String(value);
  }
  return out;
}

export interface UseAdminInsightsOptions {
  enabled?: boolean;
  /** Now-anchored relative range with no filters → keep it polling-friendly. */
  pollLive?: boolean;
}

export function useAdminInsights(
  params: AdminInsightsParams,
  options: UseAdminInsightsOptions = {},
) {
  const { enabled = true, pollLive = false } = options;

  return useQuery({
    queryKey: adminInsightsKeys.query(params),
    queryFn: () =>
      apiGet<AdminInsightsResponse>(
        "/admins/dashboard/insights",
        toAdminInsightsQueryParams(params),
      ),
    enabled,
    staleTime: STALE_TIME_MS,
    refetchInterval: () =>
      pollLive ? pollWhenAuthenticated(POLLING_INTERVALS.dashboardStats) : false,
    refetchOnWindowFocus: pollLive,
  });
}

useAdminInsights.keys = adminInsightsKeys;
