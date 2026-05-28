import type { DSRType, DSRStatus, DeletionAction, NoticeDisplayMode } from "./enums";
import type { Block } from "./blog";

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
  /**
   * The visitor profile this request is about. Backend (`POST /v1/dsr`)
   * requires `visitor_profile_id`; without it the create call 422s with
   * `VALIDATION_FAILED` / missing `visitor_profile_id`.
   */
  visitorProfileId: string;
  requesterName: string;
  requesterEmail?: string;
  /** Backend field is `request_type`, not `type`. */
  requestType: DSRType;
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
  /** Opaque version code; consent records pin to this. Minted anew whenever
   * title/summary/fullText/body/displayMode change. */
  versionId?: string;
  title: string;
  summary?: string;
  /** Flattened plain-text projection of `body`, kept populated server-side as
   * a fallback. `body` is the canonical, editable copy. */
  fullText?: string;
  /** Canonical rich content — BlockNote blocks (same dialect as legal docs and
   * the DPA). May be empty for a not-yet-migrated notice; fall back to
   * `fullText` when rendering. */
  body?: Block[];
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
