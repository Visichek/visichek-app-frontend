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
import {
  useCreateAppointment,
  useUpdateAppointment,
} from "@/features/appointments/hooks/use-appointments";
import { useDepartments } from "@/features/departments/hooks/use-departments";
import type { Appointment } from "@/types/visitor";

const appointmentSchema = z.object({
  visitorNameSnapshot: z.string().min(1, "Visitor name is required"),
  hostNameSnapshot: z.string().min(1, "Host name is required"),
  departmentId: z.string().min(1, "Department is required"),
  scheduledDatetime: z.string().min(1, "Date and time is required"),
  purpose: z.string().optional(),
});

type AppointmentFormData = z.infer<typeof appointmentSchema>;

interface AppointmentFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment?: Appointment;
}

export function AppointmentFormModal({
  open,
  onOpenChange,
  appointment,
}: AppointmentFormModalProps) {
  const createMutation = useCreateAppointment();
  const updateMutation = useUpdateAppointment();
  const departmentsQuery = useDepartments();
  const isEditing = !!appointment;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      visitorNameSnapshot: "",
      hostNameSnapshot: "",
      departmentId: "",
      scheduledDatetime: "",
      purpose: "",
    },
  });

  const departmentId = watch("departmentId");

  // Format Unix timestamp to ISO datetime-local format
  const formatTimestampToDatetime = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Populate form with appointment data when editing
  useEffect(() => {
    if (isEditing && appointment && open) {
      setValue(
        "visitorNameSnapshot",
        appointment.visitorNameSnapshot || ""
      );
      setValue("hostNameSnapshot", appointment.hostNameSnapshot || "");
      setValue("departmentId", appointment.departmentId);
      setValue(
        "scheduledDatetime",
        formatTimestampToDatetime(appointment.scheduledDatetime)
      );
      setValue("purpose", appointment.purpose || "");
    } else if (open && !isEditing) {
      reset();
    }
  }, [open, appointment, isEditing, setValue, reset]);

  const onSubmit = async (data: AppointmentFormData) => {
    try {
      const scheduledDatetime = Math.floor(
        new Date(data.scheduledDatetime).getTime() / 1000
      );

      if (isEditing && appointment) {
        await updateMutation.mutateAsync({
          appointmentId: appointment.id,
          data: {
            visitorNameSnapshot: data.visitorNameSnapshot,
            hostNameSnapshot: data.hostNameSnapshot,
            departmentId: data.departmentId,
            scheduledDatetime: scheduledDatetime,
            purpose: data.purpose,
          },
        });
        toast.success("Appointment updated successfully");
      } else {
        await createMutation.mutateAsync({
          visitorNameSnapshot: data.visitorNameSnapshot,
          hostNameSnapshot: data.hostNameSnapshot,
          departmentId: data.departmentId,
          hostId: "", // Note: backend may require this; adjust if needed
          scheduledDatetime: scheduledDatetime,
          purpose: data.purpose,
          tenantId: "", // Will be set by backend
        });
        toast.success("Appointment created successfully");
      }
      reset();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to ${isEditing ? "update" : "create"} appointment`
      );
    }
  };

  const isLoading = isEditing
    ? updateMutation.isPending
    : createMutation.isPending;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? "Edit Appointment" : "Schedule Appointment"}
      description={
        isEditing
          ? "Update appointment details"
          : "Create a new visitor appointment"
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Visitor Name */}
        <div className="space-y-2">
          <Label htmlFor="visitorNameSnapshot">Visitor Name *</Label>
          <Input
            id="visitorNameSnapshot"
            placeholder="Full name of visitor"
            {...register("visitorNameSnapshot")}
            aria-invalid={!!errors.visitorNameSnapshot}
            aria-describedby={
              errors.visitorNameSnapshot
                ? "error-visitorNameSnapshot"
                : undefined
            }
          />
          {errors.visitorNameSnapshot && (
            <p
              id="error-visitorNameSnapshot"
              className="text-sm text-destructive"
              role="alert"
            >
              {errors.visitorNameSnapshot.message}
            </p>
          )}
        </div>

        {/* Host Name */}
        <div className="space-y-2">
          <Label htmlFor="hostNameSnapshot">Host Name *</Label>
          <Input
            id="hostNameSnapshot"
            placeholder="Name of host/employee"
            {...register("hostNameSnapshot")}
            aria-invalid={!!errors.hostNameSnapshot}
            aria-describedby={
              errors.hostNameSnapshot
                ? "error-hostNameSnapshot"
                : undefined
            }
          />
          {errors.hostNameSnapshot && (
            <p
              id="error-hostNameSnapshot"
              className="text-sm text-destructive"
              role="alert"
            >
              {errors.hostNameSnapshot.message}
            </p>
          )}
        </div>

        {/* Department */}
        <div className="space-y-2">
          <Label htmlFor="departmentId">Department *</Label>
          <Select
            value={departmentId}
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

        {/* Scheduled DateTime */}
        <div className="space-y-2">
          <Label htmlFor="scheduledDatetime">
            Scheduled Date & Time *
          </Label>
          <Input
            id="scheduledDatetime"
            type="datetime-local"
            {...register("scheduledDatetime")}
            aria-invalid={!!errors.scheduledDatetime}
            aria-describedby={
              errors.scheduledDatetime
                ? "error-scheduledDatetime"
                : undefined
            }
          />
          {errors.scheduledDatetime && (
            <p
              id="error-scheduledDatetime"
              className="text-sm text-destructive"
              role="alert"
            >
              {errors.scheduledDatetime.message}
            </p>
          )}
        </div>

        {/* Purpose */}
        <div className="space-y-2">
          <Label htmlFor="purpose">Purpose</Label>
          <textarea
            id="purpose"
            placeholder="Purpose of appointment (optional)"
            className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            {...register("purpose")}
          />
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
            isLoading={isLoading}
            loadingText={isEditing ? "Updating..." : "Creating..."}
            className="w-full md:w-auto"
          >
            {isEditing ? "Update" : "Schedule"}
          </LoadingButton>
        </div>
      </form>
    </ResponsiveModal>
  );
}
