"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
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
import { isMainSuperAdminLocked } from "@/types/api";
import type { SystemUser } from "@/types/user";
import type { SystemUserRole } from "@/types/enums";

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: SystemUser | null;
  /**
   * Invoked when the user clicks the "Transfer role first" affordance on
   * a locked main super_admin row. The page mounts the transfer modal in
   * response; the edit dialog stays out of that flow.
   */
  onTransferRequest?: () => void;
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
  onTransferRequest,
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

  const isMain = user?.isMainSuperAdmin === true;
  // For the main super_admin, the server rejects any change to `role`
  // with MAIN_SUPER_ADMIN_LOCKED. Strip the field from the PATCH so the
  // operator can still rename them or move them between departments /
  // branches without tripping the lock; the role picker itself is
  // disabled in the form so a UI change is not possible anyway.
  const roleEditable = !isMain;

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
          // Omit `role` on locked rows so the request never tries to
          // mutate a field the server already protects.
          role: roleEditable ? role : undefined,
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
      // Race-condition fallback: ownership was transferred to this row
      // between page load and submit. Hand control to the transfer flow.
      if (isMainSuperAdminLocked(err)) {
        onOpenChange(false);
        onTransferRequest?.();
        return;
      }
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
          {isMain && (
            <div className="rounded-md border border-amber-400/40 bg-amber-50 px-3 py-2.5 text-sm dark:bg-amber-900/20 dark:border-amber-500/30">
              <p className="flex items-start gap-2 text-amber-900 dark:text-amber-200">
                <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  This row is the organization&apos;s main super admin. Role,
                  account status, and deletion are locked. To demote them,
                  transfer the role first.
                </span>
              </p>
              {onTransferRequest && (
                <div className="mt-2 flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onOpenChange(false);
                      onTransferRequest();
                    }}
                  >
                    Transfer role
                  </Button>
                </div>
              )}
            </div>
          )}
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
                    disabled={!roleEditable}
                  >
                    <SelectTrigger id="edit-role" className="min-h-[44px]" disabled={!roleEditable}>
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
                {roleEditable
                  ? "Changes what this user can see and do across the app."
                  : "The main super admin's role is locked. Transfer the role to another super admin first."}
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
                  Scope this user to a specific department. Leave empty for organization-wide access.
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
