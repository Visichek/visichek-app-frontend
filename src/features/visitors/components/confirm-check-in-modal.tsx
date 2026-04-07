"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { ResponsiveModal } from "@/components/recipes/responsive-modal";
import { LoadingButton } from "@/components/feedback/loading-button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useConfirmCheckIn } from "@/features/visitors/hooks/use-visitors";
import type { BadgeFormat } from "@/types/enums";

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

export function ConfirmCheckInModal({
  open,
  onOpenChange,
  sessionId,
  visitorName,
}: ConfirmCheckInModalProps) {
  const confirmCheckInMutation = useConfirmCheckIn();

  const {
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ConfirmCheckInFormData>({
    resolver: zodResolver(confirmCheckInSchema),
    defaultValues: {
      badge_format: "A7",
    },
  });

  const badgeFormat = watch("badge_format");

  const onSubmit = async (data: ConfirmCheckInFormData) => {
    try {
      const response = await confirmCheckInMutation.mutateAsync({
        sessionId,
        badge_format: data.badge_format as BadgeFormat,
      });

      toast.success("Check-in confirmed and badge generated");

      // Trigger badge download if PDF is available
      if (response.badge_pdf_base64) {
        downloadBadge(response.badge_pdf_base64, visitorName);
      }

      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to confirm check-in"
      );
    }
  };

  const downloadBadge = (base64: string, name: string) => {
    try {
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
    } catch (error) {
      toast.error("Failed to download badge");
    }
  };

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="Confirm Check-In"
      description={`Confirm check-in for ${visitorName}`}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Badge Format */}
        <div className="space-y-2">
          <Label htmlFor="badge_format">Badge Format *</Label>
          <Select
            value={badgeFormat}
            onValueChange={(value) =>
              setValue("badge_format", value as BadgeFormat)
            }
          >
            <SelectTrigger id="badge_format">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="A6">A6 (4.1" x 5.8")</SelectItem>
              <SelectItem value="A7">A7 (2.9" x 4.1")</SelectItem>
            </SelectContent>
          </Select>
          {errors.badge_format && (
            <p className="text-sm text-destructive" role="alert">
              {errors.badge_format.message}
            </p>
          )}
        </div>

        {/* Submit Button */}
        <div className="flex w-full gap-2 pt-4 md:justify-end">
          <LoadingButton
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full md:w-auto"
          >
            Cancel
          </LoadingButton>
          <LoadingButton
            type="submit"
            isLoading={confirmCheckInMutation.isPending}
            loadingText="Confirming..."
            className="w-full md:w-auto"
          >
            Confirm Check-In
          </LoadingButton>
        </div>
      </form>
    </ResponsiveModal>
  );
}
