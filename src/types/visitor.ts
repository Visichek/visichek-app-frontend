import type {
  VisitStatus,
  CheckInMethod,
  CheckOutMethod,
  VerificationStatus,
  AppointmentStatus,
  ProfilingPreference,
  SystemUserRole,
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

export interface VisitorProfileSummary {
  id: string;
  fullName: string;
  company?: string;
  phone?: string;
  photoUrl?: string;
}

/**
 * Visitor summary as returned inline by GET /v1/visitors/awaiting-checkout
 * (and other approved-checkin enriched endpoints). Note: this is distinct
 * from VisitorProfileSummary — the field names match the backend payload
 * (`portraitUrl`, not `photoUrl`).
 */
export interface VisitorSummary {
  id: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  verified?: boolean;
  verificationMethod?: string | null;
  portraitUrl?: string | null;
}

export interface HostSummary {
  id: string;
  fullName: string;
  email?: string;
  role?: SystemUserRole;
}

export interface DepartmentSummary {
  id: string;
  name: string;
}

export interface ReceptionistSummary {
  id: string;
  fullName: string;
  email?: string;
  role?: SystemUserRole;
}

/**
 * Enriched visit session returned by GET /v1/visitors/awaiting-checkout.
 * Carries the same fields as VisitSession plus snapshot strings and the
 * resolved summaries needed to render a picker without follow-up calls.
 */
export interface VisitSessionWithSummary extends VisitSession {
  receptionistId?: string;
  checkInTime?: number | null;
  checkOutTime?: number | null;
  badgeExpiry?: number;
  // Top-level fields included by the awaiting-checkout payload.
  visitorName?: string | null;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  portraitUrl?: string | null;
  approvedAt?: number | null;
  // Snapshot strings (kept for older endpoints / appointment links).
  visitorNameSnapshot?: string;
  companySnapshot?: string;
  hostNameSnapshot?: string;
  departmentNameSnapshot?: string;
  receptionistNameSnapshot?: string;
  // Resolved summaries.
  visitorSummary?: VisitorSummary;
  visitorProfileSummary?: VisitorProfileSummary;
  hostSummary?: HostSummary;
  departmentSummary?: DepartmentSummary;
  receptionistSummary?: ReceptionistSummary;
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
