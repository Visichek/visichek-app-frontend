"use client";

import { useRef, useState } from "react";
import {
  Camera,
  Upload,
  X,
  ScanLine,
  Loader2,
  FileCheck2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LoadingButton } from "@/components/feedback/loading-button";
import { cn } from "@/lib/utils/cn";
import type { IdType } from "@/types/checkin";

/** Upper bound on the ID image file size (backend enforces 16 MiB on the face-crop path). */
const MAX_ID_FILE_BYTES = 16 * 1024 * 1024;

const ID_TYPE_LABELS: Record<IdType, string> = {
  national_id: "National ID",
  drivers_license: "Driver's license",
  passport: "Passport",
};

export interface IdUploadStepProps {
  /** Current selected file (if any). */
  file: File | null;
  /** Setter — parent owns the state so it survives step navigation. */
  onFileChange: (file: File | null) => void;
  /** Current ID type selection. */
  idType: IdType | null;
  onIdTypeChange: (idType: IdType) => void;
  /** Is a submit currently in flight? Used to lock the inputs. */
  submitting?: boolean;
  /** Called when the user wants to continue without an ID file. */
  onContinueWithoutId?: () => void;
  /** Called when the user confirms their ID file and wants to submit. */
  onSubmit?: () => void;
}

/**
 * Kiosk step 2: optional ID upload.
 *
 * Three states:
 *   1. Empty — visitor picks "Take photo", "Upload", or "Continue without ID".
 *   2. File selected — thumbnail preview + ID type picker + submit.
 *   3. Submitting — spinner, controls disabled.
 */
export function IdUploadStep({
  file,
  onFileChange,
  idType,
  onIdTypeChange,
  submitting = false,
  onContinueWithoutId,
  onSubmit,
}: IdUploadStepProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  function handleFile(picked: File | null) {
    setLocalError(null);

    if (!picked) {
      onFileChange(null);
      setPreviewUrl(null);
      return;
    }

    if (picked.size > MAX_ID_FILE_BYTES) {
      setLocalError(
        "That image is over 16 MB. Try a smaller photo or retake it."
      );
      return;
    }

    onFileChange(picked);

    // Revoke any previous preview URL to avoid leaks.
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (picked.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(picked));
    } else {
      setPreviewUrl(null);
    }
  }

  function clearFile() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    onFileChange(null);
    setLocalError(null);
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-display">Verify your identity</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Upload or photograph a government ID so we can verify you
          faster. You can also continue without one — a receptionist
          will check you in manually.
        </p>
      </div>

      {/* State 2: file selected */}
      {file ? (
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-4 flex items-center gap-3">
            {previewUrl ? (
              // Using native <img> because Next's Image needs a configured loader
              // for blob: URLs in public routes. This is a short-lived preview.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Selected ID document"
                className="h-20 w-20 rounded-md object-cover border"
              />
            ) : (
              <div className="h-20 w-20 rounded-md border bg-muted flex items-center justify-center">
                <FileCheck2
                  className="h-8 w-8 text-muted-foreground"
                  aria-hidden="true"
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(1)} MB
              </p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearFile}
                  disabled={submitting}
                  aria-label="Remove selected ID"
                  className="min-h-[44px] min-w-[44px]"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Remove this ID and choose a different one
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="id-type" className="text-sm">
              ID type
              <span className="text-destructive ml-0.5" aria-hidden="true">
                *
              </span>
            </Label>
            <Select
              value={idType ?? ""}
              onValueChange={(v) => onIdTypeChange(v as IdType)}
              disabled={submitting}
            >
              <SelectTrigger
                id="id-type"
                className="text-base md:text-sm min-h-[44px]"
              >
                <SelectValue placeholder="Select an ID type" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ID_TYPE_LABELS) as IdType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {ID_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {localError && (
            <p role="alert" className="text-sm text-destructive">
              {localError}
            </p>
          )}

          <div className="flex flex-col md:flex-row gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex-1">
                  <LoadingButton
                    onClick={onSubmit}
                    disabled={!idType || submitting}
                    isLoading={submitting}
                    loadingText="Verifying your ID…"
                    className="w-full"
                  >
                    <ScanLine
                      className="mr-2 h-4 w-4"
                      aria-hidden="true"
                    />
                    Submit and verify
                  </LoadingButton>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                Submit your check-in and verify your identity using the
                uploaded ID
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      ) : (
        /* State 1: empty */
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="min-h-[88px] flex-col gap-2"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={submitting}
                >
                  <Camera className="h-6 w-6" aria-hidden="true" />
                  Take a photo
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Use your device camera to photograph your ID right now
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="min-h-[88px] flex-col gap-2"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={submitting}
                >
                  <Upload className="h-6 w-6" aria-hidden="true" />
                  Upload from device
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Choose a saved photo or PDF of your ID from this device
              </TooltipContent>
            </Tooltip>
          </div>

          {localError && (
            <p role="alert" className="text-sm text-destructive">
              {localError}
            </p>
          )}

          {onContinueWithoutId && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  onClick={onContinueWithoutId}
                  disabled={submitting}
                  className="w-full min-h-[44px]"
                >
                  Continue without an ID
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                Skip ID verification — a receptionist will verify your
                identity manually after you submit
              </TooltipContent>
            </Tooltip>
          )}

          {/* Hidden file inputs */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/bmp,application/pdf"
            className="sr-only"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
        </div>
      )}

      {submitting && (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            "flex items-center gap-2 text-sm text-muted-foreground"
          )}
        >
          <Loader2
            className="h-4 w-4 animate-spin"
            aria-hidden="true"
          />
          Running OCR and face detection…
        </div>
      )}
    </div>
  );
}
