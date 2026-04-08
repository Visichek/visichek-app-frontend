import type { VisitSession, Appointment } from "./visitor";
import type { NoticeDisplayMode } from "./enums";

// ── Public Registration Info ─────────────────────────────────────────
export interface PublicTenantInfo {
  tenant_id: string;
  company_name: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
}

export interface PublicDepartment {
  id: string;
  name: string;
}

export interface PublicPrivacyNotice {
  id: string;
  title: string;
  summary?: string;
  full_text?: string;
  display_mode: NoticeDisplayMode;
  version_id?: string;
  effective_date?: number;
}

// ── Public Registration Request ──────────────────────────────────────
export interface PublicRegistrationRequest {
  full_name: string;
  phone: string;
  email?: string;
  company?: string;
  department_id: string;
  purpose?: string;
  host_id?: string;
  appointment_id?: string;
  consent_granted?: boolean;
  consent_method?: string;
  privacy_notice_version_id?: string;
}

export interface PublicRegistrationResponse {
  session: VisitSession;
  message?: string;
}

// ── Appointment Prefill ──────────────────────────────────────────────
export interface AppointmentPrefillData {
  appointment_id: string;
  visitor_name?: string;
  host_id?: string;
  host_name?: string;
  department_id?: string;
  department_name?: string;
  purpose?: string;
  scheduled_datetime?: number;
}

// ── Public Checkout ──────────────────────────────────────────────────
export interface PublicCheckoutRequest {
  badge_qr_token: string;
}

export interface PublicCheckoutResponse {
  session: VisitSession;
  visit_duration_minutes?: number;
}

// ── Public Rights ────────────────────────────────────────────────────
export interface PublicRightsRequest {
  request_type: "access" | "correction" | "deletion" | "consent_withdrawal";
  requester_name: string;
  requester_email?: string;
  requester_phone?: string;
  description?: string;
}

export interface PublicRightsResponse {
  request_id: string;
  verification_token: string;
  due_date?: number;
  status: string;
}

export interface PublicRightsStatusResponse {
  request_id: string;
  status: string;
  type: string;
  due_date?: number;
  created_at: number;
  updated_at?: number;
}

export interface PublicConsentWithdrawalRequest {
  phone?: string;
  email?: string;
}

export interface PublicConsentWithdrawalResponse {
  sessions_updated: number;
}

export interface PublicProfilingOptOutRequest {
  phone?: string;
  email?: string;
  preference: "opted_out";
}

export interface PublicProfilingOptOutResponse {
  profile_updated: boolean;
}
