"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/request";
import type { AuditLog, AuditLogFilters } from "@/types/audit";

interface PaginatedResponse<T> {
  data: T[];
  meta?: {
    total?: number;
    start?: number;
    stop?: number;
  };
}

/**
 * Fetch audit logs with optional filtering and pagination
 */
export function useAuditLogs(params?: AuditLogFilters) {
  return useQuery<PaginatedResponse<AuditLog>>({
    queryKey: ["audit-logs", params],
    queryFn: () =>
      apiGet<PaginatedResponse<AuditLog>>("/v1/audit-logs", params),
  });
}
