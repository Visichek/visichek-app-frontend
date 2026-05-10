"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUpdateSystemUser } from "@/features/users/hooks/use-users";
import { useDepartments } from "@/features/departments/hooks/use-departments";
import { BranchPicker } from "@/features/users/components/branch-picker";
import type { SystemUser } from "@/types/user";
import type { SystemUserRole } from "@/types/enums";

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: SystemUser | null;
}

/**
 * Super_admin edit modal. Lets the actor update name, role, department,
 * and the user's branch assignments. Branch updates propagate to every
 * active access token for the target on the server side, so live
 * sessions reflect the new scope without re-login.
 */
export function EditUserDialog({
  open,
  onOpenChange,
  user,
}: EditUserDialogProps) {
  const update = useUpdateSystemUser();
  const departmentsQuery = useDepartments();

  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<SystemUserRole>("receptionist");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [branchIds, setBranchIds] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    setFullName(user.fullName ?? "");
    setRole(user.role);
    setDepartmentId(user.departmentId ?? "");
    setBranchIds(user.branchIds ?? []);
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!fullName.trim()) {
      toast.error("Full name is required");
      return;
    }
    try {
      // Decide whether to forward branchIds. The server treats an
      // explicit `[]` as "reset to [HQ]" — distinct from omitting the
      // field (which leaves the existing list untouched). We pass the
      // current picker value through verbatim once the user has loaded
      // the form, so unticking everything = reset to HQ, not no-op.
      const branchIdsChanged =
        JSON.stringify([...(user.branchIds ?? [])].sort()) !==
        JSON.stringify([...branchIds].sort());

      await update.mutateAsync({
        userId: user.id,
        data: {
          fullName: fullName.trim(),
          role,
          // Server treats "" the same as omitting it. Use undefined to
          // skip rather than wipe a department.
          departmentId: departmentId ? departmentId : undefined,
          // Skip the field unless the user actually changed it.
          branchIds: branchIdsChanged ? branchIds : undefined,
        },
      });
      toast.success("User updated");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update user");
    }
  };

  const isDeptRole = role === "dept_admin" || role === "receptionist";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>
            Update {user?.fullName ?? "this user"}&apos;s role, department, and
            branch assignments. Branch changes apply to live sessions
            without requiring re-login.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="edit-fullName">Full name *</Label>
            <Input
              id="edit-fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="min-h-[44px]"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-role">Role *</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Select
                    value={role}
                    onValueChange={(v) => setRole(v as SystemUserRole)}
                  >
                    <SelectTrigger id="edit-role" className="min-h-[44px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="super_admin">Super Admin</SelectItem>
                      <SelectItem value="dept_admin">Department Admin</SelectItem>
                      <SelectItem value="receptionist">Receptionist</SelectItem>
                      <SelectItem value="auditor">Auditor</SelectItem>
                      <SelectItem value="security_officer">
                        Security Officer
                      </SelectItem>
                      <SelectItem value="dpo">Data Protection Officer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                Changes what this user can see and do across the app.
              </TooltipContent>
            </Tooltip>
          </div>

          {isDeptRole && (
            <div className="space-y-2">
              <Label htmlFor="edit-departmentId">Department</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <SearchableSelect
                      id="edit-departmentId"
                      value={departmentId ? departmentId : "none"}
                      onValueChange={(value) =>
                        setDepartmentId(value === "none" ? "" : value)
                      }
                      placeholder="Select department (optional)"
                      searchPlaceholder="Search departments..."
                      emptyText="No departments match your search"
                      triggerClassName="min-h-[44px]"
                      options={[
                        { value: "none", label: "None" },
                        ...((departmentsQuery.data?.items
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
                  Scope this user to a specific department. Leave empty for tenant-wide access.
                </TooltipContent>
              </Tooltip>
            </div>
          )}

          <BranchPicker value={branchIds} onChange={setBranchIds} />

          <DialogFooter>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="min-h-[44px]"
                >
                  Cancel
                </Button>
              </TooltipTrigger>
              <TooltipContent>Discard changes and close</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="submit"
                  disabled={update.isPending}
                  className="min-h-[44px]"
                >
                  {update.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save changes
                </Button>
              </TooltipTrigger>
              <TooltipContent>Save the user&apos;s updated profile</TooltipContent>
            </Tooltip>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
