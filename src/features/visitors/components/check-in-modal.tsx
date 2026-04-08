"use client";

import { useEffect } from "react";
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
import { useCheckIn } from "@/features/visitors/hooks/use-visitors";
import { useDepartments } from "@/features/departments/hooks/use-departments";
import type { CheckInMethod } from "@/types/enums";

const checkInSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  company: z.string().optional(),
  departmentId: z.string().min(1, "Department is required"),
  hostId: z.string().optional(),
  purpose: z.string().optional(),
  appointmentId: z.string().optional(),
  phone: z.string().min(1, "Phone number is required"),
  checkInMethod: z.enum([
    "qr_registration",
    "id_scan",
    "manual_entry",
  ] as const),
  consentGranted: z.boolean().optional(),
});

type CheckInFormData = z.infer<typeof checkInSchema>;

interface CheckInModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CheckInModal({ open, onOpenChange }: CheckInModalProps) {
  const checkInMutation = useCheckIn();
  const departmentsQuery = useDepartments();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<CheckInFormData>({
    resolver: zodResolver(checkInSchema),
    defaultValues: {
      checkInMethod: "manual_entry",
      consentGranted: false,
    },
  });

  const checkInMethod = watch("checkInMethod");
  const consentGranted = watch("consentGranted");

  const onSubmit = async (data: CheckInFormData) => {
    try {
      await checkInMutation.mutateAsync({
        fullName: data.fullName,
        company: data.company,
        departmentId: data.departmentId,
        hostId: data.hostId,
        purpose: data.purpose,
        appointmentId: data.appointmentId,
        phone: data.phone,
        checkInMethod: data.checkInMethod as CheckInMethod,
        consentGranted: data.consentGranted,
      });

      toast.success("Visitor registered. Confirm check-in to issue badge.");
      reset();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to check in visitor"
      );
    }
  };

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="Register Visitor"
      description="Register a new visitor entry"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Full Name */}
        <div className="space-y-2">
          <Label htmlFor="fullName">Full Name *</Label>
          <Input
            id="fullName"
            placeholder="Enter visitor's full name"
            {...register("fullName")}
            aria-invalid={!!errors.fullName}
            aria-describedby={errors.fullName ? "error-fullName" : undefined}
          />
          {errors.fullName && (
            <p
              id="error-fullName"
              className="text-sm text-destructive"
              role="alert"
            >
              {errors.fullName.message}
            </p>
          )}
        </div>

        {/* Company */}
        <div className="space-y-2">
          <Label htmlFor="company">Company</Label>
          <Input
            id="company"
            placeholder="Company name (optional)"
            {...register("company")}
          />
        </div>

        {/* Department */}
        <div className="space-y-2">
          <Label htmlFor="departmentId">Department *</Label>
          <Select
            value={watch("departmentId") || ""}
            onValueChange={(value) => setValue("departmentId", value)}
          >
            <SelectTrigger id="departmentId">
              <SelectValue placeholder="Select department" />
            </SelectTrigger>
            <SelectContent>
              {departmentsQuery.data?.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.departmentId && (
            <p className="text-sm text-destructive" role="alert">
              {errors.departmentId.message}
            </p>
          )}
        </div>

        {/* Host ID */}
        <div className="space-y-2">
          <Label htmlFor="hostId">Host ID</Label>
          <Input
            id="hostId"
            placeholder="Host's ID or email (optional)"
            {...register("hostId")}
          />
        </div>

        {/* Purpose */}
        <div className="space-y-2">
          <Label htmlFor="purpose">Purpose</Label>
          <textarea
            id="purpose"
            placeholder="Purpose of visit (optional)"
            className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            {...register("purpose")}
          />
        </div>

        {/* Appointment ID */}
        <div className="space-y-2">
          <Label htmlFor="appointmentId">Appointment ID</Label>
          <Input
            id="appointmentId"
            placeholder="Appointment ID (optional)"
            {...register("appointmentId")}
          />
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <Label htmlFor="phone">Phone *</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="Contact phone"
            {...register("phone")}
            aria-invalid={!!errors.phone}
            aria-describedby={errors.phone ? "error-phone" : undefined}
          />
          {errors.phone && (
            <p
              id="error-phone"
              className="text-sm text-destructive"
              role="alert"
            >
              {errors.phone.message}
            </p>
          )}
        </div>

        {/* Check-in Method */}
        <div className="space-y-2">
          <Label htmlFor="checkInMethod">Check-in Method</Label>
          <Select
            value={checkInMethod}
            onValueChange={(value) =>
              setValue("checkInMethod", value as CheckInMethod)
            }
          >
            <SelectTrigger id="checkInMethod">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="qr_registration">QR Registration</SelectItem>
              <SelectItem value="id_scan">ID Scan</SelectItem>
              <SelectItem value="manual_entry">Manual Entry</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Consent */}
        <div className="flex items-center space-x-2">
          <input
            id="consentGranted"
            type="checkbox"
            className="h-4 w-4 rounded border-input"
            {...register("consentGranted")}
            aria-label="Visitor consent granted"
          />
          <Label htmlFor="consentGranted" className="font-normal">
            Consent granted for processing
          </Label>
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
            isLoading={checkInMutation.isPending}
            loadingText="Registering..."
            className="w-full md:w-auto"
          >
            Register
          </LoadingButton>
        </div>
      </form>
    </ResponsiveModal>
  );
}
