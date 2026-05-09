"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/request";
import type { TenantDashboardStats } from "@/types/dashboard";

/**
 * The `/dashboard/stats` precompute cache has a 60s TTL on the unscoped
 * tenant view; refetch slightly faster than that so the UI lines up with
 * server invalidations from queued writes (which mark the scope dirty for
 * an immediate recompute on next read).
 */
const REFETCH_INTERVAL_MS = 30_000;
const STALE_TIME_MS = 30_000;

const dashboardKeys = {
  all: ["tenant", "dashboard"] as const,
  stats: (departmentId?: string) =>
    ["tenant", "dashboard", "stats", departmentId ?? null] as const,
};

export interface UseDashboardStatsOptions {
  /**
   * Optional dept_admin scoping. Department-scoped views skip the precompute
   * cache and are computed on demand server-side, so prefer the unscoped
   * call where possible.
   */
  departmentId?: string;
  enabled?: boolean;
}

export function useDashboardStats(options: UseDashboardStatsOptions = {}) {
  const { departmentId, enabled = true } = options;

  return useQuery({
    queryKey: dashboardKeys.stats(departmentId),
    queryFn: () =>
      apiGet<TenantDashboardStats>(
        "/dashboard/stats",
        departmentId ? { department_id: departmentId } : undefined,
      ),
    enabled,
    staleTime: STALE_TIME_MS,
    refetchInterval: REFETCH_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });
}

useDashboardStats.keys = dashboardKeys;
