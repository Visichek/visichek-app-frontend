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
  visitor_name_snapshot: z.string().min(1, "Visitor name is required"),
  host_name_snapshot: z.string().min(1, "Host name is required"),
  department_id: z.string().min(1, "Department is required"),
  scheduled_datetime: z.string().min(1, "Date and time is required"),
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
      visitor_name_snapshot: "",
      host_name_snapshot: "",
      department_id: "",
      scheduled_datetime: "",
      purpose: "",
    },
  });

  const departmentId = watch("department_id");

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
        "visitor_name_snapshot",
        appointment.visitor_name_snapshot || ""
      );
      setValue("host_name_snapshot", appointment.host_name_snapshot || "");
      setValue("department_id", appointment.department_id);
      setValue(
        "scheduled_datetime",
        formatTimestampToDatetime(appointment.scheduled_datetime)
      );
      setValue("purpose", appointment.purpose || "");
    } else if (open && !isEditing) {
      reset();
    }
  }, [open, appointment, isEditing, setValue, reset]);

  const onSubmit = async (data: AppointmentFormData) => {
    try {
      const scheduledDatetime = Math.floor(
        new Date(data.scheduled_datetime).getTime() / 1000
      );

      if (isEditing && appointment) {
        await updateMutation.mutateAsync({
          appointmentId: appointment.id,
          data: {
            visitor_name_snapshot: data.visitor_name_snapshot,
            host_name_snapshot: data.host_name_snapshot,
            department_id: data.department_id,
            scheduled_datetime: scheduledDatetime,
            purpose: data.purpose,
          },
        });
        toast.success("Appointment updated successfully");
      } else {
        await createMutation.mutateAsync({
          visitor_name_snapshot: data.visitor_name_snapshot,
          host_name_snapshot: data.host_name_snapshot,
          department_id: data.department_id,
          host_id: "", // Note: backend may require this; adjust if needed
          scheduled_datetime: scheduledDatetime,
          purpose: data.purpose,
          tenant_id: "", // Will be set by backend
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
          <Label htmlFor="visitor_name_snapshot">Visitor Name *</Label>
          <Input
            id="visitor_name_snapshot"
            placeholder="Full name of visitor"
            {...register("visitor_name_snapshot")}
            aria-invalid={!!errors.visitor_name_snapshot}
            aria-describedby={
              errors.visitor_name_snapshot
                ? "error-visitor_name_snapshot"
                : undefined
            }
          />
          {errors.visitor_name_snapshot && (
            <p
              id="error-visitor_name_snapshot"
              className="text-sm text-destructive"
              role="alert"
            >
              {errors.visitor_name_snapshot.message}
            </p>
          )}
        </div>

        {/* Host Name */}
        <div className="space-y-2">
          <Label htmlFor="host_name_snapshot">Host Name *</Label>
          <Input
            id="host_name_snapshot"
            placeholder="Name of host/employee"
            {...register("host_name_snapshot")}
            aria-invalid={!!errors.host_name_snapshot}
            aria-describedby={
              errors.host_name_snapshot
                ? "error-host_name_snapshot"
                : undefined
            }
          />
          {errors.host_name_snapshot && (
            <p
              id="error-host_name_snapshot"
              className="text-sm text-destructive"
              role="alert"
            >
              {errors.host_name_snapshot.message}
            </p>
          )}
        </div>

        {/* Department */}
        <div className="space-y-2">
          <Label htmlFor="department_id">Department *</Label>
          <Select
            value={departmentId}
            onValueChange={(value) => setValue("department_id", value)}
          >
            <SelectTrigger id="department_id">
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
          {errors.department_id && (
            <p className="text-sm text-destructive" role="alert">
              {errors.department_id.message}
            </p>
          )}
        </div>

        {/* Scheduled DateTime */}
        <div className="space-y-2">
          <Label htmlFor="scheduled_datetime">
            Scheduled Date & Time *
          </Label>
          <Input
            id="scheduled_datetime"
            type="datetime-local"
            {...register("scheduled_datetime")}
            aria-invalid={!!errors.scheduled_datetime}
            aria-describedby={
              errors.scheduled_datetime
                ? "error-scheduled_datetime"
                : undefined
            }
          />
          {errors.scheduled_datetime && (
            <p
              id="error-scheduled_datetime"
              className="text-sm text-destructive"
              role="alert"
            >
              {errors.scheduled_datetime.message}
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
