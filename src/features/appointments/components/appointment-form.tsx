"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/recipes/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/feedback/loading-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import {
  useCreateAppointment,
  useUpdateAppointment,
} from "@/features/appointments/hooks/use-appointments";
import { useDepartments } from "@/features/departments/hooks/use-departments";
import type { Appointment } from "@/types/visitor";

const appointmentSchema = z.object({
  visitorNameSnapshot: z.string().trim().min(1, "Visitor name is required"),
  hostNameSnapshot: z.string().trim().min(1, "Host name is required"),
  departmentId: z.string().trim().min(1, "Department is required"),
  scheduledDatetime: z.string().min(1, "Date and time is required"),
  purpose: z.string().optional(),
});

type AppointmentFormData = z.infer<typeof appointmentSchema>;

interface AppointmentFormProps {
  /** When set, the form is in edit mode. */
  appointment?: Appointment;
}

function formatTimestampToDatetime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function AppointmentForm({ appointment }: AppointmentFormProps) {
  const router = useRouter();
  const { loadingHref, handleNavClick } = useNavigationLoading();
  const createMutation = useCreateAppointment();
  const updateMutation = useUpdateAppointment();
  const departmentsQuery = useDepartments();
  const isEditing = !!appointment;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      visitorNameSnapshot: appointment?.visitorNameSnapshot ?? "",
      hostNameSnapshot: appointment?.hostNameSnapshot ?? "",
      departmentId: appointment?.departmentId ?? "",
      scheduledDatetime: appointment
        ? formatTimestampToDatetime(appointment.scheduledDatetime)
        : "",
      purpose: appointment?.purpose ?? "",
    },
  });

  const onSubmit = handleSubmit(async (data) => {
    const scheduledDatetime = Math.floor(
      new Date(data.scheduledDatetime).getTime() / 1000,
    );

    try {
      if (isEditing && appointment) {
        await updateMutation.mutateAsync({
          appointmentId: appointment.id,
          data: {
            visitorNameSnapshot: data.visitorNameSnapshot,
            hostNameSnapshot: data.hostNameSnapshot,
            departmentId: data.departmentId,
            scheduledDatetime,
            purpose: data.purpose,
          },
        });
        toast.success("Appointment updated");
      } else {
        await createMutation.mutateAsync({
          visitorNameSnapshot: data.visitorNameSnapshot,
          hostNameSnapshot: data.hostNameSnapshot,
          departmentId: data.departmentId,
          hostId: "", // Backend assigns if empty
          scheduledDatetime,
          purpose: data.purpose,
          tenantId: "", // Backend fills from session
        });
        toast.success("Appointment created");
      }
      router.push("/app/appointments");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : `Failed to ${isEditing ? "update" : "create"} appointment`,
      );
    }
  });

  const submitting =
    isSubmitting || createMutation.isPending || updateMutation.isPending;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" asChild className="min-h-[44px]">
              <Link
                href="/app/appointments"
                onClick={() => handleNavClick("/app/appointments")}
              >
                {loadingHref === "/app/appointments" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                Back to appointments
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Return to the appointments list without saving
          </TooltipContent>
        </Tooltip>
      </div>

      <PageHeader
        title={isEditing ? "Edit appointment" : "New appointment"}
        description={
          isEditing
            ? "Update this appointment's details."
            : "Schedule a future appointment for a visitor with a host."
        }
      />

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="visitorNameSnapshot">Visitor name *</Label>
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
            className="min-h-[44px]"
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

        <div className="space-y-2">
          <Label htmlFor="hostNameSnapshot">Host name *</Label>
          <Input
            id="hostNameSnapshot"
            placeholder="Name of host or employee"
            {...register("hostNameSnapshot")}
            aria-invalid={!!errors.hostNameSnapshot}
            aria-describedby={
              errors.hostNameSnapshot ? "error-hostNameSnapshot" : undefined
            }
            className="min-h-[44px]"
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

        <div className="space-y-2">
          <Label htmlFor="departmentId">Department *</Label>
          <Controller
            name="departmentId"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="departmentId" className="min-h-[44px]">
                  <SelectValue placeholder="Select a department" />
                </SelectTrigger>
                <SelectContent>
                  {departmentsQuery.data
                    ?.filter((dept) => !!dept?.id)
                    .map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.departmentId && (
            <p className="text-sm text-destructive" role="alert">
              {errors.departmentId.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="scheduledDatetime">Scheduled date &amp; time *</Label>
          <Input
            id="scheduledDatetime"
            type="datetime-local"
            {...register("scheduledDatetime")}
            aria-invalid={!!errors.scheduledDatetime}
            aria-describedby={
              errors.scheduledDatetime ? "error-scheduledDatetime" : undefined
            }
            className="min-h-[44px]"
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

        <div className="space-y-2">
          <Label htmlFor="purpose">Purpose</Label>
          <textarea
            id="purpose"
            placeholder="Purpose of appointment (optional)"
            className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            {...register("purpose")}
          />
        </div>

        <div className="flex flex-col gap-2 pt-2 md:flex-row md:justify-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                asChild
                disabled={submitting}
                className="w-full min-h-[44px] md:w-auto"
              >
                <Link
                  href="/app/appointments"
                  onClick={() => handleNavClick("/app/appointments")}
                >
                  Cancel
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Discard this draft and return to the appointments list
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <LoadingButton
                  type="submit"
                  isLoading={submitting}
                  loadingText={isEditing ? "Saving…" : "Scheduling…"}
                  className="w-full md:w-auto"
                >
                  {isEditing ? "Save changes" : "Schedule appointment"}
                </LoadingButton>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              {isEditing
                ? "Save changes and return to the appointments list"
                : "Schedule this appointment and return to the list"}
            </TooltipContent>
          </Tooltip>
        </div>
      </form>
    </div>
  );
}
