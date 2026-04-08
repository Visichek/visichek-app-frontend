export interface AuditLog {
  id: string;
  tenantId: string;
  actorId: string;
  actorNameSnapshot?: string;
  userSessionId?: string;
  action: string;
  targetEntity?: string;
  targetId?: string;
  ip?: string;
  deviceSignature?: string;
  reason?: string;
  occurredAt: number;
}

export interface AuditLogFilters {
  actorId?: string;
  action?: string;
  targetEntity?: string;
  dateFrom?: number;
  dateTo?: number;
  start?: number;
  stop?: number;
}
