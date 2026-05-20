"use client";

import { useState } from "react";
import { toast } from "sonner";
import { uploadPrivate, uploadPublic } from "@/lib/upload/unified-upload";
import { ApiError, type UploadPurpose } from "@/types/api";

/**
 * Where the uploaded object lives, and therefore how it's reached later:
 *
 *  - `"private"` → `POST /v1/uploads/private`. Access-controlled assets
 *    (signatures, ID documents, anything sensitive). The presentation URL
 *    is auth-gated.
 *  - `"public"` → `POST /v1/public/tenants/{tenantId}/uploads`. Embeddable,
 *    non-sensitive assets (host portraits, kiosk form images). Requires a
 *    `tenantId`. From an authenticated tenant principal the call still
 *    carries the session cookie, so it works even when the plan doesn't
 *    grant the anonymous public surface.
 */
export type UploadVisibility = "public" | "private";

export interface UploadResult {
  objectKey: string;
  fileName: string;
  mimeType: string;
  size: number;
  /** Pre-signed presentation URL — drop into <img src=...>. */
  downloadUrl?: string;
}

interface UseDocumentUploadState {
  isUploading: boolean;
  error: string | null;
}

interface UseDocumentUploadReturn {
  upload: (file: File) => Promise<UploadResult | null>;
  isUploading: boolean;
  error: string | null;
  reset: () => void;
}

interface UseDocumentUploadOptions {
  /**
   * Upload purpose for the unified pipeline. Drives storage prefix +
   * plan/quota accounting on the backend.
   * Defaults to `appointment_photo` so existing callers (the appointment
   * form) hit the right purpose bucket without an explicit override.
   */
  purpose?: UploadPurpose;
  /**
   * Tenant form field this upload satisfies. Set when the upload
   * fulfills a published form field — the backend records it on the
   * resulting Document row.
   */
  fieldId?: string;
  /**
   * Upload destination. Defaults to `"private"` to preserve the original
   * behavior. Set `"public"` (with {@link tenantId}) for non-sensitive,
   * embeddable assets.
   */
  visibility?: UploadVisibility;
  /**
   * Tenant id — required when `visibility === "public"`, ignored otherwise.
   */
  tenantId?: string | null;
}

/**
 * Hook for tenant-side file uploads.
 *
 * Posts directly to `POST /v1/uploads/private` (the unified upload
 * pipeline). The legacy two-step `/v1/documents/upload-intents` →
 * presigned PUT → `/v1/documents/complete` flow is no longer used here
 * because the local-storage backend returns a `client.visichek.app`
 * presigned URL that 404s outside the API origin.
 *
 * Every authenticated tenant principal can hit the private upload; the
 * backend enforces plan storage limits and per-file size caps before
 * the bytes hit disk, so 413 / 429 can fire before we resolve.
 */
export function useDocumentUpload(
  options: UseDocumentUploadOptions = {},
): UseDocumentUploadReturn {
  const [state, setState] = useState<UseDocumentUploadState>({
    isUploading: false,
    error: null,
  });

  const visibility = options.visibility ?? "private";

  const upload = async (file: File): Promise<UploadResult | null> => {
    try {
      setState({ isUploading: true, error: null });

      let response;
      if (visibility === "public") {
        if (!options.tenantId) {
          throw new Error(
            "A tenant id is required for a public upload.",
          );
        }
        // Let the backend apply its public default (`kiosk_form`) when no
        // explicit purpose is given — `appointment_photo` is a private-only
        // fallback and doesn't belong on the public surface.
        response = await uploadPublic(options.tenantId, {
          file,
          purpose: options.purpose,
          fieldId: options.fieldId,
        });
      } else {
        response = await uploadPrivate({
          file,
          purpose: options.purpose ?? "appointment_photo",
          fieldId: options.fieldId,
        });
      }

      toast.success(`File "${file.name}" uploaded successfully`);
      setState({ isUploading: false, error: null });

      return {
        objectKey: response.objectKey,
        fileName: response.fileName,
        mimeType: response.mimeType,
        size: response.size,
        downloadUrl: response.downloadUrl,
      };
    } catch (err) {
      const errorMessage =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to upload file. Please try again.";

      setState({
        isUploading: false,
        error: errorMessage,
      });

      toast.error(errorMessage);
      return null;
    }
  };

  const reset = () => {
    setState({ isUploading: false, error: null });
  };

  return {
    upload,
    isUploading: state.isUploading,
    error: state.error,
    reset,
  };
}
