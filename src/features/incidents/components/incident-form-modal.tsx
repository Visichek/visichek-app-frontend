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
  useCreateIncident,
  useUpdateIncident,
} from "@/features/incidents/hooks/use-incidents";
import type { Incident } from "@/types/incident";
import type { IncidentType, IncidentStatus } from "@/types/enums";

const incidentSchema = z.object({
  title: z.string().min(1, "Title is required"),
  type: z.enum([
    "data_breach",
    "unauthorized_access",
    "data_export_exposure",
    "device_loss",
    "misconfiguration",
    "third_party",
  ] as const),
  description: z.string().optional(),
  status: z.enum([
    "open",
    "investigating",
    "contained",
    "reported_to_ndpc",
    "closed",
  ] as const),
});

type IncidentFormData = z.infer<typeof incidentSchema>;

interface IncidentFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  incident?: Incident;
}

export function IncidentFormModal({
  open,
  onOpenChange,
  incident,
}: IncidentFormModalProps) {
  const createMutation = useCreateIncident();
  const updateMutation = useUpdateIncident(incident?.id || "");
  const isEditing = !!incident;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<IncidentFormData>({
    resolver: zodResolver(incidentSchema),
    defaultValues: {
      title: "",
      type: "data_breach",
      description: "",
      status: "open",
    },
  });

  const incidentType = watch("type");
  const incidentStatus = watch("status");

  // Populate form with incident data when editing
  useEffect(() => {
    if (isEditing && incident && open) {
      setValue("title", incident.title);
      setValue("type", incident.type as IncidentType);
      setValue("description", incident.description || "");
      setValue("status", incident.status as IncidentStatus);
    } else if (open && !isEditing) {
      reset();
    }
  }, [open, incident, isEditing, setValue, reset]);

  const onSubmit = async (data: IncidentFormData) => {
    try {
      if (isEditing && incident) {
        await updateMutation.mutateAsync({
          title: data.title,
          description: data.description,
          status: data.status as IncidentStatus,
        });
        toast.success("Incident updated successfully");
      } else {
        await createMutation.mutateAsync({
          title: data.title,
          type: data.type as IncidentType,
          description: data.description,
        });
        toast.success("Incident created successfully");
      }
      reset();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to ${isEditing ? "update" : "create"} incident`
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
      title={isEditing ? "Edit Incident" : "Create Incident"}
      description={
        isEditing
          ? "Update incident details"
          : "Report a new security incident"
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            placeholder="Brief incident title"
            {...register("title")}
            aria-invalid={!!errors.title}
            aria-describedby={errors.title ? "error-title" : undefined}
          />
          {errors.title && (
            <p
              id="error-title"
              className="text-sm text-destructive"
              role="alert"
            >
              {errors.title.message}
            </p>
          )}
        </div>

        {/* Type */}
        {!isEditing && (
          <div className="space-y-2">
            <Label htmlFor="type">Incident Type *</Label>
            <Select
              value={incidentType}
              onValueChange={(value) =>
                setValue("type", value as IncidentType)
              }
            >
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="data_breach">Data Breach</SelectItem>
                <SelectItem value="unauthorized_access">
                  Unauthorized Access
                </SelectItem>
                <SelectItem value="data_export_exposure">
                  Data Export Exposure
                </SelectItem>
                <SelectItem value="device_loss">Device Loss</SelectItem>
                <SelectItem value="misconfiguration">
                  Misconfiguration
                </SelectItem>
                <SelectItem value="third_party">Third Party</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <textarea
            id="description"
            placeholder="Detailed incident description (optional)"
            className="flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            {...register("description")}
          />
        </div>

        {/* Status */}
        {isEditing && (
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={incidentStatus}
              onValueChange={(value) =>
                setValue("status", value as IncidentStatus)
              }
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="investigating">Investigating</SelectItem>
                <SelectItem value="contained">Contained</SelectItem>
                <SelectItem value="reported_to_ndpc">
                  Reported to NDPC
                </SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

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
            loadingText={
              isEditing ? "Updating..." : "Creating..."
            }
            className="w-full md:w-auto"
          >
            {isEditing ? "Update" : "Create"}
          </LoadingButton>
        </div>
      </form>
    </ResponsiveModal>
  );
}
