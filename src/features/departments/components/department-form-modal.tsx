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
  useCreateDepartment,
  useUpdateDepartment,
} from "@/features/departments/hooks/use-departments";
import type { Department } from "@/types/tenant";

const departmentSchema = z.object({
  name: z.string().min(1, "Department name is required"),
});

type DepartmentFormData = z.infer<typeof departmentSchema>;

interface DepartmentFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department?: Department;
}

export function DepartmentFormModal({
  open,
  onOpenChange,
  department,
}: DepartmentFormModalProps) {
  const createMutation = useCreateDepartment();
  const updateMutation = useUpdateDepartment();
  const isEditing = !!department;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<DepartmentFormData>({
    resolver: zodResolver(departmentSchema),
    defaultValues: {
      name: "",
    },
  });

  // Populate form with department data when editing
  useEffect(() => {
    if (isEditing && department && open) {
      reset({
        name: department.name,
      });
    } else if (open && !isEditing) {
      reset();
    }
  }, [open, department, isEditing, reset]);

  const onSubmit = async (data: DepartmentFormData) => {
    try {
      if (isEditing && department) {
        await updateMutation.mutateAsync({
          departmentId: department.id,
          data: {
            name: data.name,
          },
        });
        toast.success("Department updated successfully");
      } else {
        await createMutation.mutateAsync({
          name: data.name,
        });
        toast.success("Department created successfully");
      }
      reset();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to ${isEditing ? "update" : "create"} department`
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
      title={isEditing ? "Edit Department" : "Create Department"}
      description={
        isEditing
          ? "Update department name"
          : "Add a new department to your organization"
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="name">Department Name *</Label>
          <Input
            id="name"
            placeholder="e.g., Human Resources, Engineering"
            {...register("name")}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "error-name" : undefined}
          />
          {errors.name && (
            <p
              id="error-name"
              className="text-sm text-destructive"
              role="alert"
            >
              {errors.name.message}
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
