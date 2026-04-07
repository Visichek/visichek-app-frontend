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
  useCreateDSR,
  useUpdateDSR,
} from "@/features/dsr/hooks/use-dsr";
import type { DataSubjectRequest } from "@/types/dpo";
import type { DSRType, DSRStatus } from "@/types/enums";

const dsrSchema = z.object({
  requester_name: z.string().min(1, "Requester name is required"),
  requester_email: z.string().email().optional().or(z.literal("")),
  type: z.enum([
    "access",
    "correction",
    "deletion",
    "consent_withdrawal",
  ] as const),
  description: z.string().optional(),
  status: z.enum(["pending", "in_progress", "completed", "rejected"] as const),
});

type DSRFormData = z.infer<typeof dsrSchema>;

interface DSRFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dsr?: DataSubjectRequest;
}

export function DSRFormModal({
  open,
  onOpenChange,
  dsr,
}: DSRFormModalProps) {
  const createMutation = useCreateDSR();
  const updateMutation = useUpdateDSR(dsr?.id || "");
  const isEditing = !!dsr;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<DSRFormData>({
    resolver: zodResolver(dsrSchema),
    defaultValues: {
      requester_name: "",
      requester_email: "",
      type: "access",
      description: "",
      status: "pending",
    },
  });

  const dsrType = watch("type");
  const dsrStatus = watch("status");

  // Populate form with DSR data when editing
  useEffect(() => {
    if (isEditing && dsr && open) {
      setValue("requester_name", dsr.requester_name);
      setValue("requester_email", dsr.requester_email || "");
      setValue("type", dsr.type as DSRType);
      setValue("description", dsr.description || "");
      setValue("status", dsr.status as DSRStatus);
    } else if (open && !isEditing) {
      reset();
    }
  }, [open, dsr, isEditing, setValue, reset]);

  const onSubmit = async (data: DSRFormData) => {
    try {
      if (isEditing && dsr) {
        await updateMutation.mutateAsync({
          status: data.status as DSRStatus,
          description: data.description,
        });
        toast.success("Data subject request updated successfully");
      } else {
        await createMutation.mutateAsync({
          requester_name: data.requester_name,
          requester_email: data.requester_email || undefined,
          type: data.type as DSRType,
          description: data.description,
        });
        toast.success("Data subject request created successfully");
      }
      reset();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to ${isEditing ? "update" : "create"} request`
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
      title={isEditing ? "Edit Data Subject Request" : "Create Data Subject Request"}
      description={
        isEditing
          ? "Update request details"
          : "Register a new data subject request"
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Requester Name */}
        <div className="space-y-2">
          <Label htmlFor="requester_name">Requester Name *</Label>
          <Input
            id="requester_name"
            placeholder="Full name of data subject"
            {...register("requester_name")}
            aria-invalid={!!errors.requester_name}
            aria-describedby={
              errors.requester_name ? "error-requester_name" : undefined
            }
          />
          {errors.requester_name && (
            <p
              id="error-requester_name"
              className="text-sm text-destructive"
              role="alert"
            >
              {errors.requester_name.message}
            </p>
          )}
        </div>

        {/* Requester Email */}
        <div className="space-y-2">
          <Label htmlFor="requester_email">Requester Email</Label>
          <Input
            id="requester_email"
            type="email"
            placeholder="Email address (optional)"
            {...register("requester_email")}
            aria-invalid={!!errors.requester_email}
            aria-describedby={
              errors.requester_email ? "error-requester_email" : undefined
            }
          />
          {errors.requester_email && (
            <p
              id="error-requester_email"
              className="text-sm text-destructive"
              role="alert"
            >
              {errors.requester_email.message}
            </p>
          )}
        </div>

        {/* Type */}
        {!isEditing && (
          <div className="space-y-2">
            <Label htmlFor="type">Request Type *</Label>
            <Select
              value={dsrType}
              onValueChange={(value) => setValue("type", value as DSRType)}
            >
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="access">Right of Access</SelectItem>
                <SelectItem value="correction">Right to Correction</SelectItem>
                <SelectItem value="deletion">Right to Deletion</SelectItem>
                <SelectItem value="consent_withdrawal">
                  Consent Withdrawal
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">Notes</Label>
          <textarea
            id="description"
            placeholder="Additional notes or details (optional)"
            className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            {...register("description")}
          />
        </div>

        {/* Status */}
        {isEditing && (
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={dsrStatus}
              onValueChange={(value) =>
                setValue("status", value as DSRStatus)
              }
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
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
            loadingText={isEditing ? "Updating..." : "Creating..."}
            className="w-full md:w-auto"
          >
            {isEditing ? "Update" : "Create"}
          </LoadingButton>
        </div>
      </form>
    </ResponsiveModal>
  );
}
