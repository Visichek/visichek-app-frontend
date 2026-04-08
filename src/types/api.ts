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
/** Used by most list endpoints */
export interface StartStopParams {
  start?: number;
  stop?: number;
}

/** Used by newer admin endpoints (plans, subscriptions, discounts) */
export interface SkipLimitParams {
  skip?: number;
  limit?: number;
}

export interface PaginatedMeta {
  total?: number;
  start?: number;
  stop?: number;
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
}
