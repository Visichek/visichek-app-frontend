/**
 * Unified upload pipeline (section I of changes.txt).
 *
 * Two routes share the same response shape:
 *   - POST /v1/uploads/private — every plan, requires any Bearer token.
 *   - POST /v1/public/tenants/{tenantId}/uploads — plan-gated. When the
 *     tenant's plan grants public submit, anonymous calls are allowed;
 *     otherwise a system-user (super_admin / dept_admin / receptionist)
 *     Bearer token MUST be attached.
 *
 * Both enforce plan storage limits + purchased storage_extension addons
 * before bytes hit disk, so `413` (per-file cap) and `429` (storage cap
 * reached) can fire before the upload completes.
 *
 * The legacy two-step `/v1/documents/upload-intents` → presigned PUT →
 * `/v1/documents/complete` flow in `document-upload.ts` is still used
 * for OCR + visitor photo paths and is unaffected by this module.
 */

import { apiPost } from "@/lib/api/request";
import type { UploadPurpose, UploadResponse } from "@/types/api";

const PRIVATE_UPLOAD_PATH = "/uploads/private";

export const publicUploadPath = (tenantId: string) =>
  `/public/tenants/${tenantId}/uploads`;

export interface UploadParams {
  file: File;
  /** Defaults to `system` (private) or `kiosk_form` (public). */
  purpose?: UploadPurpose;
  /** Tenant form field_id this satisfies (recommended for kiosk uploads). */
  fieldId?: string;
}

function buildForm({ file, purpose, fieldId }: UploadParams) {
  const form = new FormData();
  form.append("file", file);
  if (purpose) form.append("purpose", purpose);
  if (fieldId) form.append("field_id", fieldId);
  return form;
}

/**
 * Authenticated upload (every plan). Pass a `purpose` matching what the
 * caller will reference the `object_key` for (e.g. `id_document`,
 * `appointment_photo`, `visitor_photo`). Tenant-scoped tokens count the
 * upload against the tenant's storage budget; admin / user tokens
 * bypass the per-tenant quota.
 */
export async function uploadPrivate(
  params: UploadParams,
): Promise<UploadResponse> {
  return apiPost<UploadResponse>(PRIVATE_UPLOAD_PATH, buildForm(params));
}

/**
 * Public tenant upload — for kiosk file/image/signature/id_document
 * fields. When the tenant's plan does not grant the public surface, the
 * call must travel with a system-user Bearer token; otherwise the gate
 * rejects with 403 FEATURE_DISABLED (anonymous) or 403
 * AUTH_PERMISSION_DENIED (wrong-role token).
 *
 * `purpose` defaults to `kiosk_form` server-side.
 */
export async function uploadPublic(
  tenantId: string,
  params: UploadParams,
): Promise<UploadResponse> {
  return apiPost<UploadResponse>(publicUploadPath(tenantId), buildForm(params));
}
