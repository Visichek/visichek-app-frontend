import type { IncidentType, IncidentStatus } from "./enums";

export interface Incident {
  id: string;
  tenantId: string;
  title: string;
  description?: string;
  type: IncidentType;
  status: IncidentStatus;
  severity?: string;
  reportedBy?: string;
  assignedTo?: string;
  createdAt: number;
  updatedAt: number;
  notificationDeadline?: number;
  ndpcNotified?: boolean;
  notificationSentAt?: number;
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
  assignedTo?: string;
  ndpcNotified?: boolean;
  notificationSentAt?: number;
}
