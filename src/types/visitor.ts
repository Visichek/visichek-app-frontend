import type {
  VisitStatus,
  CheckInMethod,
  CheckOutMethod,
  VerificationStatus,
  AppointmentStatus,
  ProfilingPreference,
  SystemUserRole,
} from "./enums";

/**
 * Visitor-adjacent types kept after the check-in rewrite.
 *
 * All request/response shapes for the staged check-in flow (CheckInRequest,
 * ConfirmCheckInRequest/Response, DenyVisitorRequest, ApplyIdScanRequest,
 * UpdateDraftSessionRequest) have moved to src/types/checkin.ts under new
 * names. Anything staged-flow-specific has been removed from this file.
 */

/**
 * Body for POST /v1/visitors/check-out.
 *
 * Two equivalent ways to call this:
 *
 * 1. **Discriminated form** (what the awaiting-checkout picker sends):
 *    `{ sourceType, checkoutId }`. Both come straight off the picker
 *    row — no joins, no extra lookups, the server routes by sourceType.
 *
 * 2. **Badge QR fast path**: `{ badgeQrToken }` alone is enough — the
 *    server resolves the matching record itself. Works for both classic
 *    visit-session HMAC tokens and approved-checkin raw qr_code_value.
 *
 * The legacy direct-form fields (`sessionId`, `checkinId`,
 * `appointmentId`) are reserved for callers that already hold a
 * specific record id from elsewhere — the picker UI never needs them.
 *
 * `checkOutMethod` only persists for `visit_session` source rows;
 * `approved_checkin` and `scheduled_appointment` accept-and-ignore it.
 */
export interface CheckOutRequest {
  badgeQrToken?: string;
  sourceType?: AwaitingCheckoutSourceType;
  checkoutId?: string;
  /** Direct-id form, reserved for non-picker callers. */
  sessionId?: string;
  checkinId?: string;
  appointmentId?: string;
  checkOutMethod?: CheckOutMethod;
  /**
   * Optional free-text reason recorded on the checkout (WS6). Manual
   * checkouts may attach one; the auto-checkout sweep stamps its own
   * ("Auto checkout after {N}h (no checkout recorded)").
   */
  checkOutReason?: string;
}

/**
 * Discriminator for awaiting-checkout rows. Each value backs a different
 * collection on the server with its own eligibility rule and terminal
 * state — the `source_type` + `checkout_id` pair on a row is enough to
 * route a checkout server-side.
 */
export type AwaitingCheckoutSourceType =
  | "visit_session"
  | "approved_checkin"
  | "scheduled_appointment";

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
  /**
   * Why the visit was closed (WS6). Set by the auto-checkout sweep and
   * optionally by manual checkout. Absent on rows closed before the
   * feature shipped.
   */
  checkOutReason?: string | null;
  /** True when the auto-checkout sweep closed this visit (WS6). */
  autoCheckedOut?: boolean;
  checkedInAt: number;
  checkedOutAt?: number;
  checkedInBy?: string;
  checkedOutBy?: string;
  badgeQrToken?: string;
  badgeFormat?: "A6" | "A7";
  visitorNameSnapshot?: string;
  /**
   * Snapshot strings stamped on the session at register-time so badges and
   * audit reads don't have to re-resolve the host / department by id. Both
   * are populated by the appointment check-in path and the staged check-in
   * confirm path; legacy rows from older flows may be missing them.
   */
  hostNameSnapshot?: string;
  departmentNameSnapshot?: string;
  /**
   * Phase 4 (branch isolation, queued): every visit session will carry
   * its branch id. May be missing on rows fetched before the rollout —
   * treat as optional.
   */
  branchId?: string;
  /**
   * Phase 4 (branch isolation, queued): embedded branch label for
   * unscoped roles. May be `null` for branch-scoped viewers since they
   * always operate inside their own branch.
   */
  branchSummary?: { id: string; name: string; isActive?: boolean } | null;
}

export interface VisitorProfileSummary {
  id: string;
  fullName: string;
  company?: string;
  phone?: string;
  photoUrl?: string;
}

/**
 * Visitor summary as returned inline by GET /v1/visitors/awaiting-checkout
 * (and other approved-checkin enriched endpoints). Note: this is distinct
 * from VisitorProfileSummary — the field names match the backend payload
 * (`portraitUrl`, not `photoUrl`).
 */
export interface VisitorSummary {
  id: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  verified?: boolean;
  verificationMethod?: string | null;
  portraitUrl?: string | null;
}

/**
 * Host snapshot embedded on appointment / visit-session reads. As of the
 * 2026-05-20 backend rewire this is a HostBriefSummary (sourced from the
 * hosts roster, with a system_user fallback for legacy rows) — NOT the old
 * UserBriefSummary. Read `.name` (not `.fullName`); `.phone`,
 * `.pictureImageUrl`, and `.departmentId` are now available too.
 */
export interface HostSummary {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  departmentId?: string | null;
  pictureImageUrl?: string | null;
  isActive?: boolean;
}

export interface DepartmentSummary {
  id: string;
  name: string;
}

export interface ReceptionistSummary {
  id: string;
  fullName: string;
  email?: string;
  role?: SystemUserRole;
}

/**
 * Enriched visit session returned by GET /v1/visitors/awaiting-checkout.
 * Carries the same fields as VisitSession plus snapshot strings and the
 * resolved summaries needed to render a picker without follow-up calls.
 */
export interface VisitSessionWithSummary extends VisitSession {
  receptionistId?: string;
  checkInTime?: number | null;
  checkOutTime?: number | null;
  badgeExpiry?: number;
  // Top-level fields included by the awaiting-checkout payload.
  visitorName?: string | null;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  portraitUrl?: string | null;
  approvedAt?: number | null;
  // Snapshot strings (kept for older endpoints / appointment links).
  visitorNameSnapshot?: string;
  companySnapshot?: string;
  hostNameSnapshot?: string;
  departmentNameSnapshot?: string;
  receptionistNameSnapshot?: string;
  // Resolved summaries.
  visitorSummary?: VisitorSummary;
  visitorProfileSummary?: VisitorProfileSummary;
  hostSummary?: HostSummary;
  departmentSummary?: DepartmentSummary;
  receptionistSummary?: ReceptionistSummary;
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
  /** Phase 4 (branch isolation, queued) — see VisitSession. */
  branchId?: string;
  /** Phase 4 — see VisitSession. May be null for branch-scoped viewers. */
  branchSummary?: { id: string; name: string; isActive?: boolean } | null;
}

/**
 * Row shape returned by GET /v1/visitors/awaiting-checkout.
 *
 * The list is the union of three independent collections:
 *  - `visit_session`         classic check-in/check-out records
 *  - `approved_checkin`      staged self-registration records (the
 *                            common path on production today)
 *  - `scheduled_appointment` pre-booked visits whose day has come
 *
 * Every row carries the same envelope; field availability varies by
 * source (e.g. `checkInTime` is only set for `visit_session`,
 * `approvedAt` only for `approved_checkin`, `scheduledDatetime` only
 * for `scheduled_appointment`). `id == checkoutId` always — the
 * duplication exists so callers can use `id` as a stable list key
 * while submitting `checkoutId` to /check-out.
 *
 * `visitorSummary` and `visitorProfileSummary` are *different things*:
 * the staged-checkin path uses the lightweight per-tenant `visitor`
 * entity, the classic path uses the long-lived deduplicated
 * `visitor_profile`. Renderers must handle whichever is non-null.
 */
export interface AwaitingCheckoutItem {
  id: string;
  sourceType: AwaitingCheckoutSourceType;
  checkoutId: string;
  status: string;

  // Flat visitor + visit fields the picker renders directly.
  visitorName: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  verified?: boolean;
  purpose?: string | null;
  purposeDetails?: string | null;
  expectedDurationMinutes?: number | null;

  // Sort key. Aliases the source-specific timestamp:
  //  - visit_session         → checkInTime (or dateCreated fallback)
  //  - approved_checkin      → approvedAt  (or dateCreated fallback)
  //  - scheduled_appointment → scheduledDatetime
  eligibleSince: number;

  // Source-specific timestamps. Only one is populated per row.
  approvedAt?: number | null;
  scheduledDatetime?: number | null;
  checkInTime?: number | null;

  badgeQrToken?: string | null;

  visitorId?: string | null;          // approved_checkin only
  visitorProfileId?: string | null;   // visit_session / appointment only
  departmentId?: string | null;
  hostId?: string | null;
  appointmentId?: string | null;

  /**
   * Branch this row belongs to (Phase 4). Populated whenever the source
   * record's `branchId` resolves; null for a legacy row with no branch.
   */
  branchId?: string | null;
  branchSummary?: { id: string; name: string; isActive?: boolean } | null;

  // Resolved summaries — exactly one of visitorSummary /
  // visitorProfileSummary is non-null.
  visitorSummary?: VisitorSummary | null;
  visitorProfileSummary?: VisitorProfileSummary | null;
  tenantSummary?: Record<string, unknown> | null;
  departmentSummary?: DepartmentSummary | null;
  hostSummary?: HostSummary | null;
  receptionistSummary?: ReceptionistSummary | null;
  appointmentSummary?: Record<string, unknown> | null;

  /**
   * Raw source record plus a denormalised badge for `approved_checkin`.
   * Treat as opaque for normal rendering; drop into it only when you
   * need a field the flat layout doesn't expose.
   */
  details?: Record<string, unknown> | null;
}

/**
 * Names the source field that `eligibleSince` was read from on the
 * source record. Drives the rendering label for the eligibility
 * timestamp ("Checked in at", "Approved at", "Scheduled for").
 */
export type EligibleSinceField =
  | "check_in_time"
  | "approved_at"
  | "scheduled_datetime";

/**
 * Unified response shape for POST /v1/visitors/check-out — same shape
 * for all three source types. The server pre-computes the timing math
 * (actual duration, variance vs expected duration when available) so
 * the frontend never subtracts timestamps itself; the visitor's device
 * clock can be wrong and the picker entry the receptionist clicked may
 * have been stale.
 *
 * Exactly one of `visitSession` / `checkin` / `appointment` is non-null,
 * keyed by `sourceType`. The full source record is nested there with
 * its own new terminal-state timestamp (`checkOutTime` / `checkedOutAt`
 * / `fulfilledAt`) — equal to the top-level `checkedOutAt` for
 * uniformity.
 */
export interface CheckoutResult {
  id: string;
  sourceType: AwaitingCheckoutSourceType;
  checkoutId: string;
  status: "checked_out" | "fulfilled";

  /**
   * The reference timestamp the duration is measured against. Always
   * set for visit_session and scheduled_appointment; nullable for
   * approved_checkin if the row never recorded `approved_at`.
   */
  eligibleSince?: number | null;
  /** Names the source field used for `eligibleSince` (see {@link EligibleSinceField}). */
  eligibleSinceField: EligibleSinceField;

  /** Server time at the moment of checkout. Persisted on the source record. */
  checkedOutAt: number;

  /** `checkedOutAt - eligibleSince`, floored at 0. Null when `eligibleSince` is null. */
  actualDurationSeconds?: number | null;
  /** Same value, divided by 60, rounded to 1 decimal — for direct rendering. */
  actualDurationMinutes?: number | null;

  /** What the visitor's purpose said they'd need. Only set for `approved_checkin`. */
  expectedDurationMinutes?: number | null;

  /**
   * `actualDurationSeconds - expectedDurationMinutes*60`. Negative = left
   * early, positive = overstayed. Only set when both an expected and an
   * actual duration are available.
   */
  durationVarianceSeconds?: number | null;

  /** Only persisted on `visit_session` records; echoed back here when set. */
  checkOutMethod?: string | null;
  /** Free-text checkout reason, when one was recorded (WS6). */
  checkOutReason?: string | null;
  /** True when the auto-checkout sweep produced this record (WS6). */
  autoCheckedOut?: boolean;

  /** Populated only when `sourceType === "visit_session"`. */
  visitSession?: VisitSession | null;
  /** Populated only when `sourceType === "approved_checkin"`. */
  checkin?: Record<string, unknown> | null;
  /** Populated only when `sourceType === "scheduled_appointment"`. */
  appointment?: Record<string, unknown> | null;
}

/** @deprecated Use {@link CheckoutResult} instead. */
export type CheckOutResponse = CheckoutResult;

export interface Appointment {
  id: string;
  tenantId: string;
  visitorProfileId?: string;
  hostId: string;
  departmentId: string;
  /** Phase 4 (branch isolation, queued) — see VisitSession. */
  branchId?: string;
  /** Phase 4 — see VisitSession. May be null for branch-scoped viewers. */
  branchSummary?: { id: string; name: string; isActive?: boolean } | null;
  visitorNameSnapshot?: string;
  /**
   * Visitor phone captured at schedule time. The backend promoted this to a
   * first-class system-required field (`visitor_phone`) so appointment-driven
   * check-in never has to prompt for it. `visitorPhoneSnapshot` is the older
   * alias kept for backward compatibility with responses that predate the
   * rename.
   */
  visitorPhone?: string | null;
  visitorPhoneSnapshot?: string;
  hostNameSnapshot?: string;
  scheduledDatetime: number;
  purpose?: string;
  status: AppointmentStatus;
  /**
   * Server time at the moment the receptionist marked this appointment
   * as fulfilled (i.e. checked out). Persisted by `_checkout_due_appointment`
   * so historical rows carry the full timing fact. `null` for any
   * appointment that hasn't been fulfilled yet.
   */
  fulfilledAt?: number | null;
  /**
   * Object key in the storage backend for a photo of the expected visitor
   * the host pre-vetted. Surfaced to the receptionist on the pending-
   * approvals row so they can match the person at the desk to the face
   * the host uploaded.
   */
  expectedVisitorPhotoObjectKey?: string | null;
  /**
   * Presigned URL resolved from `expectedVisitorPhotoObjectKey` on read.
   * Drop straight into an `<img src=...>`. `null` when the key is unset
   * or URL generation fails.
   */
  expectedVisitorPhotoUrl?: string | null;
  /**
   * Tenant-specific form data — values keyed on the published
   * appointment form's `field_id`. The shape is fully dynamic; the
   * scheduler renders it from the form-requirements endpoint.
   *
   * For file/image/signature/id_document fields, the value is the
   * object_key returned by the unified upload endpoint (see
   * `lib/upload/unified-upload.ts`), not the bytes themselves.
   */
  tenantFormData?: Record<string, unknown> | null;
  /** Form snapshot the server applied when this appointment was created. */
  tenantFormId?: string | null;
  tenantFormVersion?: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface AppointmentRequest {
  tenantId: string;
  visitorProfileId?: string;
  hostId: string;
  departmentId: string;
  visitorNameSnapshot?: string;
  /**
   * Phone number captured at scheduling time. Now a system-required field
   * (`visitor_phone`) unless a `visitorProfileId` is linked: the backend uses
   * it at check-in to look up or create the visitor profile, so collecting it
   * here avoids a missing-phone prompt at the desk.
   */
  visitorPhone?: string;
  /** @deprecated Older alias for {@link visitorPhone}; send `visitorPhone`. */
  visitorPhoneSnapshot?: string;
  hostNameSnapshot?: string;
  scheduledDatetime: number;
  purpose?: string;
  status?: AppointmentStatus;
  /** Optional photo of the expected visitor — see {@link Appointment}. */
  expectedVisitorPhotoObjectKey?: string | null;
  /**
   * Tenant-required fields keyed on the appointment form's `field_id`.
   * Backend rejects with `400 VALIDATION_FAILED` and
   * `details.missing_fields = ["..."]` when any field marked
   * `required=true` is missing or empty. `tenant_form_id` /
   * `tenant_form_version` are set server-side on accept and must NOT be
   * supplied here.
   */
  tenantFormData?: Record<string, unknown>;
}

// ── Form requirements (system + tenant) ──────────────────────────────

/**
 * One field definition returned by
 * `GET /v1/appointments/form-requirements`.
 *
 * System fields (host_id, department_id, scheduled_datetime) carry
 * `key` and `required: true` only; tenant fields additionally carry
 * label / type / options for dynamic rendering. The scheduler renders
 * two visually-distinct sections; every field marked `required=true`
 * in either list MUST be filled before the create call is accepted.
 */
export interface AppointmentFormFieldRequirement {
  /** field_id from the tenant form, or system-reserved key. */
  key: string;
  required: boolean;
  label?: string;
  type?: string;
  placeholder?: string | null;
  helpText?: string | null;
  options?: Array<{ key: string; label: string }> | null;
}

export interface AppointmentFormRequirementsOut {
  systemRequiredFields: AppointmentFormFieldRequirement[];
  /** null when the tenant has not published an appointment form yet. */
  tenantFormId?: string | null;
  tenantFormVersion?: number | null;
  tenantRequiredFields: AppointmentFormFieldRequirement[];
}

/**
 * Body for `POST /v1/appointments/{appointment_id}/check-in`.
 *
 * Every field is optional — the service hydrates everything from the
 * appointment + linked visitor profile by default. Send overrides only
 * when the receptionist needs to correct something at the desk.
 *
 * `host_id`, `department_id`, and `purpose` are intentionally NOT here:
 * they always come from the appointment so the visit row matches the
 * host's calendar entry.
 */
export interface AppointmentCheckInRequest {
  /** Overrides profile.phone. Required in effective form (override OR profile must supply it). */
  phone?: string;
  /** Overrides appointment.visitor_name_snapshot / profile.full_name. */
  fullName?: string;
  /** Overrides profile.company. */
  company?: string;
  photoObjectKey?: string;
  idImageObjectKey?: string;
  /** Required for tenants on `lawful_basis="consent"`. */
  consentGranted?: boolean;
  /** Default "A7". */
  badgeFormat?: "A6" | "A7";
  /**
   * When false, register only — session stays in `registered` and the
   * appointment remains `scheduled`. Use for KYC/ID-scan flows that need
   * to complete before badge issue. Default true.
   */
  issueBadge?: boolean;
}

/**
 * Successful response from `POST /v1/appointments/{appointment_id}/check-in`.
 *
 * `badgeQrToken` is only populated when `issueBadge` was true (the
 * default) AND the tenant's plan grants badges. Otherwise the session is
 * `registered`, the appointment stays `scheduled`, and the receptionist
 * issues the badge later via the staged check-in flow.
 *
 * The badge PDF is no longer returned — render the printable badge on
 * the frontend from `session` snapshots + `badgeQrToken` (typically by
 * opening `/badge/{token}`).
 */
export interface AppointmentCheckInResponse {
  appointmentId: string;
  session: VisitSession;
  visitorProfile: VisitorProfile;
  badgeQrToken?: string;
}
