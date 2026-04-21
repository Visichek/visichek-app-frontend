"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
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
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import {
  useCreateBranch,
  useUpdateBranch,
} from "@/features/branches/hooks/use-branches";
import type { Branch } from "@/types/tenant";

const branchSchema = z.object({
  name: z.string().trim().min(1, "Branch name is required"),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
});

type BranchFormData = z.infer<typeof branchSchema>;

interface BranchFormProps {
  /** When set, the form is in edit mode. */
  branch?: Branch;
}

export function BranchForm({ branch }: BranchFormProps) {
  const router = useRouter();
  const { loadingHref, handleNavClick } = useNavigationLoading();
  const createMutation = useCreateBranch();
  const updateMutation = useUpdateBranch();
  const isEditing = !!branch;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BranchFormData>({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      name: branch?.name ?? "",
      address: branch?.address ?? "",
      city: branch?.city ?? "",
      state: branch?.state ?? "",
    },
  });

  const onSubmit = handleSubmit(async (data) => {
    const payload = {
      name: data.name,
      address: data.address || undefined,
      city: data.city || undefined,
      state: data.state || undefined,
    };

    try {
      if (isEditing && branch) {
        await updateMutation.mutateAsync({
          branchId: branch.id,
          data: payload,
        });
        toast.success("Branch updated");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Branch created");
      }
      router.push("/app/branches");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : `Failed to ${isEditing ? "update" : "create"} branch`,
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
                href="/app/branches"
                onClick={() => handleNavClick("/app/branches")}
              >
                {loadingHref === "/app/branches" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                Back to branches
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Return to the branches list without saving
          </TooltipContent>
        </Tooltip>
      </div>

      <PageHeader
        title={isEditing ? "Edit branch" : "New branch"}
        description={
          isEditing
            ? "Update this office location's details. Existing assignments stay intact."
            : "Add a new physical office location for staff and visitors."
        }
      />

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="name">Branch name *</Label>
          <Input
            id="name"
            placeholder="e.g. Main Office, Downtown Branch"
            {...register("name")}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "error-name" : undefined}
            className="min-h-[44px]"
          />
          {errors.name && (
            <p id="error-name" className="text-sm text-destructive" role="alert">
              {errors.name.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">Street address</Label>
          <Input
            id="address"
            placeholder="Street address (optional)"
            {...register("address")}
            className="min-h-[44px]"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              placeholder="City (optional)"
              {...register("city")}
              className="min-h-[44px]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">State / Province</Label>
            <Input
              id="state"
              placeholder="State or province (optional)"
              {...register("state")}
              className="min-h-[44px]"
            />
          </div>
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
                  href="/app/branches"
                  onClick={() => handleNavClick("/app/branches")}
                >
                  Cancel
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Discard this draft and return to the branches list
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <LoadingButton
                  type="submit"
                  isLoading={submitting}
                  loadingText={isEditing ? "Saving…" : "Creating…"}
                  className="w-full md:w-auto"
                >
                  {isEditing ? "Save changes" : "Create branch"}
                </LoadingButton>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              {isEditing
                ? "Save changes and return to the branches list"
                : "Create this branch and return to the list"}
            </TooltipContent>
          </Tooltip>
        </div>
      </form>
    </div>
  );
}
