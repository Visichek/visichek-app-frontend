"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/request";
import { apiGetList } from "@/lib/api/list";
import type {
  AdminDataSubjectRequest,
  AdminDSRStats,
} from "@/types/dpo";
import type { DSRType, DSRStatus } from "@/types/enums";
import type { ListResponse } from "@/types/list";

/**
 * Sort spec for the admin DSR list. Server validates against an explicit
 * allow-list (`date_created`, `sla_deadline`, `status`) — passing anything
 * else returns 400 `INVALID_SORT_FIELD`.
 */
export type AdminDSRSort =
  | "date_created"
  | "-date_created"
  | "sla_deadline"
  | "-sla_deadline"
  | "status"
  | "-status";

export interface AdminDSRListParams {
  skip?: number;
  limit?: number;
  q?: string;
  sort?: AdminDSRSort;
  status?: DSRStatus | DSRStatus[];
  requestType?: DSRType | DSRType[];
  tenantId?: string;
  createdAtGte?: number;
  createdAtLte?: number;
  slaDeadlineGte?: number;
  slaDeadlineLte?: number;
  facets?: string;
}

export const adminDsrKeys = {
  all: ["admin-dsr"] as const,
  list: (params?: AdminDSRListParams) =>
    ["admin-dsr", "list", params ?? {}] as const,
  approachingSla: (window?: number) =>
    ["admin-dsr", "approaching-sla", window ?? 86_400] as const,
  breachedSla: ["admin-dsr", "breached-sla"] as const,
  stats: ["admin-dsr", "stats"] as const,
  detail: (id: string) => ["admin-dsr", "detail", id] as const,
};

/**
 * Cross-tenant DSR list per the admin oversight endpoints. Page 1 with no
 * filters is served from the backend `GLOBAL` precompute cache (sub-second).
 * Filtered / sorted / paginated requests bypass the cache and run live.
 */
export function useAdminDSRList(params?: AdminDSRListParams) {
  return useQuery<ListResponse<AdminDataSubjectRequest>>({
    queryKey: adminDsrKeys.list(params),
    queryFn: () =>
      apiGetList<AdminDataSubjectRequest>(
        "/admins/dsr",
        params as Record<string, unknown> | undefined,
      ),
    placeholderData: keepPreviousData,
  });
}

/**
 * Open DSRs whose `slaDeadline` falls in the next `window` seconds.
 * Default window is 24h. Auto-refreshes every minute.
 */
export function useAdminDSRApproachingSla(window?: number) {
  return useQuery<AdminDataSubjectRequest[]>({
    queryKey: adminDsrKeys.approachingSla(window),
    queryFn: () =>
      apiGet<AdminDataSubjectRequest[]>(
        "/admins/dsr/approaching-sla",
        window ? { window } : undefined,
      ),
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    staleTime: 30_000,
  });
}

/**
 * Open DSRs whose `slaDeadline` has already passed. Highest-priority items
 * for platform-admin escalation.
 */
export function useAdminDSRBreachedSla() {
  return useQuery<AdminDataSubjectRequest[]>({
    queryKey: adminDsrKeys.breachedSla,
    queryFn: () =>
      apiGet<AdminDataSubjectRequest[]>("/admins/dsr/breached-sla"),
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    staleTime: 30_000,
  });
}

/**
 * Platform-wide DSR aggregate — totals by status / type plus SLA risk
 * counters. Cheap on the backend (five `count_documents` calls).
 */
export function useAdminDSRStats() {
  return useQuery<AdminDSRStats>({
    queryKey: adminDsrKeys.stats,
    queryFn: () => apiGet<AdminDSRStats>("/admins/dsr/stats"),
    staleTime: 60_000,
  });
}

/**
 * Cross-tenant DSR fetch by id. The admin oversight router intentionally
 * omits the tenant filter, so any DSR can be retrieved by its id.
 */
export function useAdminDSR(dsrId: string) {
  return useQuery<AdminDataSubjectRequest>({
    queryKey: adminDsrKeys.detail(dsrId),
    queryFn: () =>
      apiGet<AdminDataSubjectRequest>(`/admins/dsr/${dsrId}`),
    enabled: !!dsrId,
  });
}
