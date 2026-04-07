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
  useCreateBranch,
  useUpdateBranch,
} from "@/features/branches/hooks/use-branches";
import type { Branch } from "@/types/tenant";

const branchSchema = z.object({
  name: z.string().min(1, "Branch name is required"),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
});

type BranchFormData = z.infer<typeof branchSchema>;

interface BranchFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branch?: Branch;
}

export function BranchFormModal({
  open,
  onOpenChange,
  branch,
}: BranchFormModalProps) {
  const createMutation = useCreateBranch();
  const updateMutation = useUpdateBranch();
  const isEditing = !!branch;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<BranchFormData>({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      name: "",
      address: "",
      city: "",
      state: "",
    },
  });

  // Populate form with branch data when editing
  useEffect(() => {
    if (isEditing && branch && open) {
      reset({
        name: branch.name,
        address: branch.address || "",
        city: "",
        state: "",
      });
    } else if (open && !isEditing) {
      reset();
    }
  }, [open, branch, isEditing, reset]);

  const onSubmit = async (data: BranchFormData) => {
    try {
      if (isEditing && branch) {
        await updateMutation.mutateAsync({
          branchId: branch.id,
          data: {
            name: data.name,
            address: data.address,
          },
        });
        toast.success("Branch updated successfully");
      } else {
        await createMutation.mutateAsync({
          name: data.name,
          address: data.address,
        });
        toast.success("Branch created successfully");
      }
      reset();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to ${isEditing ? "update" : "create"} branch`
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
      title={isEditing ? "Edit Branch" : "Create Branch"}
      description={
        isEditing
          ? "Update branch details"
          : "Add a new branch location"
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="name">Branch Name *</Label>
          <Input
            id="name"
            placeholder="e.g., Main Office, Downtown Branch"
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

        {/* Address */}
        <div className="space-y-2">
          <Label htmlFor="address">Address</Label>
          <Input
            id="address"
            placeholder="Street address (optional)"
            {...register("address")}
          />
        </div>

        {/* City and State (side-by-side on desktop) */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              placeholder="City (optional)"
              {...register("city")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">State/Province</Label>
            <Input
              id="state"
              placeholder="State or province (optional)"
              {...register("state")}
            />
          </div>
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
