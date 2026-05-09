export interface AuditTenantSummary {
  id: string;
  companyName?: string;
  isActive?: boolean;
  countryOfHosting?: string;
}

export interface AuditActorSummary {
  id: string;
  fullName?: string;
  email?: string;
  role?: string;
  userType?: string;
}

export interface AuditResourceSummary {
  id: string;
  [key: string]: unknown;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorRole?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  tenantId?: string;
  details?: Record<string, unknown> | null;
  requestId?: string | null;
  timestamp: number;
  tenantSummary?: AuditTenantSummary | null;
  actorSummary?: AuditActorSummary | null;
  resourceSummary?: AuditResourceSummary | null;
}

export interface AuditLogFilters {
  actorId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  dateFrom?: number;
  dateTo?: number;
  start?: number;
  stop?: number;
}

/**
 * Query for `GET /v1/audit-logs/export` (tenant-scoped XLSX export).
 *
 * Mirrors the JSON list filters minus pagination — exports cap rows by
 * `limit` (1..50000, default 10000) instead of slicing with start/stop.
 */
export interface AuditLogExportFilters {
  actorId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  dateFrom?: number;
  dateTo?: number;
  /** Hard row cap, 1..50000. Backend default 10000 when omitted. */
  limit?: number;
}

/**
 * Query for `GET /v1/audit-logs/admin/export` (cross-tenant XLSX
 * export, application-admin only).
 *
 * Same filters as the tenant export plus an optional `tenantId` to scope
 * the export to one tenant. Omit for platform-wide.
 */
export interface AdminAuditLogExportFilters extends AuditLogExportFilters {
  tenantId?: string;
}
