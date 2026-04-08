import type {
  VisitStatus,
  CheckInMethod,
  CheckOutMethod,
  VerificationStatus,
  AppointmentStatus,
  ProfilingPreference,
  BadgeFormat,
} from "./enums";

export interface CheckInRequest {
  phone: string;
  fullName: string;
  company?: string;
  departmentId: string;
  hostId?: string;
  purpose?: string;
  appointmentId?: string;
  checkInMethod?: CheckInMethod;
  photoObjectKey?: string;
  idImageObjectKey?: string;
  consentGranted?: boolean;
}

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

export interface ConfirmCheckInRequest {
  badgeFormat?: BadgeFormat;
}

export interface ConfirmCheckInResponse {
  session: VisitSession;
  badgePdfBase64: string;
  badgeQrToken: string;
}

export interface DenyVisitorRequest {
  reason: string;
}

export interface ApplyIdScanRequest {
  idType: string;
  idNumber: string;
  idImageObjectKey?: string;
}

export interface UpdateDraftSessionRequest {
  fullName?: string;
  phone?: string;
  company?: string;
  departmentId?: string;
  hostId?: string;
  purpose?: string;
}
