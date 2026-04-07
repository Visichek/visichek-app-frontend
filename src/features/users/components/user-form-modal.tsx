"use client";

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
import { useCreateSystemUser } from "@/features/users/hooks/use-users";
import { useDepartments } from "@/features/departments/hooks/use-departments";
import type { SystemUserRole } from "@/types/enums";

const userSchema = z.object({
  full_name: z.string().min(1, "Full name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum([
    "super_admin",
    "dept_admin",
    "receptionist",
    "auditor",
    "security_officer",
    "dpo",
  ] as const),
  department_id: z.string().optional(),
});

type UserFormData = z.infer<typeof userSchema>;

interface UserFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserFormModal({ open, onOpenChange }: UserFormModalProps) {
  const createMutation = useCreateSystemUser();
  const departmentsQuery = useDepartments();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      full_name: "",
      email: "",
      password: "",
      role: "receptionist",
      department_id: "",
    },
  });

  const role = watch("role");
  const departmentId = watch("department_id");

  const onSubmit = async (data: UserFormData) => {
    try {
      await createMutation.mutateAsync({
        full_name: data.full_name,
        email: data.email,
        password: data.password,
        role: data.role as SystemUserRole,
        department_id: data.department_id || undefined,
      });

      toast.success("System user created successfully");
      reset();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create user"
      );
    }
  };

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="Create System User"
      description="Add a new staff member to your organization"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Full Name */}
        <div className="space-y-2">
          <Label htmlFor="full_name">Full Name *</Label>
          <Input
            id="full_name"
            placeholder="Enter user's full name"
            {...register("full_name")}
            aria-invalid={!!errors.full_name}
            aria-describedby={
              errors.full_name ? "error-full_name" : undefined
            }
          />
          {errors.full_name && (
            <p
              id="error-full_name"
              className="text-sm text-destructive"
              role="alert"
            >
              {errors.full_name.message}
            </p>
          )}
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            placeholder="user@example.com"
            {...register("email")}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "error-email" : undefined}
          />
          {errors.email && (
            <p
              id="error-email"
              className="text-sm text-destructive"
              role="alert"
            >
              {errors.email.message}
            </p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-2">
          <Label htmlFor="password">Password *</Label>
          <Input
            id="password"
            type="password"
            placeholder="Minimum 8 characters"
            {...register("password")}
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "error-password" : undefined}
          />
          {errors.password && (
            <p
              id="error-password"
              className="text-sm text-destructive"
              role="alert"
            >
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Role */}
        <div className="space-y-2">
          <Label htmlFor="role">Role *</Label>
          <Select
            value={role}
            onValueChange={(value) => setValue("role", value as SystemUserRole)}
          >
            <SelectTrigger id="role">
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
          {errors.role && (
            <p className="text-sm text-destructive" role="alert">
              {errors.role.message}
            </p>
          )}
        </div>

        {/* Department (optional, relevant for dept_admin and receptionist) */}
        {(role === "dept_admin" || role === "receptionist") && (
          <div className="space-y-2">
            <Label htmlFor="department_id">Department</Label>
            <Select
              value={departmentId}
              onValueChange={(value) => setValue("department_id", value)}
            >
              <SelectTrigger id="department_id">
                <SelectValue placeholder="Select department (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {departmentsQuery.data?.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
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
            isLoading={createMutation.isPending}
            loadingText="Creating..."
            className="w-full md:w-auto"
          >
            Create User
          </LoadingButton>
        </div>
      </form>
    </ResponsiveModal>
  );
}
