"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Download, CheckCircle2, Printer } from "lucide-react";
import { ResponsiveModal } from "@/components/recipes/responsive-modal";
import { LoadingButton } from "@/components/feedback/loading-button";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConfirmCheckIn } from "@/features/visitors/hooks/use-visitors";
import type { BadgeFormat } from "@/types/enums";
import type { ConfirmCheckInResponse } from "@/types/visitor";

const confirmCheckInSchema = z.object({
  badge_format: z.enum(["A6", "A7"] as const).default("A7"),
});

type ConfirmCheckInFormData = z.infer<typeof confirmCheckInSchema>;

interface ConfirmCheckInModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  visitorName: string;
}

// ── Badge Download Utility ──────────────────────────────────────────

function downloadBadgePdf(base64: string, name: string) {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `badge-${name.replace(/\s+/g, "-").toLowerCase()}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function printBadgePdf(base64: string) {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, "_blank");
  if (printWindow) {
    printWindow.addEventListener("load", () => {
      printWindow.print();
    });
  }
  // Clean up after a delay
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

// ── Component ───────────────────────────────────────────────────────

export function ConfirmCheckInModal({
  open,
  onOpenChange,
  sessionId,
  visitorName,
}: ConfirmCheckInModalProps) {
  const confirmCheckInMutation = useConfirmCheckIn();
  const [confirmResult, setConfirmResult] =
    useState<ConfirmCheckInResponse | null>(null);

  const {
    handleSubmit,
    setValue,
    watch,
    reset: resetForm,
    formState: { errors },
  } = useForm<ConfirmCheckInFormData>({
    resolver: zodResolver(confirmCheckInSchema),
    defaultValues: {
      badge_format: "A7",
    },
  });

  const badgeFormat = watch("badge_format");

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
      setConfirmResult(null);
      resetForm();
    }
    onOpenChange(nextOpen);
  }

  const onSubmit = async (data: ConfirmCheckInFormData) => {
    try {
      const response = await confirmCheckInMutation.mutateAsync({
        sessionId,
        badge_format: data.badge_format as BadgeFormat,
      });

      toast.success("Check-in confirmed and badge generated");
      setConfirmResult(response);

      // Auto-download badge
      if (response.badge_pdf_base64) {
        try {
          downloadBadgePdf(response.badge_pdf_base64, visitorName);
        } catch {
          // Download failed silently; user can retry via button
        }
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to confirm check-in"
      );
    }
  };

  // ── Success state with badge actions ──────────────────────────────
  if (confirmResult) {
    return (
      <ResponsiveModal
        open={open}
        onOpenChange={handleClose}
        title="Check-In Confirmed"
        description={`${visitorName} has been checked in successfully.`}
      >
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
            <CheckCircle2
              className="h-7 w-7 text-success"
              aria-hidden="true"
            />
          </div>

          <p className="text-sm text-muted-foreground text-center">
            Badge has been generated. You can download or print it below.
          </p>

          {confirmResult.badge_pdf_base64 && (
            <div className="flex w-full gap-2 flex-col sm:flex-row">
              <Button
                variant="default"
                onClick={() =>
                  downloadBadgePdf(
                    confirmResult.badge_pdf_base64,
                    visitorName
                  )
                }
                className="flex-1 min-h-[44px]"
              >
                <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                Download Badge
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  printBadgePdf(confirmResult.badge_pdf_base64)
                }
                className="flex-1 min-h-[44px]"
              >
                <Printer className="mr-2 h-4 w-4" aria-hidden="true" />
                Print Badge
              </Button>
            </div>
          )}

          <Button
            variant="ghost"
            onClick={() => handleClose(false)}
            className="w-full min-h-[44px]"
          >
            Done
          </Button>
        </div>
      </ResponsiveModal>
    );
  }

  // ── Form state ────────────────────────────────────────────────────
  return (
    <ResponsiveModal
      open={open}
      onOpenChange={handleClose}
      title="Confirm Check-In"
      description={`Confirm check-in for ${visitorName}`}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Badge Format */}
        <div className="space-y-2">
          <Label htmlFor="badge_format">Badge Format</Label>
          <Select
            value={badgeFormat}
            onValueChange={(value) =>
              setValue("badge_format", value as BadgeFormat)
            }
          >
            <SelectTrigger id="badge_format" className="text-base md:text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="A7">A7 — Standard (2.9" x 4.1")</SelectItem>
              <SelectItem value="A6">A6 — Large (4.1" x 5.8")</SelectItem>
            </SelectContent>
          </Select>
          {errors.badge_format && (
            <p className="text-sm text-destructive" role="alert">
              {errors.badge_format.message}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            A badge PDF will be generated and downloaded automatically after
            confirmation.
          </p>
        </div>

        {/* Submit Buttons */}
        <div className="flex w-full gap-2 pt-4 flex-col-reverse sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleClose(false)}
            className="w-full sm:w-auto min-h-[44px]"
          >
            Cancel
          </Button>
          <LoadingButton
            type="submit"
            isLoading={confirmCheckInMutation.isPending}
            loadingText="Confirming..."
            className="w-full sm:w-auto min-h-[44px]"
          >
            Confirm Check-In
          </LoadingButton>
        </div>
      </form>
    </ResponsiveModal>
  );
}
