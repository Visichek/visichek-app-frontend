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
  dateFrom?: number;
  dateTo?: number;
  start?: number;
  stop?: number;
}
