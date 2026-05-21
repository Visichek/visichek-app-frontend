/**
 * Presigned upload pipeline — the single way the frontend uploads a file.
 *
 * Bytes go browser → storage (S3) directly; the API server is never in the
 * file-transfer path. Every upload is THREE steps:
 *
 *   1. POST intent  → presigned PUT target (`uploadUrl` + `headers`)
 *   2. PUT the raw file straight to `uploadUrl` (NOT to our API)
 *   3. POST confirm → authoritative metadata (size read from storage)
 *
 * Two surfaces share the exact same flow, only the paths differ:
 *   - private (authenticated, every plan):
 *       POST /v1/uploads/intent   → PUT → POST /v1/uploads/confirm
 *   - public (kiosk; anonymous when the tenant's plan grants it, otherwise a
 *     super_admin / dept_admin / receptionist token):
 *       POST /v1/public/tenants/{tenantId}/uploads/intent → PUT
 *         → POST /v1/public/tenants/{tenantId}/uploads/confirm
 *
 * Quota is enforced for real at CONFIRM (on the true stored size), so confirm
 * can 429 even after a passing intent — the object is discarded server-side,
 * we just surface the error.
 */

import { apiGet, apiPost } from "@/lib/api/request";
import { ApiError } from "@/types/api";
import type {
  UploadPurpose,
  UploadIntentRequest,
  UploadIntentResponse,
  UploadConfirmRequest,
  UploadResponse,
  RefreshDownloadUrlResponse,
} from "@/types/api";

const PRIVATE_INTENT_PATH = "/uploads/intent";
const PRIVATE_CONFIRM_PATH = "/uploads/confirm";
const REFRESH_URL_PATH = "/uploads/url";

export const publicIntentPath = (tenantId: string) =>
  `/public/tenants/${tenantId}/uploads/intent`;

export const publicConfirmPath = (tenantId: string) =>
  `/public/tenants/${tenantId}/uploads/confirm`;

export interface UploadParams {
  file: File;
  /** Defaults to `system` (private) or `kiosk_form` (public) server-side. */
  purpose?: UploadPurpose;
  /** Tenant form field_id this satisfies (recommended for kiosk uploads). */
  fieldId?: string;
}

/**
 * The direct-to-storage PUT failed. Distinct from an `ApiError` (which comes
 * from our own intent/confirm endpoints) so callers can tell "storage
 * rejected the bytes" apart from "the API rejected the request".
 */
export class UploadPutError extends Error {
  /** True when re-running intent + PUT from scratch is worth a shot (expired
   * URL / transient storage error), false for a hard client error. */
  readonly retriable: boolean;
  readonly status: number;

  constructor(status: number, retriable: boolean) {
    super("Couldn't upload the file to storage. Please try again.");
    this.name = "UploadPutError";
    this.status = status;
    this.retriable = retriable;
  }
}

function buildIntentBody({ file, purpose, fieldId }: UploadParams): UploadIntentRequest {
  return {
    fileName: file.name,
    // The Content-Type we PUT must equal what we declare here, so default
    // both to the same fallback when the browser can't sniff the type.
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    ...(purpose ? { purpose } : {}),
    ...(fieldId ? { fieldId } : {}),
  };
}

/**
 * Step 2 — PUT the raw bytes to the presigned URL.
 *
 * Critical: this does NOT go through the axios client. It must NOT carry our
 * `Authorization` header or cookies (the presigned URL has its own signature),
 * the body is the raw File (NOT FormData), and the headers are exactly what
 * intent returned (the `Content-Type` is part of the signature).
 */
async function putToStorage(
  intent: UploadIntentResponse,
  file: File,
): Promise<void> {
  const headers =
    intent.headers ?? { "Content-Type": file.type || "application/octet-stream" };

  let response: Response;
  try {
    response = await fetch(intent.uploadUrl, {
      method: intent.method || "PUT",
      headers,
      body: file,
    });
  } catch {
    // Network-level failure (offline, CORS, DNS) — worth one clean retry.
    throw new UploadPutError(0, true);
  }

  if (!response.ok) {
    // 403/400 from S3 is usually a Content-Type mismatch or an expired URL;
    // a fresh intent fixes the latter, so treat it as retriable.
    throw new UploadPutError(response.status, true);
  }
}

async function runUploadOnce(
  intentPath: string,
  confirmPath: string,
  params: UploadParams,
): Promise<UploadResponse> {
  const intent = await apiPost<UploadIntentResponse>(
    intentPath,
    buildIntentBody(params),
  );
  await putToStorage(intent, params.file);
  const confirmBody: UploadConfirmRequest = { objectKey: intent.objectKey };
  return apiPost<UploadResponse>(confirmPath, confirmBody);
}

/**
 * The two failure modes the migration guide tells us to retry exactly once:
 *   - confirm 409: the PUT never landed (object not found for the key)
 *   - PUT failure: expired presigned URL / transient storage error
 * Both are fixed by re-running the whole flow (fresh intent → fresh URL → PUT
 * → confirm). Deterministic rejections (413 too large, 415 wrong type, 429
 * quota, 403 forbidden) are NOT retried — a retry would just fail identically.
 */
function isRetriable(err: unknown): boolean {
  if (err instanceof UploadPutError) return err.retriable;
  if (err instanceof ApiError) return err.status === 409;
  return false;
}

async function runUpload(
  intentPath: string,
  confirmPath: string,
  params: UploadParams,
): Promise<UploadResponse> {
  try {
    return await runUploadOnce(intentPath, confirmPath, params);
  } catch (err) {
    if (isRetriable(err)) {
      return runUploadOnce(intentPath, confirmPath, params);
    }
    throw err;
  }
}

/**
 * Authenticated upload (every plan). Pass a `purpose` matching what the
 * caller will reference the `object_key` for (e.g. `id_document`,
 * `appointment_photo`, `branding`). Store the returned `objectKey` on the
 * parent record; `downloadUrl` is good for an immediate preview.
 *
 * Throws `ApiError` on 413 (too large), 415 (non-image for image-only
 * purposes), 429 (quota), or 403; `UploadPutError` if the storage PUT fails.
 */
export async function uploadPrivate(
  params: UploadParams,
): Promise<UploadResponse> {
  return runUpload(PRIVATE_INTENT_PATH, PRIVATE_CONFIRM_PATH, params);
}

/**
 * Public tenant upload — for kiosk file/image/signature/id_document fields.
 * When the tenant's plan does not grant the public surface, the call must
 * travel with a system-user Bearer cookie; otherwise the gate rejects with
 * 403. `purpose` defaults to `kiosk_form` server-side.
 */
export async function uploadPublic(
  tenantId: string,
  params: UploadParams,
): Promise<UploadResponse> {
  return runUpload(publicIntentPath(tenantId), publicConfirmPath(tenantId), params);
}

/**
 * Mint a fresh presigned download URL for an object you already have the key
 * for — `GET /v1/uploads/url?object_key=...`. Use this to refresh an expired
 * preview/download URL without refetching the whole parent object.
 *
 * `expiresIn` is optional (60s..7 days, default 24h server-side). Throws
 * `ApiError` 403 (not your object / wrong tenant) or 404 (unknown key).
 */
export async function refreshDownloadUrl(
  objectKey: string,
  expiresIn?: number,
): Promise<RefreshDownloadUrlResponse> {
  return apiGet<RefreshDownloadUrlResponse>(REFRESH_URL_PATH, {
    object_key: objectKey,
    ...(expiresIn ? { expires_in: expiresIn } : {}),
  });
}
