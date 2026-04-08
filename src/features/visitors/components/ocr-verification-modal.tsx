"use client";

import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  ScanLine,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileImage,
  X,
} from "lucide-react";
import { ResponsiveModal } from "@/components/recipes/responsive-modal";
import { LoadingButton } from "@/components/feedback/loading-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useVerifyIdScan,
  useApplyIdScan,
} from "@/features/visitors/hooks/use-visitors";

// ── Schema ──────────────────────────────────────────────────────────

const applySchema = z.object({
  id_type: z.string().min(1, "ID type is required"),
  id_number: z.string().min(1, "ID number is required"),
});

type ApplyFormValues = z.infer<typeof applySchema>;

type Step = "upload" | "review" | "success";

const ID_TYPES = [
  { value: "national_id", label: "National ID Card" },
  { value: "passport", label: "International Passport" },
  { value: "drivers_license", label: "Driver's License" },
  { value: "voters_card", label: "Voter's Card" },
  { value: "nin_slip", label: "NIN Slip" },
  { value: "other", label: "Other" },
];

// ── Props ───────────────────────────────────────────────────────────

interface OcrVerificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  visitorName: string;
}

export function OcrVerificationModal({
  open,
  onOpenChange,
  sessionId,
  visitorName,
}: OcrVerificationModalProps) {
  const verifyIdScanMutation = useVerifyIdScan();
  const applyIdScanMutation = useApplyIdScan();

  const [step, setStep] = useState<Step>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extractedFields, setExtractedFields] = useState<Record<string, unknown> | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset: resetForm,
    formState: { errors },
  } = useForm<ApplyFormValues>({
    resolver: zodResolver(applySchema),
    defaultValues: {
      id_type: "",
      id_number: "",
    },
  });

  function resetState() {
    setStep("upload");
    setSelectedFile(null);
    setPreviewUrl(null);
    setExtractedFields(null);
    setUploadError(null);
    resetForm();
  }

  function handleClose(open: boolean) {
    if (!open) resetState();
    onOpenChange(open);
  }

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!validTypes.includes(file.type)) {
      setUploadError("Please upload a JPEG, PNG, WebP, or PDF file.");
      return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("File size must be under 10MB.");
      return;
    }

    setUploadError(null);
    setSelectedFile(file);

    // Create preview for images
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  }

  function removeFile() {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleScanUpload() {
    if (!selectedFile) return;

    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const result = await verifyIdScanMutation.mutateAsync(formData);

      setExtractedFields(result);

      // Pre-fill form with extracted fields if available
      if (result.id_type && typeof result.id_type === "string") {
        setValue("id_type", result.id_type);
      }
      if (result.id_number && typeof result.id_number === "string") {
        setValue("id_number", result.id_number);
      }

      setStep("review");
    } catch (err) {
      setUploadError(
        err instanceof Error
          ? err.message
          : "Failed to process ID document. Please try again."
      );
    }
  }

  async function onApply(values: ApplyFormValues) {
    try {
      await applyIdScanMutation.mutateAsync({
        sessionId,
        id_type: values.id_type,
        id_number: values.id_number,
      });

      setStep("success");
      toast.success("ID verification applied successfully");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to apply ID scan results"
      );
    }
  }

  // ── Upload Step ───────────────────────────────────────────────────
  if (step === "upload") {
    return (
      <ResponsiveModal
        open={open}
        onOpenChange={handleClose}
        title="Scan ID Document"
        description={`Upload an ID document for ${visitorName} to verify their identity.`}
      >
        <div className="space-y-4">
          {uploadError && (
            <div
              className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
              role="alert"
            >
              <AlertCircle
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <span>{uploadError}</span>
            </div>
          )}

          {!selectedFile ? (
            <label
              htmlFor="id-document-upload"
              className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 cursor-pointer hover:border-muted-foreground/50 transition-colors"
            >
              <Upload className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
              <div className="text-center">
                <p className="text-sm font-medium">
                  Upload ID document
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  JPEG, PNG, WebP, or PDF up to 10MB
                </p>
              </div>
              <input
                ref={fileInputRef}
                id="id-document-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="sr-only"
                onChange={handleFileSelect}
              />
            </label>
          ) : (
            <div className="space-y-3">
              {previewUrl && (
                <div className="relative rounded-lg overflow-hidden border bg-muted">
                  <img
                    src={previewUrl}
                    alt="ID document preview"
                    className="w-full max-h-48 object-contain"
                  />
                </div>
              )}
              <div className="flex items-center justify-between rounded-md border p-3">
                <div className="flex items-center gap-2 min-w-0">
                  <FileImage className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="text-sm truncate">{selectedFile.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    ({(selectedFile.size / 1024).toFixed(0)} KB)
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={removeFile}
                  className="h-8 w-8 p-0 shrink-0"
                  aria-label="Remove file"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <LoadingButton
              onClick={handleScanUpload}
              isLoading={verifyIdScanMutation.isPending}
              loadingText="Scanning..."
              disabled={!selectedFile}
              className="flex-1 min-h-[44px]"
            >
              <ScanLine className="mr-2 h-4 w-4" aria-hidden="true" />
              Scan Document
            </LoadingButton>
            <Button
              variant="outline"
              onClick={() => handleClose(false)}
              className="min-h-[44px]"
            >
              Cancel
            </Button>
          </div>
        </div>
      </ResponsiveModal>
    );
  }

  // ── Review Step ───────────────────────────────────────────────────
  if (step === "review") {
    return (
      <ResponsiveModal
        open={open}
        onOpenChange={handleClose}
        title="Review Extracted Data"
        description="Verify the information extracted from the ID document before applying."
      >
        <form onSubmit={handleSubmit(onApply)} className="space-y-4">
          {/* Extracted raw fields display */}
          {extractedFields && Object.keys(extractedFields).length > 0 && (
            <div className="space-y-2 rounded-md bg-muted p-3 text-sm">
              <p className="font-medium text-xs text-muted-foreground uppercase tracking-wider">
                Extracted Fields
              </p>
              {Object.entries(extractedFields).map(([key, value]) => (
                <div key={key} className="flex justify-between gap-2">
                  <span className="text-muted-foreground capitalize">
                    {key.replace(/_/g, " ")}
                  </span>
                  <span className="font-medium text-right max-w-[60%] truncate">
                    {String(value ?? "—")}
                  </span>
                </div>
              ))}
            </div>
          )}

          <Separator />

          {/* Editable fields to apply */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ocr_id_type" className="text-xs">
                ID Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={watch("id_type") || ""}
                onValueChange={(v) => setValue("id_type", v)}
              >
                <SelectTrigger
                  id="ocr_id_type"
                  className="text-base md:text-sm"
                >
                  <SelectValue placeholder="Select ID type" />
                </SelectTrigger>
                <SelectContent>
                  {ID_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.id_type && (
                <p className="text-sm text-destructive">
                  {errors.id_type.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ocr_id_number" className="text-xs">
                ID Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="ocr_id_number"
                className="h-9 text-base md:text-sm"
                placeholder="Enter or verify ID number"
                {...register("id_number")}
              />
              {errors.id_number && (
                <p className="text-sm text-destructive">
                  {errors.id_number.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <LoadingButton
              type="submit"
              isLoading={applyIdScanMutation.isPending}
              loadingText="Applying..."
              className="flex-1 min-h-[44px]"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />
              Apply Verification
            </LoadingButton>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setStep("upload");
                resetForm();
              }}
              className="min-h-[44px]"
            >
              Re-scan
            </Button>
          </div>
        </form>
      </ResponsiveModal>
    );
  }

  // ── Success Step ──────────────────────────────────────────────────
  return (
    <ResponsiveModal
      open={open}
      onOpenChange={handleClose}
      title="Verification Applied"
      description="The ID scan results have been applied to this session."
    >
      <div className="flex flex-col items-center gap-4 py-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2
            className="h-8 w-8 text-success"
            aria-hidden="true"
          />
        </div>
        <p className="text-sm text-muted-foreground text-center">
          ID verification for <span className="font-medium text-foreground">{visitorName}</span> has
          been recorded. You can now proceed with check-in confirmation.
        </p>
        <Button
          onClick={() => handleClose(false)}
          className="w-full min-h-[44px]"
        >
          Done
        </Button>
      </div>
    </ResponsiveModal>
  );
}
