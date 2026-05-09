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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { useCreateSystemUser } from "@/features/users/hooks/use-users";
import { useDepartments } from "@/features/departments/hooks/use-departments";
import { BranchPicker } from "@/features/users/components/branch-picker";
import type { SystemUserRole } from "@/types/enums";

const userSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required"),
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum([
    "super_admin",
    "dept_admin",
    "receptionist",
    "auditor",
    "security_officer",
    "dpo",
  ] as const),
  departmentId: z.string().optional(),
  branchIds: z.array(z.string()).optional(),
});

type UserFormData = z.infer<typeof userSchema>;

export default function NewUserPage() {
  const router = useRouter();
  const { loadingHref, handleNavClick } = useNavigationLoading();
  const createMutation = useCreateSystemUser();
  const departmentsQuery = useDepartments();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      role: "receptionist",
      departmentId: "",
      branchIds: [],
    },
  });

  const role = watch("role");
  const departmentId = watch("departmentId");
  const branchIds = watch("branchIds") ?? [];

  const onSubmit = handleSubmit(async (data) => {
    try {
      await createMutation.mutateAsync({
        fullName: data.fullName,
        email: data.email,
        password: data.password,
        role: data.role as SystemUserRole,
        departmentId: data.departmentId || undefined,
        // Server defaults empty/missing to [HQ]; pass explicit list when set.
        branchIds:
          data.branchIds && data.branchIds.length > 0 ? data.branchIds : undefined,
      });
      toast.success("System user created");
      router.push("/app/users");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create user");
    }
  });

  const submitting = isSubmitting || createMutation.isPending;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" asChild className="min-h-[44px]">
              <Link
                href="/app/users"
                onClick={() => handleNavClick("/app/users")}
              >
                {loadingHref === "/app/users" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                Back to users
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Return to the users list without saving
          </TooltipContent>
        </Tooltip>
      </div>

      <PageHeader
        title="Invite a new user"
        description="Add a new staff member to your organisation and assign their role."
      />

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="fullName">Full name *</Label>
          <Input
            id="fullName"
            placeholder="Enter user's full name"
            {...register("fullName")}
            aria-invalid={!!errors.fullName}
            aria-describedby={errors.fullName ? "error-fullName" : undefined}
            className="min-h-[44px]"
          />
          {errors.fullName && (
            <p id="error-fullName" className="text-sm text-destructive" role="alert">
              {errors.fullName.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            inputMode="email"
            placeholder="user@example.com"
            {...register("email")}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "error-email" : undefined}
            className="min-h-[44px]"
          />
          {errors.email && (
            <p id="error-email" className="text-sm text-destructive" role="alert">
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password *</Label>
          <Input
            id="password"
            type="password"
            placeholder="Minimum 8 characters"
            {...register("password")}
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "error-password" : undefined}
            className="min-h-[44px]"
          />
          {errors.password && (
            <p id="error-password" className="text-sm text-destructive" role="alert">
              {errors.password.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="role">Role *</Label>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Select
                  value={role}
                  onValueChange={(value) => setValue("role", value as SystemUserRole)}
                >
                  <SelectTrigger id="role" className="min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                    <SelectItem value="dept_admin">Department Admin</SelectItem>
                    <SelectItem value="receptionist">Receptionist</SelectItem>
                    <SelectItem value="auditor">Auditor</SelectItem>
                    <SelectItem value="security_officer">Security Officer</SelectItem>
                    <SelectItem value="dpo">Data Protection Officer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top">
              Pick the role that matches this person's responsibilities. It decides what they can see and do.
            </TooltipContent>
          </Tooltip>
          {errors.role && (
            <p className="text-sm text-destructive" role="alert">
              {errors.role.message}
            </p>
          )}
        </div>

        {(role === "dept_admin" || role === "receptionist") && (
          <div className="space-y-2">
            <Label htmlFor="departmentId">Department</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <SearchableSelect
                    id="departmentId"
                    value={departmentId ? departmentId : "none"}
                    onValueChange={(value) =>
                      setValue("departmentId", value === "none" ? "" : value)
                    }
                    placeholder="Select department (optional)"
                    searchPlaceholder="Search departments..."
                    emptyText="No departments match your search"
                    triggerClassName="min-h-[44px]"
                    options={[
                      { value: "none", label: "None" },
                      ...((departmentsQuery.data
                        ?.filter((dept) => !!dept?.id)
                        .map((dept) => ({
                          value: dept.id,
                          label: dept.name,
                        })) ?? []) as { value: string; label: string }[]),
                    ]}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                Scope this user to a specific department. Leave empty to grant access across all departments.
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        <BranchPicker
          value={branchIds}
          onChange={(next) => setValue("branchIds", next)}
        />

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
                  href="/app/users"
                  onClick={() => handleNavClick("/app/users")}
                >
                  Cancel
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Discard this draft and return to the users list
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <LoadingButton
                  type="submit"
                  isLoading={submitting}
                  loadingText="Creating…"
                  className="w-full md:w-auto"
                >
                  Create user
                </LoadingButton>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              Save this user. They'll receive an email with their initial password.
            </TooltipContent>
          </Tooltip>
        </div>
      </form>
    </div>
  );
}
