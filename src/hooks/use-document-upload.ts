"use client";

import { useState } from "react";
import { toast } from "sonner";
import { uploadPrivate } from "@/lib/upload/unified-upload";
import { ApiError, type UploadPurpose } from "@/types/api";

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

  const upload = async (file: File): Promise<UploadResult | null> => {
    try {
      setState({ isUploading: true, error: null });

      const response = await uploadPrivate({
        file,
        purpose: options.purpose ?? "appointment_photo",
        fieldId: options.fieldId,
      });

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
