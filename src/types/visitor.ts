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
  checkedInAt: number;
  checkedOutAt?: number;
  checkedInBy?: string;
  checkedOutBy?: string;
  badgeQrToken?: string;
  visitorNameSnapshot?: string;
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

export interface HostSummary {
  id: string;
  fullName: string;
  email?: string;
  role?: SystemUserRole;
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
 * Response shape for POST /v1/visitors/check-out — varies by source.
 *
 *  - visit_session  → returns the updated VisitSession.
 *  - approved_checkin / scheduled_appointment → returns a small
 *    discriminated dict carrying the new terminal state plus the raw
 *    record under `checkin` / `appointment`.
 *
 * Easiest consumer pattern: ignore the response entirely and re-fetch
 * `/awaiting-checkout`; trust the server's view.
 */
export type CheckOutResponse =
  | VisitSession
  | {
      id: string;
      sourceType: "approved_checkin";
      status: "checked_out";
      checkin: Record<string, unknown>;
    }
  | {
      id: string;
      sourceType: "scheduled_appointment";
      status: "fulfilled";
      appointment: Record<string, unknown>;
    };

export interface Appointment {
  id: string;
  tenantId: string;
  visitorProfileId?: string;
  hostId: string;
  departmentId: string;
  visitorNameSnapshot?: string;
  hostNameSnapshot?: string;
  scheduledDatetime: number;
  purpose?: string;
  status: AppointmentStatus;
  createdAt: number;
  updatedAt: number;
}

export interface AppointmentRequest {
  tenantId: string;
  visitorProfileId?: string;
  hostId: string;
  departmentId: string;
  visitorNameSnapshot?: string;
  hostNameSnapshot?: string;
  scheduledDatetime: number;
  purpose?: string;
  status?: AppointmentStatus;
}
