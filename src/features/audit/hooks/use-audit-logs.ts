"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/request";
import type { AuditLog, AuditLogFilters } from "@/types/audit";

/**
 * Fetch audit logs with optional filtering and pagination.
 * The API envelope is unwrapped by the axios interceptor, so the
 * resolved data is the bare list of audit logs.
 */
export function useAuditLogs(params?: AuditLogFilters) {
  return useQuery<AuditLog[]>({
    queryKey: ["audit-logs", params],
    queryFn: () =>
      apiGet<AuditLog[]>("/audit-logs", params as Record<string, unknown> | undefined),
    placeholderData: keepPreviousData,
  });
}
