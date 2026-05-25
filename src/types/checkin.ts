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

/**
 * Lifecycle of a check-in after submission.
 *
 * `pending_verification` is the initial state when the tenant's plan grants KYC and
 * the visitor has not yet completed (or skipped) the Dojah widget. The
 * webhook (or the skip endpoint) transitions `pending_verification → pending_approval`.
 * A failed verification transitions `pending_verification → rejected` directly.
 */
export type CheckinState =
  | "pending_verification"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "checked_out";

// ── Tenant-configurable enums ────────────────────────────────────────

/**
 * Kinds of tenant-configurable picker enums. The kiosk fetches the active
 * options for every kind in one bundle via
 * `GET /v1/checkin-configs/{config_id}/enums`.
 */
export type EnumKind = "purpose_of_visit" | "id_type" | "visitor_category";

/**
 * One option in a configurable enum. `active: false` options are filtered
 * out by the backend before the bundle reaches us — the kiosk does not
 * re-filter.
 */
export interface EnumOption {
  value: string;
  label: string;
  active: boolean;
  sortOrder: number;
}

/**
 * One enum kind's configuration. `allowCustom: true` means the picker
 * should expose an "Other / type your own" affordance that submits a
 * free-text value; `false` means the visitor must pick from `options`.
 */
export interface EnumBundleEntry {
  kind: EnumKind;
  allowCustom: boolean;
  options: EnumOption[];
}

/** Response from `GET /v1/checkin-configs/{config_id}/enums`. */
export interface EnumsResponse {
  tenantId: string;
  enums: Record<EnumKind, EnumBundleEntry>;
}

/** Government ID types accepted by the OCR pipeline. */
export type IdType = "national_id" | "drivers_license" | "passport";

/** Action taken by a receptionist on a pending check-in. */
export type CheckinConfirmAction = "approve" | "reject";

/** Kinds of configurable required fields in a check-in config. */
export type RequiredFieldType =
  | "string"
  | "text"
  | "long_text"
  | "email"
  | "phone"
  // Backend serializes phone fields as "tel" (HTML input-type convention)
  // but some older configs still use "phone"; both are treated as phone
  // inputs in the renderer.
  | "tel"
  | "url"
  | "number"
  | "integer"
  | "date"
  | "time"
  | "datetime"
  | "boolean"
  | "select"
  | "multi_select"
  | "country"
  | "address"
  // File-bearing fields. The kiosk uploads bytes via the unified upload
  // endpoint, then submits the returned object_key in the slot keyed on
  // the field's `key`.
  | "file"
  | "image"
  | "signature"
  | "id_document"
  | "consent_checkbox"
  | "rating";

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
  /**
   * If set, the field is rendered as a picker driven by the tenant's
   * configurable enum bundle (`GET /v1/checkin-configs/{id}/enums`). When
   * `enumKind` is present, ignore any sibling `options` field — the bundle
   * is the source of truth.
   */
  enumKind?: EnumKind;
  /** Optional placeholder / helper copy. */
  placeholder?: string;
  /** Optional tooltip explaining why this field exists. */
  helperText?: string;
}

/**
 * Public slice of a check-in config — what the kiosk sees.
 * No secrets or admin settings are exposed here.
 *
 * `requiredFields` now reflects the merged set: system BIO defaults
 * (full_name, phone, email) first, then every field from the published
 * tenant form (target_type=checkin), then any legacy tenant_specific
 * entries the form does not already cover. `purpose` is always present.
 *
 * `publicSelfCheckinEnabled=false` means the tenant's plan does NOT
 * grant anonymous kiosk submit — the kiosk MUST attach a system-user
 * Bearer token (super_admin / dept_admin / receptionist) on every
 * submit. The plan gate fires with 403 FEATURE_DISABLED when an
 * anonymous call is made or 403 AUTH_PERMISSION_DENIED when the wrong
 * role's token is attached.
 *
 * `tenantFormId` / `tenantFormVersion` identify the published checkin
 * form (or null when none exists). Surface these in audit / debugging
 * UI; the kiosk does not branch on them directly because the merged
 * `requiredFields` already covers field rendering.
 */
export interface PublicCheckinConfigOut {
  checkinConfigId: string;
  tenantId: string;
  tenantName: string;
  logoUrl?: string;
  idUploadEnabled: boolean;
  allowReturningVisitorLookup: boolean;
  requiredFields: RequiredField[];
  /** Published tenant form (target_type=checkin) backing the field set. */
  tenantFormId?: string | null;
  tenantFormVersion?: number | null;
  /** Plan grant for anonymous public submit (see doc above). */
  publicSelfCheckinEnabled?: boolean;
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

/**
 * Visitor record as surfaced by the API.
 *
 * Two callers read this shape:
 *   - The returning-visitor lookup (`/checkin-configs/{id}/visitors/lookup`)
 *     returns the full record including `tenantId`, `bioData`, and timestamps.
 *   - The embedded `visitor` on `CheckinOut` is a brief snapshot
 *     (`VisitorBriefSummary` server-side) with only the fields an approver
 *     needs: name, contact info, company, verification, portrait.
 *
 * Extra fields are optional so both shapes fit this type without forcing
 * each call site to discriminate. Do not read `bioData` / `lastVisitAt` /
 * `createdAt` / `tenantId` off a value that came in via `checkin.visitor`
 * — the backend won't set them there.
 */
export interface VisitorOut {
  id: string;
  tenantId?: string;
  fullName: string;
  email?: string;
  phone?: string;
  /** Employer / organisation the visitor reported at registration. */
  company?: string;
  verified: boolean;
  verificationMethod?: IdType;
  portraitUrl?: string;
  bioData?: Record<string, string>;
  lastVisitAt?: number;
  createdAt?: number;
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
  /**
   * Optional in v2 — only `phone` and `full_name` are required. The
   * backend accepts a missing or empty `email` field and stores the
   * visitor without one when so.
   */
  email?: string;
  phone: string;
  purpose: PurposeInfo;
  bioData?: Record<string, unknown>;
  tenantSpecificData?: Record<string, unknown>;
  idFile?: File;
  idType?: IdType;
  /**
   * Visitor-reported coordinates used by the tenant's geofence check.
   * Sent as snake_case (`visitor_lat`/`visitor_lng`) on the wire. The
   * backend ignores these fields when geofencing is disabled; when it's
   * enabled and either is missing, the submit is rejected with
   * `GEOFENCE_VIOLATION` and `reason: "missing_visitor_location"`.
   */
  visitorLat?: number;
  visitorLng?: number;
  visitorLocationAccuracyM?: number;
  /**
   * Signed QR registration token from the department QR (Issue 5).
   *
   * When present, the backend verifies the token's `tenant_id`,
   * `department_id`, and `branch_id` against the request scope and
   * rejects any browser-supplied department/branch that conflicts. The
   * audit record on the resulting check-in carries the token id so we
   * can trace which QR shaped the visit. Sent as `registration_token`
   * on the wire.
   */
  registrationToken?: string;
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
  /** Same contract as `CheckinSubmitMultipartRequest.visitorLat`. */
  visitorLat?: number;
  visitorLng?: number;
  visitorLocationAccuracyM?: number;
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
  /**
   * Server time at the moment the receptionist checked the visitor out.
   * Persisted on the `checkins` collection by `_checkout_approved_checkin`
   * so historical rows carry the full timing fact, not just the response.
   * `null` for any check-in that hasn't been checked out yet.
   */
  checkedOutAt?: number | null;
  /**
   * Visitor snapshot embedded on every check-in list / detail / analytics
   * row so the approver can confirm identity without a second fetch.
   * `null` only when the referenced visitor record was hard-deleted — the
   * row is still returned so the approver can reject the stale entry.
   */
  visitor?: VisitorOut | null;
  /**
   * Short-lived signed capability token, bound to this exact `id` and tenant,
   * that authorizes the public KYC follow-up calls (`/v1/kyc/initiate`,
   * `/v1/kyc/skip`, `/v1/kyc/status/{id}`). Present ONLY on the creation
   * response (the public check-in submit endpoints) — a bare check-in id no
   * longer authorizes those calls. Expires ~30 min after creation; a
   * missing/invalid/mismatched token returns 403 AUTH_PERMISSION_DENIED.
   * Hold it in component state / the kiosk resume marker only long enough to
   * complete KYC — never treat it as a session token.
   */
  capabilityToken?: string;
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

// ── Unified pending-approvals queue ─────────────────────────────────

/**
 * Source of a row in `GET /v1/tenants/{tenant_id}/pending-approvals`.
 *
 * Drives the action endpoint:
 *  - `"checkin"`     → `POST /v1/checkins/{checkinId}/confirm`
 *  - `"appointment"` → `POST /v1/appointments/{appointmentId}/check-in`
 */
export type PendingApprovalSourceType = "checkin" | "appointment";

/**
 * State of a row in the unified queue. Maps to the two source collections:
 *  - `pending_approval` for kiosk check-ins ready for receptionist review
 *  - `pending_verification` for kiosk check-ins still in the KYC widget /
 *    awaiting webhook resolution. These appear in the queue so reception
 *    can spot stuck visitors (kiosk crash, network drop, abandoned widget)
 *    but the approve/reject actions are disabled until the row settles.
 *  - `scheduled` for host-pre-vetted appointments whose day has come
 */
export type PendingApprovalState =
  | "pending_approval"
  | "pending_verification"
  | "scheduled";

/**
 * One row in the unified pending-approvals queue.
 *
 * Returned by `GET /v1/tenants/{tenant_id}/pending-approvals`. Carries
 * the discriminator (`sourceType`) so the frontend knows which endpoint
 * to call to action it. Field availability varies by source — see the
 * inline notes.
 */
export interface PendingApprovalItem {
  id: string;
  sourceType: PendingApprovalSourceType;
  tenantId: string;
  state: PendingApprovalState;
  verified: boolean;

  visitorName: string;
  company?: string | null;
  purpose?: string | null;
  expectedDurationMinutes?: number | null;

  /** Presigned photo URL — host's pre-vetted shot for appointments, kiosk portrait for check-ins. */
  photoUrl?: string | null;

  departmentId?: string | null;
  hostId?: string | null;

  /** Set on `appointment` rows only. */
  scheduledDatetime?: number | null;
  /** Always set; for appointments this is the appointment's createdAt. */
  createdAt: number;

  visitor?: VisitorOut | null;

  /** Set on `appointment` rows only. */
  appointmentId: string | null;
  /** Set on `checkin` rows only. */
  checkinId: string | null;
}

export interface PendingApprovalsParams {
  skip?: number;
  limit?: number;
  /** Set false to suppress appointment rows and get the legacy "checkins only" view. Default true. */
  includeAppointments?: boolean;
}
