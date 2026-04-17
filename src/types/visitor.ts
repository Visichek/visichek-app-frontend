import type {
  VisitStatus,
  CheckInMethod,
  CheckOutMethod,
  VerificationStatus,
  AppointmentStatus,
  ProfilingPreference,
} from "./enums";

/**
 * Visitor-adjacent types kept after the check-in rewrite.
 *
 * All request/response shapes for the staged check-in flow (CheckInRequest,
 * ConfirmCheckInRequest/Response, DenyVisitorRequest, ApplyIdScanRequest,
 * UpdateDraftSessionRequest) have moved to src/types/checkin.ts under new
 * names. Anything staged-flow-specific has been removed from this file.
 */

export interface CheckOutRequest {
  badgeQrToken?: string;
  sessionId?: string;
  checkOutMethod?: CheckOutMethod;
}

export interface VisitSession {
  id: string;
  tenantId: string;
  visitorProfileId: string;
  departmentId: string;
  hostId?: string;
  purpose?: string;
  status: VisitStatus;
  checkInMethod?: CheckInMethod;
  checkOutMethod?: CheckOutMethod;
  checkedInAt: number;
  checkedOutAt?: number;
  checkedInBy?: string;
  checkedOutBy?: string;
  badgeQrToken?: string;
  visitorNameSnapshot?: string;
}

export interface VisitorProfile {
  id: string;
  tenantId: string;
  fullName: string;
  phone?: string;
  email?: string;
  company?: string;
  verificationStatus: VerificationStatus;
  profilingPreference: ProfilingPreference;
  visitCount: number;
  lastVisitAt?: number;
  createdAt: number;
}

export interface Appointment {
  id: string;
  tenantId: string;
  visitorProfileId?: string;
  hostId: string;
  departmentId: string;
  visitorNameSnapshot?: string;
  hostNameSnapshot?: string;
  scheduledDatetime: number;
  purpose?: string;
  status: AppointmentStatus;
  createdAt: number;
  updatedAt: number;
}

export interface AppointmentRequest {
  tenantId: string;
  visitorProfileId?: string;
  hostId: string;
  departmentId: string;
  visitorNameSnapshot?: string;
  hostNameSnapshot?: string;
  scheduledDatetime: number;
  purpose?: string;
  status?: AppointmentStatus;
}
