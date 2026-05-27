"use client";

import { useSession } from "@/hooks/use-session";
import { isBranchScopedRole } from "@/lib/permissions/roles";

/**
 * Decides whether a list/table view should surface a "Branch" label.
 *
 * Phase 4 stamps `branchId` / `branchSummary` onto appointments, visit
 * sessions, and check-ins, and the server already filters branch-scoped
 * roles (dept_admin / receptionist / security_officer) down to their own
 * `branchIds`. So:
 *
 *  - Unscoped tenant roles (super_admin / auditor / dpo) see the whole
 *    tenant and benefit from a Branch column to tell rows apart.
 *  - A branch-scoped user assigned to a SINGLE branch sees only that
 *    branch — every row matches, so the label is noise; hide it.
 *  - A branch-scoped user assigned to MULTIPLE branches sees a mix, so
 *    show the label even though they're "scoped".
 *
 * Platform admins never operate in the tenant shell, so they get `false`.
 */
export function useShowBranch(): boolean {
  const { currentRole, systemUserProfile, isSystemUser } = useSession();
  if (!isSystemUser) return false;
  if (!isBranchScopedRole(currentRole)) return true;
  return (systemUserProfile?.branchIds?.length ?? 0) > 1;
}
