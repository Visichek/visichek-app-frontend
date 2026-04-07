"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ResponsiveModal } from "@/components/recipes/responsive-modal";
import { LoadingButton } from "@/components/feedback/loading-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCheckOut } from "@/features/visitors/hooks/use-visitors";
import type { CheckOutMethod } from "@/types/enums";

const checkOutSchema = z.object({
  identifier: z.string().min(1, "Session ID or badge token is required"),
  check_out_method: z.enum(["qr_scan", "manual"] as const),
});

type CheckOutFormData = z.infer<typeof checkOutSchema>;

interface CheckOutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CheckOutModal({ open, onOpenChange }: CheckOutModalProps) {
  const checkOutMutation = useCheckOut();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<CheckOutFormData>({
    resolver: zodResolver(checkOutSchema),
    defaultValues: {
      check_out_method: "manual",
    },
  });

  const checkOutMethod = watch("check_out_method");

  const onSubmit = async (data: CheckOutFormData) => {
    try {
      await checkOutMutation.mutateAsync({
        ...(checkOutMethod === "qr_scan"
          ? { badge_qr_token: data.identifier }
          : { session_id: data.identifier }),
        check_out_method: checkOutMethod as CheckOutMethod,
      });

      toast.success("Visitor checked out successfully");
      reset();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to check out visitor"
      );
    }
  };

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="Check Out Visitor"
      description="Record visitor departure"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Check-out Method */}
        <div className="space-y-2">
          <Label htmlFor="check_out_method">Check-out Method</Label>
          <Select
            value={checkOutMethod}
            onValueChange={(value) =>
              setValue("check_out_method", value as CheckOutMethod)
            }
          >
            <SelectTrigger id="check_out_method">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="qr_scan">QR Scan</SelectItem>
              <SelectItem value="manual">Manual Entry</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Identifier */}
        <div className="space-y-2">
          <Label htmlFor="identifier">
            {checkOutMethod === "qr_scan" ? "Badge QR Token" : "Session ID"} *
          </Label>
          <Input
            id="identifier"
            placeholder={
              checkOutMethod === "qr_scan"
                ? "Scan badge QR code"
                : "Enter session ID"
            }
            {...register("identifier")}
            aria-invalid={!!errors.identifier}
            aria-describedby={
              errors.identifier ? "error-identifier" : undefined
            }
          />
          {errors.identifier && (
            <p
              id="error-identifier"
              className="text-sm text-destructive"
              role="alert"
            >
              {errors.identifier.message}
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
            isLoading={checkOutMutation.isPending}
            loadingText="Checking out..."
            className="w-full md:w-auto"
          >
            Check Out
          </LoadingButton>
        </div>
      </form>
    </ResponsiveModal>
  );
}
