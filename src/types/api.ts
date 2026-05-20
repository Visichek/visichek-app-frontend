// ── Response Envelope ──────────────────────────────────────────────────
export interface SuccessEnvelope<T> {
  success: true;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
  requestId?: string;
}

export interface ErrorEnvelope {
  success: false;
  message: string;
  data?: {
    code: string;
    details?: unknown;
  };
  requestId?: string;
}

export type ApiEnvelope<T> = SuccessEnvelope<T> | ErrorEnvelope;

// ── Pagination ────────────────────────────────────────────────────────
/** Pagination params for every list endpoint. */
export interface SkipLimitParams {
  skip?: number;
  limit?: number;
}

export interface PaginatedMeta {
  total?: number;
  skip?: number;
  limit?: number;
}

// ── Upload Flow ───────────────────────────────────────────────────────
export interface UploadIntentRequest {
  fileName: string;
  mimeType: string;
  size: number;
}

export interface UploadIntentResponse {
  objectKey: string;
  uploadUrl: string;
  expiresIn: number;
  method: string;
  headers?: Record<string, string>;
}

export interface CompleteUploadRequest {
  objectKey: string;
  fileName: string;
  mimeType: string;
  size: number;
  checksum?: string;
}

// ── Unified Upload Pipeline (private + public) ────────────────────────
//
// Both `POST /v1/uploads/private` (authenticated, every plan) and
// `POST /v1/public/tenants/{tenant_id}/uploads` (plan-gated, anonymous
// when granted) return this shape.

export type UploadPurpose =
  | "kiosk_form"
  | "visitor_photo"
  | "id_document"
  | "appointment_photo"
  | "branding"
  | "system"
  // Image-only purposes: the backend enforces an image MIME allowlist
  // (JPEG/PNG/WebP/GIF/BMP/HEIC/HEIF; SVG rejected) and returns 415
  // UNSUPPORTED_MEDIA_TYPE on a non-image. Used by the host form.
  | "host_photo"
  | "host_signature";

export interface UploadResponse {
  objectKey: string;
  /** Pre-signed presentation URL — drop into <img src=...>. */
  downloadUrl: string;
  fileName: string;
  mimeType: string;
  size: number;
  backend: "s3" | "local";
  purpose: UploadPurpose;
  tenantId?: string | null;
  fieldId?: string | null;
  expiresInSeconds: number;
}

/**
 * Combined storage budget (plan + active storage_extension addons).
 *
 * Returned by `GET /v1/storage/quota` for any tenant principal. Render
 * before kicking off a multipart upload UI so the user sees
 * "used X of Y" alongside a "purchase addon" CTA.
 */
export interface StorageQuotaOut {
  tenantId: string;
  /** Plan-granted storage in MB; null = unlimited. */
  planStorageMb: number | null;
  /** Sum of active storage_extension addons (quantity * benefit). */
  addonStorageMb: number;
  /** Plan + addon total in MB; null = unlimited. */
  totalStorageMb: number | null;
  usedBytes: number;
  usedMb: number;
  /** null when the plan is unlimited. */
  remainingMb: number | null;
  documentCount: number;
  maxDocuments: number | null;
  maxFileSizeMb: number;
  activeAddons: number;
}

// ── API Error ─────────────────────────────────────────────────────────
export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;
  requestId?: string;

  constructor(opts: {
    message: string;
    code: string;
    status: number;
    details?: unknown;
    requestId?: string;
  }) {
    super(opts.message);
    this.name = "ApiError";
    this.code = opts.code;
    this.status = opts.status;
    this.details = opts.details;
    this.requestId = opts.requestId;
  }

  get isPermissionError(): boolean {
    return this.status === 403;
  }
}

export function isPermissionError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 403;
}

/**
 * Detect the structured 400 the backend returns when callers try to
 * remove a super_admin via DELETE /v1/system-users/{id}. The message
 * field is human-readable copy and may shift; the FE branches on the
 * machine code in `details.code` per spec.
 */
export function isSuperAdminDeleteBlocked(error: unknown): error is ApiError {
  if (!(error instanceof ApiError) || error.status !== 400) return false;
  const details = error.details;
  if (typeof details !== 'object' || details === null) return false;
  return (details as { code?: string }).code === 'SUPER_ADMIN_DELETE_BLOCKED';
}

/**
 * Read the human-friendly hint from a SUPER_ADMIN_DELETE_BLOCKED error.
 */
export function superAdminDeleteHint(error: ApiError): string | undefined {
  const details = error.details;
  if (typeof details !== 'object' || details === null) return undefined;
  const hint = (details as { hint?: unknown }).hint;
  return typeof hint === 'string' ? hint : undefined;
}

/**
 * `MAIN_SUPER_ADMIN_LOCKED` — the request tried to PATCH, DELETE, or
 * bulk-mutate the row that is the tenant's main super_admin. The role
 * must be moved first via the two-step transfer flow; the same code
 * fires regardless of which mutation was attempted.
 *
 * `details.lockedFields` enumerates which fields the server refused to
 * touch on this specific request (commonly `["role"]`, `["accountStatus"]`,
 * or `["isActive"]`). Prefer disabling those controls on the row in the
 * first place; treat this error as a race-condition fallback (e.g.,
 * another admin transferred ownership between page load and submit).
 */
export type MainSuperAdminLockedField = "role" | "accountStatus" | "isActive";

export function isMainSuperAdminLocked(error: unknown): error is ApiError {
  return error instanceof ApiError && error.code === "MAIN_SUPER_ADMIN_LOCKED";
}

export function mainSuperAdminLockedFields(
  error: ApiError,
): MainSuperAdminLockedField[] {
  const details = error.details;
  if (typeof details !== "object" || details === null) return [];
  const fields = (details as { lockedFields?: unknown }).lockedFields;
  if (!Array.isArray(fields)) return [];
  return fields.filter(
    (f): f is MainSuperAdminLockedField =>
      f === "role" || f === "accountStatus" || f === "isActive",
  );
}

/**
 * `403 SUPER_ADMIN_INVITE_FORBIDDEN` — the request tried to invite a
 * super_admin via `POST /v1/system-users/signup` (or `/invite`). The
 * super_admin role is provisioned through the application-admin path
 * (`POST /v1/admins/tenants/{tenantId}/super-admins`) or rotated via the
 * transfer flow — it cannot be granted from the regular invite endpoint.
 */
export function isSuperAdminInviteForbidden(error: unknown): error is ApiError {
  return (
    error instanceof ApiError && error.code === "SUPER_ADMIN_INVITE_FORBIDDEN"
  );
}

/**
 * `403 ENTERPRISE_PLAN_MISMATCH` — the request hit a custom enterprise
 * sub-app endpoint (`/v1/enterprise/<slug>/*`) but the calling tenant is
 * not subscribed to the plan whose `name == <slug>`. Hide the nav entry
 * when this fires; calling these from a non-enterprise tenant is a UI bug.
 */
export function isEnterprisePlanMismatch(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    error.status === 403 &&
    error.code === "ENTERPRISE_PLAN_MISMATCH"
  );
}

/**
 * `402 SUBSCRIPTION_REQUIRED` / `SUBSCRIPTION_INACTIVE` — the tenant has
 * no active subscription. Should never happen post-bootstrap because the
 * backend lazy-provisions the FREE plan; if it does, the auto-provisioner
 * lost a race. Treat as a transient bug — invalidate session/usage state
 * and let the user retry.
 */
export function isSubscriptionRequired(error: unknown): error is ApiError {
  if (!(error instanceof ApiError) || error.status !== 402) return false;
  return (
    error.code === "SUBSCRIPTION_REQUIRED" ||
    error.code === "SUBSCRIPTION_INACTIVE"
  );
}

/**
 * `403 FEATURE_DISABLED` — the tenant's tier doesn't allow this endpoint.
 * Body carries `details` with a human-readable upgrade hint.
 */
export function isFeatureDisabled(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    error.status === 403 &&
    error.code === "FEATURE_DISABLED"
  );
}

/**
 * `403 AUTH_PERMISSION_DENIED` with `details.code = "PASSWORD_CHANGE_REQUIRED"`
 * — the user authenticated but is holding a temporary password. The
 * backend rejects every endpoint except the change-password ones until
 * the user sets a real password.
 *
 * The frontend should treat this as a hard redirect to the
 * change-password screen, even on deep links / browser-back navigation
 * that doesn't otherwise read `mustChangePassword`.
 */
export function isPasswordChangeRequired(error: unknown): error is ApiError {
  if (!(error instanceof ApiError) || error.status !== 403) return false;
  if (error.code !== "AUTH_PERMISSION_DENIED") return false;
  const details = error.details;
  if (typeof details !== "object" || details === null) return false;
  return (details as { code?: string }).code === "PASSWORD_CHANGE_REQUIRED";
}

/**
 * `403 AUTH_PERMISSION_DENIED` from the kiosk-submit plan gate when a
 * token of the wrong role was attached (e.g. an auditor token on a
 * tenant whose plan blocks anonymous submit). Body's `details.role`
 * carries the offending role for diagnostics.
 *
 * Distinct from `FEATURE_DISABLED`, which fires when NO token is sent
 * but the plan requires one.
 */
export function isKioskAuthPermissionDenied(
  error: unknown,
): error is ApiError {
  if (!(error instanceof ApiError) || error.status !== 403) return false;
  if (error.code !== "AUTH_PERMISSION_DENIED") return false;
  const details = error.details;
  if (typeof details !== "object" || details === null) return true;
  // PASSWORD_CHANGE_REQUIRED is a different surface — split it out via
  // isPasswordChangeRequired above; this helper covers the kiosk gate.
  return (details as { code?: string }).code !== "PASSWORD_CHANGE_REQUIRED";
}

export interface QuotaExceededDetails {
  collection: string;
  operation: string;
  current: number;
  limit: number;
  resetInterval?: string;
}

/**
 * `429 QUOTA_EXCEEDED` — a numeric cap was hit. Render the included
 * usage/limit pair next to an "Upgrade for more" CTA.
 */
export function isQuotaExceeded(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    (error.status === 429 || error.code === "QUOTA_EXCEEDED")
  );
}

export function quotaExceededDetails(
  error: ApiError,
): QuotaExceededDetails | undefined {
  const details = error.details;
  if (typeof details !== "object" || details === null) return undefined;
  const d = details as Record<string, unknown>;
  if (typeof d.collection !== "string" || typeof d.operation !== "string") {
    return undefined;
  }
  return {
    collection: d.collection,
    operation: d.operation,
    current: typeof d.current === "number" ? d.current : 0,
    limit: typeof d.limit === "number" ? d.limit : 0,
    resetInterval:
      typeof d.reset_interval === "string"
        ? d.reset_interval
        : typeof d.resetInterval === "string"
          ? d.resetInterval
          : undefined,
  };
}
