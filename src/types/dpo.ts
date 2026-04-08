import type { DSRType, DSRStatus, DeletionAction, NoticeDisplayMode } from "./enums";

// ── Data Subject Requests ─────────────────────────────────────────────
export interface DataSubjectRequest {
  id: string;
  tenantId: string;
  requesterName: string;
  requesterEmail?: string;
  type: DSRType;
  status: DSRStatus;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CreateDSRRequest {
  requesterName: string;
  requesterEmail?: string;
  type: DSRType;
  description?: string;
}

// ── Retention Policies ────────────────────────────────────────────────
export interface RetentionPolicy {
  id: string;
  tenantId: string;
  dataType: string;
  retentionDays: number;
  action: DeletionAction;
  autoExecute: boolean;
  createdAt: number;
  updatedAt: number;
}

// ── Sub-Processors ────────────────────────────────────────────────────
export interface SubProcessor {
  id: string;
  tenantId: string;
  name: string;
  purpose?: string;
  dataCategories?: string;
  country?: string;
  createdAt: number;
  updatedAt: number;
}

// ── Privacy Notices ───────────────────────────────────────────────────
export interface PrivacyNotice {
  id: string;
  tenantId: string;
  title: string;
  summary?: string;
  fullText?: string;
  displayMode: NoticeDisplayMode;
  isActive: boolean;
  effectiveDate?: number;
  createdAt: number;
  updatedAt: number;
}

// ── Compliance Register ───────────────────────────────────────────────
export interface ComplianceRegisterEntry {
  id: string;
  tenantId: string;
  processingActivity: string;
  purpose: string;
  lawfulBasis: string;
  dataCategories?: string;
  createdAt: number;
}
