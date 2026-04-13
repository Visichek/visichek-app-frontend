import type { VisitSession, Appointment } from "./visitor";
import type { NoticeDisplayMode } from "./enums";

// ── Public Registration Info ─────────────────────────────────────────
export interface PublicTenantInfo {
  tenantId: string;
  companyName: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
}

export interface PublicDepartment {
  id: string;
  name: string;
}

export interface PublicPrivacyNotice {
  id: string;
  title: string;
  summary?: string;
  fullText?: string;
  displayMode: NoticeDisplayMode;
  versionId?: string;
  effectiveDate?: number;
}

// ── Public Registration Request ──────────────────────────────────────
export interface PublicRegistrationRequest {
  fullName?: string;
  phone: string;
  email?: string;
  company?: string;
  departmentId: string;
  purpose?: string;
  hostId?: string;
  appointmentId?: string;
  consentGranted?: boolean;
  consentMethod?: string;
  privacyNoticeVersionId?: string;
  registrationToken?: string;
  profileId?: string;
}

export interface PublicRegistrationResponse {
  session: VisitSession;
  message?: string;
}

// ── QR Token Verification ────────────────────────────────────────────
export interface PublicTokenVerifyResponse {
  valid: boolean;
  tenantId?: string;
  departmentId?: string;
  branchId?: string;
  companyName?: string;
}

// ── OCR ID Scan ──────────────────────────────────────────────────────
export interface PublicOcrScanResponse {
  fullName?: string;
  idNumber?: string;
  idType?: string;
  confidence: number;
}

// ── Returning Visitor Lookup ─────────────────────────────────────────
export interface PublicLookupRequest {
  phone?: string;
  email?: string;
}

export interface PublicLookupResponse {
  found: boolean;
  profileId?: string;
  fullNameMasked?: string;
  company?: string;
  lastVisitAgoDays?: number;
  idVerifiedRecently: boolean;
}

// ── Finalize via Receptionist Code ───────────────────────────────────
export interface PublicFinalizeRequest {
  sessionId: string;
  receptionistCode: string;
}

export interface PublicFinalizeResponse {
  session: VisitSession;
  badgePdfBase64?: string;
  badgeQrToken?: string;
}

// ── Mint Registration QR (authed) ────────────────────────────────────
export interface MintRegistrationQrRequest {
  departmentId?: string;
  branchId?: string;
}

export interface MintRegistrationQrResponse {
  registrationUrl: string;
  signedToken: string;
  qrData: string;
  tenantId: string;
  departmentId?: string;
  branchId?: string;
}

// ── Appointment Prefill ──────────────────────────────────────────────
export interface AppointmentPrefillData {
  appointmentId: string;
  visitorName?: string;
  hostId?: string;
  hostName?: string;
  departmentId?: string;
  departmentName?: string;
  purpose?: string;
  scheduledDatetime?: number;
}

// ── Public Checkout ──────────────────────────────────────────────────
export interface PublicCheckoutRequest {
  badgeQrToken: string;
}

export interface PublicCheckoutResponse {
  session: VisitSession;
  visitDurationMinutes?: number;
}

// ── Public Rights ────────────────────────────────────────────────────
export interface PublicRightsRequest {
  requestType: "access" | "correction" | "deletion" | "consent_withdrawal";
  requesterName: string;
  requesterEmail?: string;
  requesterPhone?: string;
  description?: string;
}

export interface PublicRightsResponse {
  requestId: string;
  verificationToken: string;
  dueDate?: number;
  status: string;
}

export interface PublicRightsStatusResponse {
  requestId: string;
  status: string;
  type: string;
  dueDate?: number;
  createdAt: number;
  updatedAt?: number;
}

export interface PublicConsentWithdrawalRequest {
  phone?: string;
  email?: string;
}

export interface PublicConsentWithdrawalResponse {
  sessionsUpdated: number;
}

export interface PublicProfilingOptOutRequest {
  phone?: string;
  email?: string;
  preference: "opted_out";
}

export interface PublicProfilingOptOutResponse {
  profileUpdated: boolean;
}
