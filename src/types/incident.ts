import type { IncidentType, IncidentStatus } from "./enums";

export type IncidentRiskLevel = "low" | "medium" | "high" | "critical";

export interface Incident {
  id: string;
  tenantId: string;
  reportedBy?: string;
  incidentType: IncidentType;
  status: IncidentStatus;
  description?: string;
  riskLevel?: IncidentRiskLevel;
  dataAffected?: string | null;
  mitigationSteps?: string | null;
  ndpcNotified?: boolean;
  ndpcNotifiedAt?: number | null;
  detectionTime?: number;
  notificationDeadline?: number;
  notificationSentAt?: number | null;
  dateCreated: number;
  resolvedAt?: number | null;
  assignedTo?: string;
  /** Phase 4 (branch isolation, queued) — every incident will carry branch id. */
  branchId?: string;
  /** Phase 4 — embedded branch label for unscoped roles; may be null for branch-scoped viewers. */
  branchSummary?: { id: string; name: string; isActive?: boolean } | null;
}

export interface CreateIncidentRequest {
  description: string;
  incidentType: IncidentType;
  riskLevel?: IncidentRiskLevel;
  detectionTime?: number;
  dataAffected?: string;
  mitigationSteps?: string;
}

export interface UpdateIncidentRequest {
  description?: string;
  status?: IncidentStatus;
  riskLevel?: IncidentRiskLevel;
  dataAffected?: string;
  mitigationSteps?: string;
  assignedTo?: string;
  ndpcNotified?: boolean;
  notificationSentAt?: number;
}
