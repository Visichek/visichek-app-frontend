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
  full_name: string;
  company?: string;
  department_id: string;
  host_id?: string;
  purpose?: string;
  appointment_id?: string;
  check_in_method?: CheckInMethod;
  photo_object_key?: string;
  id_image_object_key?: string;
  consent_granted?: boolean;
}

export interface CheckOutRequest {
  badge_qr_token?: string;
  session_id?: string;
  check_out_method?: CheckOutMethod;
}

export interface VisitSession {
  id: string;
  tenant_id: string;
  visitor_profile_id: string;
  department_id: string;
  host_id?: string;
  purpose?: string;
  status: VisitStatus;
  check_in_method?: CheckInMethod;
  check_out_method?: CheckOutMethod;
  checked_in_at: number;
  checked_out_at?: number;
  checked_in_by?: string;
  checked_out_by?: string;
  badge_qr_token?: string;
  visitor_name_snapshot?: string;
}

export interface VisitorProfile {
  id: string;
  tenant_id: string;
  full_name: string;
  phone?: string;
  email?: string;
  company?: string;
  verification_status: VerificationStatus;
  profiling_preference: ProfilingPreference;
  visit_count: number;
  last_visit_at?: number;
  created_at: number;
}

export interface Appointment {
  id: string;
  tenant_id: string;
  visitor_profile_id?: string;
  host_id: string;
  department_id: string;
  visitor_name_snapshot?: string;
  host_name_snapshot?: string;
  scheduled_datetime: number;
  purpose?: string;
  status: AppointmentStatus;
  created_at: number;
  updated_at: number;
}

export interface AppointmentRequest {
  tenant_id: string;
  visitor_profile_id?: string;
  host_id: string;
  department_id: string;
  visitor_name_snapshot?: string;
  host_name_snapshot?: string;
  scheduled_datetime: number;
  purpose?: string;
  status?: AppointmentStatus;
}

export interface ConfirmCheckInRequest {
  badge_format?: BadgeFormat;
}

export interface ConfirmCheckInResponse {
  session: VisitSession;
  badge_pdf_base64: string;
  badge_qr_token: string;
}

export interface DenyVisitorRequest {
  reason: string;
}

export interface ApplyIdScanRequest {
  id_type: string;
  id_number: string;
  id_image_object_key?: string;
}

export interface UpdateDraftSessionRequest {
  full_name?: string;
  phone?: string;
  company?: string;
  department_id?: string;
  host_id?: string;
  purpose?: string;
}
