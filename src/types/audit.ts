export interface AuditLog {
  id: string;
  tenant_id: string;
  actor_id: string;
  actor_name_snapshot?: string;
  user_session_id?: string;
  action: string;
  target_entity?: string;
  target_id?: string;
  ip?: string;
  device_signature?: string;
  reason?: string;
  occurred_at: number;
}

export interface AuditLogFilters {
  actor_id?: string;
  action?: string;
  target_entity?: string;
  date_from?: number;
  date_to?: number;
  start?: number;
  stop?: number;
}
