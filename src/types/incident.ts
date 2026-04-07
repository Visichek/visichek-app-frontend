import type { IncidentType, IncidentStatus } from "./enums";

export interface Incident {
  id: string;
  tenant_id: string;
  title: string;
  description?: string;
  type: IncidentType;
  status: IncidentStatus;
  severity?: string;
  reported_by?: string;
  assigned_to?: string;
  created_at: number;
  updated_at: number;
  notification_deadline?: number;
  ndpc_notified?: boolean;
  notification_sent_at?: number;
}

export interface CreateIncidentRequest {
  title: string;
  description?: string;
  type: IncidentType;
  severity?: string;
}

export interface UpdateIncidentRequest {
  title?: string;
  description?: string;
  status?: IncidentStatus;
  severity?: string;
  assigned_to?: string;
  ndpc_notified?: boolean;
  notification_sent_at?: number;
}
