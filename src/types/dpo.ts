import type { DSRType, DSRStatus, DeletionAction, NoticeDisplayMode } from "./enums";
import type { Block } from "./blog";

// ── Data Subject Requests ─────────────────────────────────────────────
/**
 * Brief visitor snapshot embedded on a DSR (`DSROut.visitor_profile_summary`)
 * so the DPO UI can show who the request concerns without a follow-up fetch.
 */
export interface DSRVisitorSummary {
  id: string;
  fullName?: string;
  phone?: string;
  emailAddress?: string;
  company?: string;
}

/**
 * Tenant-scoped data subject request. Field names mirror the backend
 * `DSROut` (camelCased): `requestType` / `dateCreated` / `visitorProfileId`,
 * NOT `type` / `createdAt`. The backend carries no requester identity on the
 * DSR itself — render the subject via `visitorProfileSummary`.
 */
export interface DataSubjectRequest {
  id: string;
  tenantId: string;
  /**
   * The visitor profile this request concerns. The DPO needs it to fulfil a
   * `deletion` request by erasing that profile (`DELETE /v1/visitor-profiles/{id}`).
   */
  visitorProfileId?: string;
  requestType: DSRType;
  status: DSRStatus;
  notes?: string;
  /** Unix epoch seconds — backend `date_created`. */
  dateCreated: number;
  receivedAt?: number;
  resolvedAt?: number;
  /** Documented outcome set when the request is completed. */
  resolution?: string;
  /** Documented reason set when the request is rejected. */
  rejectionReason?: string;
  /** Embedded subject snapshot (backend `visitor_profile_summary`). */
  visitorProfileSummary?: DSRVisitorSummary;

  // ── Legacy field names kept optional for older consumers (dsr-form, public
  // rights). The backend does NOT emit these; new code must use the fields
  // above. ──
  /** @deprecated Backend emits `requestType`. */
  type?: DSRType;
  /** @deprecated Backend has no requester identity; use `visitorProfileSummary`. */
  requesterName?: string;
  /** @deprecated Backend has no requester identity; use `visitorProfileSummary`. */
  requesterEmail?: string;
  description?: string;
  /** @deprecated Backend emits `dateCreated`. */
  createdAt?: number;
  /** @deprecated Backend emits `resolvedAt`. */
  updatedAt?: number;
}

/**
 * A visitor profile that has been soft-deleted via a DSR erasure and is
 * awaiting permanent deletion. Returned by
 * `GET /v1/visitor-profiles/scheduled-deletions` (camelCase of
 * `VisitorProfileOut`). Restorable until `scheduledPurgeAt` elapses.
 */
export interface ScheduledDeletionProfile {
  id: string;
  fullName: string;
  phone?: string;
  emailAddress?: string;
  company?: string;
  /** Unix epoch seconds the profile was soft-deleted. */
  deletedAt?: number;
  /** Unix epoch seconds the permanent purge sweep will hard-delete it. */
  scheduledPurgeAt?: number;
}

/**
 * Cross-tenant DSR row returned by the platform-admin oversight endpoints
 * (`GET /v1/admins/dsr*`). Carries the extra compliance fields the
 * tenant-scoped `DataSubjectRequest` shape doesn't expose — SLA deadline,
 * identity verification flag, the original receipt timestamp, and the
 * cross-tenant `tenantId` so the row can be attributed.
 */
export interface AdminDataSubjectRequest {
  id: string;
  tenantId: string;
  visitorProfileId?: string;
  requestType: DSRType;
  status: DSRStatus;
  identityVerified?: boolean;
  /**
   * Unix epoch seconds when the legal SLA window closes. Mirrors the
   * tenant's regulatory deadline; used by the "approaching SLA" and
   * "breached SLA" queues.
   */
  slaDeadline?: number;
  /** Unix epoch seconds when the DSR was received. */
  receivedAt?: number;
  /** Unix epoch seconds when the DSR record was created. */
  dateCreated: number;
  notes?: string | null;
}

/**
 * Aggregate response from `GET /v1/admins/dsr/stats`. Drives the
 * platform-admin compliance dashboard tile.
 */
export interface AdminDSRStats {
  total: number;
  byStatus: Partial<Record<DSRStatus, number>>;
  byRequestType: Partial<Record<DSRType, number>>;
  /** Open DSRs whose deadline lands in the next 24h. */
  slaAtRisk: number;
  /** Open DSRs whose deadline has already passed. */
  slaBreached: number;
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
