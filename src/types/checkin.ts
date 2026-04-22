/**
 * Types for the check-in flow.
 *
 * The flow has two sides:
 *   - Kiosk (public, no auth): fetches config, optional returning-visitor
 *     lookup, submits a check-in (with or without an ID file).
 *   - Receptionist (authenticated): lists pending approvals, views detail,
 *     approves or rejects.
 *
 * Endpoints are documented in src/features/checkins/lib/endpoints.ts.
 */

// ── Enums ────────────────────────────────────────────────────────────

/** Lifecycle of a check-in after submission. */
export type CheckinState =
  | "pending_approval"
  | "approved"
  | "rejected"
  | "checked_out";

/** Government ID types accepted by the OCR pipeline. */
export type IdType = "national_id" | "drivers_license" | "passport";

/** Action taken by a receptionist on a pending check-in. */
export type CheckinConfirmAction = "approve" | "reject";

/** Kinds of configurable required fields in a check-in config. */
export type RequiredFieldType =
  | "string"
  | "email"
  | "phone"
  // Backend serializes phone fields as "tel" (HTML input-type convention)
  // but some older configs still use "phone"; both are treated as phone
  // inputs in the renderer.
  | "tel"
  | "number"
  | "date"
  | "boolean"
  | "select";

/**
 * Which bucket a required field belongs to. Matches the backend
 * `CheckinFieldCategory` enum (schemas/imports.py) — only these two
 * string values are accepted on create and emitted on read.
 *
 *   - bio: personal info (name, DOB, …); saved on the visitor profile and
 *     pre-filled on return visits. May be auto-filled from OCR.
 *   - tenant_specific: visit-scoped fields (host, purpose, etc.) collected
 *     fresh every visit.
 *
 * Note: `bio_data` / `tenant_specific_data` appear elsewhere in the
 * codebase as **submit-payload field names** — those are unrelated to this
 * category enum despite the similar wording.
 */
export type RequiredFieldCategory = "bio" | "tenant_specific";

// ── Config ───────────────────────────────────────────────────────────

export interface RequiredField {
  /** Machine name used as the form field key and the server-side payload key. */
  key: string;
  /** Human-readable label shown on the form. */
  label: string;
  /** Input type — drives which component the form renders. */
  type: RequiredFieldType;
  /** If true, the kiosk refuses to submit without a value. */
  required: boolean;
  /** Which bucket this field lives in when submitted. */
  category: RequiredFieldCategory;
  /** Options for `select` fields (value + human label). */
  options?: Array<{ value: string; label: string }>;
  /** Optional placeholder / helper copy. */
  placeholder?: string;
  /** Optional tooltip explaining why this field exists. */
  helperText?: string;
}

/**
 * Public slice of a check-in config — what the kiosk sees.
 * No secrets or admin settings are exposed here.
 */
export interface PublicCheckinConfigOut {
  checkinConfigId: string;
  tenantId: string;
  tenantName: string;
  logoUrl?: string;
  idUploadEnabled: boolean;
  allowReturningVisitorLookup: boolean;
  requiredFields: RequiredField[];
}

/**
 * Full check-in config — what the tenant admin UI sees and can edit.
 * Shape matches the server's admin-facing response.
 */
export interface CheckinConfig {
  id: string;
  tenantId: string;
  name: string;
  /** Active configs are discoverable by the kiosk. */
  active: boolean;
  /** Whether visitors may upload a government ID for OCR verification. */
  idUploadEnabled: boolean;
  /** Whether the kiosk offers the "I've been here before" lookup. */
  allowReturningVisitorLookup: boolean;
  /** If true, approvals auto-occur when a check-in is ID-verified. */
  autoApproveVerified?: boolean;
  /** Fields the visitor must fill on the kiosk. */
  requiredFields: RequiredField[];
  /** Optional department / branch scoping. */
  departmentId?: string;
  branchId?: string;
  /** Optional tenant-supplied logo URL shown on the kiosk. */
  logoUrl?: string;
  createdAt: number;
  updatedAt: number;
}

// ── Requests ─────────────────────────────────────────────────────────

/**
 * Returning-visitor lookup query. At least one of email/phone must be
 * supplied; the server 404s when nothing matches.
 */
export interface VisitorLookupQuery {
  email?: string;
  phone?: string;
}

/** Response shape for the returning-visitor lookup. */
export interface VisitorOut {
  id: string;
  tenantId: string;
  fullName: string;
  email?: string;
  phone?: string;
  verified: boolean;
  verificationMethod?: IdType;
  portraitUrl?: string;
  bioData?: Record<string, string>;
  lastVisitAt?: number;
  createdAt: number;
}

/** Nested purpose payload for both submit variants. */
export interface PurposeInfo {
  purpose: string;
  purposeDetails?: string;
  expectedDurationMinutes?: number;
}

/**
 * Multipart-form payload for the combined submit endpoint.
 *
 * `id_type` is required iff `id_file` is provided.
 * `bio_data` and `tenant_specific_data` are sent as JSON strings inside
 * their form fields; we model them as objects here and the client
 * serializes them.
 */
export interface CheckinSubmitMultipartRequest {
  email: string;
  phone: string;
  purpose: PurposeInfo;
  bioData?: Record<string, unknown>;
  tenantSpecificData?: Record<string, unknown>;
  idFile?: File;
  idType?: IdType;
}

/** Legacy JSON submit payload (kept for backend parity; not used by the kiosk UI). */
export interface CheckinSubmitJsonRequest {
  visitorId?: string;
  idExtractionId?: string;
  bioData?: Record<string, unknown>;
  tenantSpecificData?: Record<string, unknown>;
  purpose: PurposeInfo;
}

/**
 * Non-PII recognition query sent to
 * `POST /v1/public/tenants/{tenant_id}/visitor-status`. Either `email`
 * or `phone` is required. The server prefers phone when both are given.
 */
export interface PublicVisitorStatusRequest {
  email?: string;
  phone?: string;
}

/**
 * Response from `POST /v1/public/tenants/{tenant_id}/visitor-status`.
 *
 * The endpoint is intentionally PII-free. `visitorId` is a MongoDB ObjectId
 * that the kiosk re-submits via `submit-by-visitor-id`; it is safe to hold
 * in component state for the duration of the flow.
 *
 * `visitorId === null` with `found === true` means a `visitor_profiles`
 * record exists (from the older self-registration flow) but no `visitors`
 * record — the kiosk must fall back to the full `/submit` path.
 */
export interface PublicVisitorStatusOut {
  found: boolean;
  visitorId: string | null;
  totalVisits: number | null;
  lastVisitAgoDays: number | null;
  idVerifiedRecently: boolean;
}

/**
 * Minimal submit payload for a recognised returning visitor, sent to
 * `POST /v1/public/tenants/{tenant_id}/submit-by-visitor-id`.
 *
 * The backend reads name / email / phone / company / id_type from the
 * stored visitor record — the frontend MUST NOT re-send them here.
 * `tenantSpecificData` is required when the tenant's active check-in
 * config declares any field with `required: true, category: "tenant_specific"`.
 */
export interface CheckinSubmitByVisitorIdRequest {
  visitorId: string;
  purpose: PurposeInfo;
  tenantSpecificData?: Record<string, unknown>;
}

/** Receptionist approve/reject payload. */
export interface CheckinConfirmRequest {
  action: CheckinConfirmAction;
  notes?: string;
}

// ── Responses ────────────────────────────────────────────────────────

/** Canonical check-in record surfaced by the API. */
export interface CheckinOut {
  id: string;
  tenantId: string;
  visitorId: string;
  checkinConfigId: string;
  idExtractionId?: string;
  tenantSpecificData: Record<string, unknown>;
  purpose: PurposeInfo;
  state: CheckinState;
  verified: boolean;
  approvedByUserId?: string;
  approvedAt?: number;
  rejectionReason?: string;
  dateCreated: number;
  lastUpdated: number;
  /** Present on pending-approval list results so the receptionist can identify the visitor without a second fetch. */
  visitor?: VisitorOut;
}

/** Confirm response when the receptionist approves a check-in. */
export interface CheckinApproveResponse {
  checkinId: string;
  state: CheckinState;
  badge: {
    badgeQrToken: string;
    badgePdfBase64?: string;
    badgePngBase64?: string;
  };
}

/**
 * The confirm endpoint returns different shapes for approve vs reject.
 * Consumers should discriminate on the `state` field or on the presence
 * of `badge`.
 */
export type CheckinConfirmResponse = CheckinApproveResponse | CheckinOut;

/** Typed narrowing helper for approve responses. */
export function isCheckinApproveResponse(
  response: CheckinConfirmResponse
): response is CheckinApproveResponse {
  return (
    response.state === "approved" &&
    "badge" in response &&
    typeof response.badge === "object"
  );
}

// ── List params ──────────────────────────────────────────────────────

export interface CheckinListParams {
  state?: CheckinState;
  skip?: number;
  limit?: number;
}

export interface CheckinListMeta {
  total?: number;
  skip?: number;
  limit?: number;
}
