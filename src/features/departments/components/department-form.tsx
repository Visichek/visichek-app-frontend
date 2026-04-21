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
  useCreateDepartment,
  useUpdateDepartment,
} from "@/features/departments/hooks/use-departments";
import type { Department } from "@/types/tenant";

const departmentSchema = z.object({
  name: z.string().trim().min(1, "Department name is required"),
});

type DepartmentFormData = z.infer<typeof departmentSchema>;

interface DepartmentFormProps {
  /** When set, the form is in edit mode. */
  department?: Department;
}

export function DepartmentForm({ department }: DepartmentFormProps) {
  const router = useRouter();
  const { loadingHref, handleNavClick } = useNavigationLoading();
  const createMutation = useCreateDepartment();
  const updateMutation = useUpdateDepartment();
  const isEditing = !!department;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DepartmentFormData>({
    resolver: zodResolver(departmentSchema),
    defaultValues: {
      name: department?.name ?? "",
    },
  });

  const onSubmit = handleSubmit(async (data) => {
    try {
      if (isEditing && department) {
        await updateMutation.mutateAsync({
          departmentId: department.id,
          data: { name: data.name },
        });
        toast.success("Department updated");
      } else {
        await createMutation.mutateAsync({ name: data.name });
        toast.success("Department created");
      }
      router.push("/app/departments");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : `Failed to ${isEditing ? "update" : "create"} department`,
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
                href="/app/departments"
                onClick={() => handleNavClick("/app/departments")}
              >
                {loadingHref === "/app/departments" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                Back to departments
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Return to the departments list without saving
          </TooltipContent>
        </Tooltip>
      </div>

      <PageHeader
        title={isEditing ? "Edit department" : "New department"}
        description={
          isEditing
            ? "Rename this department. Existing assignments stay intact."
            : "Create a new department to organise hosts, receptionists, and visitors."
        }
      />

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="name">Department name *</Label>
          <Input
            id="name"
            placeholder="e.g. Human Resources, Engineering"
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
                  href="/app/departments"
                  onClick={() => handleNavClick("/app/departments")}
                >
                  Cancel
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Discard this draft and return to the departments list
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
                  {isEditing ? "Save changes" : "Create department"}
                </LoadingButton>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              {isEditing
                ? "Save changes and return to the departments list"
                : "Create this department and return to the list"}
            </TooltipContent>
          </Tooltip>
        </div>
      </form>
    </div>
  );
}
