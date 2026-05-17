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
