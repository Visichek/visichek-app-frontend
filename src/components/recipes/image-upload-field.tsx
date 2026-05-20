"use client";

import * as React from "react";
import Image from "next/image";
import { ImageIcon, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  useDocumentUpload,
  type UploadVisibility,
} from "@/hooks/use-document-upload";
import { useStorageQuota } from "@/lib/upload/storage-quota";
import type { UploadPurpose } from "@/types/api";

interface ImageUploadFieldProps {
  /**
   * The persisted value — a storage object key (the stable reference the
   * backend stores), or empty when no image has been chosen yet. Used for
   * change tracking and the save payload, NOT for rendering.
   */
  value: string;
  /** Called with the new object key, or `""` when the image is removed. */
  onChange: (objectKey: string) => void;
  /**
   * Ready-to-render URL for the already-saved value (e.g. the host
   * record's `pictureUrl` / `signatureUrl`, which the backend resolves
   * from the stored object key on read). Treated as opaque — the
   * component does NOT derive a URL from {@link value} itself. Only used
   * before a fresh upload happens this session.
   */
  previewUrl?: string | null;
  /**
   * Upload destination. Use `"private"` for sensitive assets (signatures,
   * IDs) and `"public"` for embeddable, non-sensitive ones (portraits).
   */
  visibility: UploadVisibility;
  /** Required when `visibility === "public"`. */
  tenantId?: string | null;
  /** Storage purpose bucket. Leave unset to use the backend default. */
  purpose?: UploadPurpose;
  /**
   * Accepted file types for the picker. Defaults to {@link IMAGE_FIELD_ACCEPT}
   * (the backend's image allowlist, SVG excluded).
   */
  accept?: string;
  /**
   * Hard override for the max file size in bytes. Leave unset to use the
   * tenant's live `maxFileSizeMb` from `GET /v1/storage/quota` (falling
   * back to 10 MB until the quota loads). The backend caps both per-file
   * size and total storage, so this is just a friendly pre-flight guard.
   */
  maxSize?: number;
  /** Alt text for the preview image — describe what the image is. */
  alt: string;
  /** Label for the upload button when empty (e.g. "Upload photo"). */
  uploadLabel?: string;
  /** Tooltip copy explaining what choosing a file does. */
  uploadTooltip: string;
  /** Tooltip copy explaining what removing does. */
  removeTooltip: string;
  /** Helper text shown beneath the control. */
  helpText?: string;
  disabled?: boolean;
  /** Associates the trigger with an external <Label htmlFor> for a11y. */
  id?: string;
}

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * MIME allowlist the backend enforces for image-only purposes
 * (host_photo / host_signature) — JPEG/PNG/WebP/GIF/BMP/HEIC/HEIF. SVG is
 * intentionally excluded (stored-XSS risk rendered into an <img>). Used as
 * the default `accept` so the client picker and the server agree; a non-image
 * still gets a 415 server-side, this just keeps it out of the file dialog.
 */
export const IMAGE_FIELD_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,image/bmp,image/heic,image/heif";

/** Bytes → a tidy MB number (one decimal, no trailing ".0"). */
function formatMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, "");
}

/**
 * Image picker that uploads through the unified pipeline and stores the
 * returned object key (not a transient presigned URL). Sensitive images
 * go to the private surface; embeddable ones to the tenant public surface.
 *
 * Preview source (both opaque, ready-to-render URLs — no client-side key
 * resolution):
 *  - right after an upload we hold the response `downloadUrl`, valid
 *    immediately for either surface;
 *  - on reload / edit mode we render the {@link previewUrl} the backend
 *    resolved from the saved object key (host `pictureUrl` / `signatureUrl`).
 *  - if a preview fails to load we fall back to a neutral note rather than
 *    a broken image.
 */
export function ImageUploadField({
  value,
  onChange,
  visibility,
  tenantId,
  purpose,
  previewUrl,
  accept = IMAGE_FIELD_ACCEPT,
  maxSize,
  alt,
  uploadLabel = "Upload image",
  uploadTooltip,
  removeTooltip,
  helpText,
  disabled = false,
  id,
}: ImageUploadFieldProps) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  // Presigned URL captured at upload time — the most reliable preview for
  // both private and public surfaces. Cleared when the value is removed.
  const [freshUrl, setFreshUrl] = React.useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = React.useState(false);
  // Inline pre-flight error (too large / over budget) shown before we even
  // hit the network. Upload-time errors are surfaced by useDocumentUpload.
  const [localError, setLocalError] = React.useState<string | null>(null);

  // `uploadError` carries server-side failures — notably the 415
  // UNSUPPORTED_MEDIA_TYPE the backend returns for a non-image on the
  // host_photo / host_signature purposes. Its message is already
  // user-facing ("Upload a JPEG, PNG, WebP, …").
  const { upload, isUploading, error: uploadError } = useDocumentUpload({
    visibility,
    tenantId,
    purpose,
  });

  // Live per-tenant budget. The backend is authoritative (413/429); this
  // just lets us fail fast with a precise message instead of a raw error
  // after the bytes have already been sent.
  const quota = useStorageQuota();
  const planCapBytes =
    quota.data?.maxFileSizeMb != null
      ? quota.data.maxFileSizeMb * 1024 * 1024
      : undefined;
  const effectiveMaxSize = maxSize ?? planCapBytes ?? DEFAULT_MAX_SIZE;

  // Two 429 cases we can pre-empt with the quota payload we already have.
  const storageFull =
    quota.data?.remainingMb != null && quota.data.remainingMb <= 0;
  const docCapReached =
    quota.data?.maxDocuments != null &&
    quota.data.documentCount >= quota.data.maxDocuments;
  const budgetMessage = storageFull
    ? "Storage is full for this tenant. Free up space or add storage before uploading."
    : docCapReached
      ? "This tenant has reached its document limit. Remove files or upgrade before uploading."
      : null;

  const hasValue = value.trim().length > 0;
  // Prefer the presigned URL captured at upload time; otherwise fall back
  // to the backend-resolved URL for the already-saved value. Both are
  // opaque, ready-to-render URLs — no client-side key resolution.
  const previewSrc = hasValue ? (freshUrl ?? previewUrl ?? null) : null;

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      setLocalError(null);
      if (budgetMessage) {
        setLocalError(budgetMessage);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      if (file.size > effectiveMaxSize) {
        // Fail fast — don't ship bytes the backend will 413 anyway.
        setLocalError(
          `That file is ${formatMb(file.size)} MB. The limit is ${formatMb(
            effectiveMaxSize,
          )} MB.`,
        );
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      const result = await upload(file);
      if (result) {
        setFreshUrl(result.downloadUrl ?? null);
        setPreviewFailed(false);
        onChange(result.objectKey);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleRemove() {
    setFreshUrl(null);
    setPreviewFailed(false);
    setLocalError(null);
    onChange("");
  }

  const uploadBlocked = disabled || isUploading || !!budgetMessage;

  function openPicker() {
    if (!uploadBlocked) fileInputRef.current?.click();
  }

  const showPreviewImage = !!previewSrc && !previewFailed;

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        id={id}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleFile}
        disabled={uploadBlocked}
      />

      <div className="flex items-center gap-3">
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
          {showPreviewImage ? (
            <Image
              src={previewSrc}
              alt={alt}
              fill
              sizes="64px"
              className="object-cover"
              onError={() => setPreviewFailed(true)}
              unoptimized
            />
          ) : (
            <ImageIcon
              className="h-6 w-6 text-muted-foreground"
              aria-hidden="true"
            />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openPicker}
                disabled={uploadBlocked}
                className="min-h-[44px]"
              >
                {isUploading ? (
                  <>
                    <Loader2
                      className="mr-2 h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                    Uploading…
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
                    {hasValue ? "Replace" : uploadLabel}
                  </>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{uploadTooltip}</TooltipContent>
          </Tooltip>

          {hasValue && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemove}
                  disabled={disabled || isUploading}
                  className="min-h-[44px] text-muted-foreground"
                >
                  <X className="mr-1 h-4 w-4" aria-hidden="true" />
                  Remove
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{removeTooltip}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {(localError || uploadError || budgetMessage) && (
        <p className="text-sm text-destructive" role="alert">
          {localError ?? uploadError ?? budgetMessage}
        </p>
      )}
      {previewFailed && hasValue && (
        <p className="text-xs text-muted-foreground">
          Image saved. Preview unavailable — it will show once reloaded.
        </p>
      )}
      {(helpText || !budgetMessage) && (
        <p className="text-xs text-muted-foreground">
          {helpText ? `${helpText} ` : ""}
          {!budgetMessage && `Max ${formatMb(effectiveMaxSize)} MB.`}
        </p>
      )}
    </div>
  );
}
