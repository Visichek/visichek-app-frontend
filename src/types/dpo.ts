import type { DSRType, DSRStatus, DeletionAction, NoticeDisplayMode } from "./enums";

// ── Data Subject Requests ─────────────────────────────────────────────
export interface DataSubjectRequest {
  id: string;
  tenant_id: string;
  requester_name: string;
  requester_email?: string;
  type: DSRType;
  status: DSRStatus;
  description?: string;
  created_at: number;
  updated_at: number;
}

export interface CreateDSRRequest {
  requester_name: string;
  requester_email?: string;
  type: DSRType;
  description?: string;
}

// ── Retention Policies ────────────────────────────────────────────────
export interface RetentionPolicy {
  id: string;
  tenant_id: string;
  data_type: string;
  retention_days: number;
  action: DeletionAction;
  auto_execute: boolean;
  created_at: number;
  updated_at: number;
}

// ── Sub-Processors ────────────────────────────────────────────────────
export interface SubProcessor {
  id: string;
  tenant_id: string;
  name: string;
  purpose?: string;
  data_categories?: string;
  country?: string;
  created_at: number;
  updated_at: number;
}

// ── Privacy Notices ───────────────────────────────────────────────────
export interface PrivacyNotice {
  id: string;
  tenant_id: string;
  title: string;
  summary?: string;
  full_text?: string;
  display_mode: NoticeDisplayMode;
  is_active: boolean;
  effective_date?: number;
  created_at: number;
  updated_at: number;
}

// ── Compliance Register ───────────────────────────────────────────────
export interface ComplianceRegisterEntry {
  id: string;
  tenant_id: string;
  processing_activity: string;
  purpose: string;
  lawful_basis: string;
  data_categories?: string;
  created_at: number;
}
