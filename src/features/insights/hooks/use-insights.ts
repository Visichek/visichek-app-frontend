"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/request";
import { POLLING_INTERVALS, pollWhenAuthenticated } from "@/lib/query/polling";
import type { Granularity, InsightsResponse } from "@/types/insights";
import type { SystemUserRole } from "@/types/enums";

/**
 * Matches the server precompute TTL behaviour: the default now-anchored,
 * unfiltered, own-role view is cached ~60s server-side, so refetch slightly
 * faster. Custom ranges are immutable and do not poll (see `refetchInterval`).
 */
const STALE_TIME_MS = 30_000;

export interface InsightsParams {
  roleView: SystemUserRole;
  /** Window bounds in unix seconds. Omit for the default now-anchored view. */
  start?: number;
  stop?: number;
  granularity?: Granularity;
  // Scoping / narrowing filters — all optional, all server-validated.
  departmentId?: string;
  branchId?: string;
  hostId?: string;
  // Audit filters.
  actorId?: string;
  operationType?: string;
  resourceType?: string;
  // Incident filters.
  incidentType?: string;
  incidentStatus?: string;
  severity?: string;
  // DSR filters.
  dsrType?: string;
  dsrStatus?: string;
  lawfulBasis?: string;
  // Feed filter (receptionist live desk).
  statusFilter?: string;
}

const insightsKeys = {
  all: ["tenant", "insights"] as const,
  query: (params: InsightsParams) =>
    ["tenant", "insights", params] as const,
};

/** camelCase param -> snake_case query key. */
const PARAM_TO_QUERY: Record<keyof InsightsParams, string> = {
  roleView: "role_view",
  start: "start",
  stop: "stop",
  granularity: "granularity",
  departmentId: "department_id",
  branchId: "branch_id",
  hostId: "host_id",
  actorId: "actor_id",
  operationType: "operation_type",
  resourceType: "resource_type",
  incidentType: "incident_type",
  incidentStatus: "incident_status",
  severity: "severity",
  dsrType: "dsr_type",
  dsrStatus: "dsr_status",
  lawfulBasis: "lawful_basis",
  statusFilter: "status_filter",
};

export function toInsightsQueryParams(
  params: InsightsParams,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    out[PARAM_TO_QUERY[key as keyof InsightsParams]] = String(value);
  }
  return out;
}

/**
 * Is this the default, now-anchored view? Only that view should poll +
 * refetch-on-focus; any explicit range or filter produces an immutable
 * historical result the server computes on demand, so polling is wasteful.
 */
function isNowAnchored(params: InsightsParams): boolean {
  const { roleView, ...rest } = params;
  void roleView;
  return Object.values(rest).every((v) => v === undefined || v === null || v === "");
}

export interface UseInsightsOptions {
  enabled?: boolean;
  /**
   * Override the live-polling decision. The default heuristic (no explicit
   * range/filters) can't tell that a relative preset like "last 30 days"
   * ending now is still now-anchored, so the client passes this when the
   * selection is a now-anchored preset with no filters.
   */
  pollLive?: boolean;
}

export function useInsights(
  params: InsightsParams,
  options: UseInsightsOptions = {},
) {
  const { enabled = true, pollLive } = options;
  const nowAnchored = pollLive ?? isNowAnchored(params);

  return useQuery({
    queryKey: insightsKeys.query(params),
    queryFn: () =>
      apiGet<InsightsResponse>("/dashboard/insights", toInsightsQueryParams(params)),
    enabled,
    staleTime: STALE_TIME_MS,
    // Only the live default view polls; fixed historical windows are immutable.
    refetchInterval: () =>
      nowAnchored ? pollWhenAuthenticated(POLLING_INTERVALS.dashboardStats) : false,
    refetchOnWindowFocus: nowAnchored,
  });
}

useInsights.keys = insightsKeys;
useInsights.isNowAnchored = isNowAnchored;
