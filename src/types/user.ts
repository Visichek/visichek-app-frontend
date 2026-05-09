import type { SystemUserRole, AccountStatus } from './enums';

/**
 * Compact branch reference embedded on records the FE displays.
 *
 * Phase 4 of the branch-isolation rollout adds `branch_summary` to every
 * branch-bound list response. May be null for branch-scoped users
 * (dept_admin / receptionist / security_officer) since they always
 * operate inside their own branch and the redundant label is suppressed.
 */
export interface BranchSummary {
  id: string;
  name: string;
  isActive?: boolean;
}

/**
 * System User (tenant staff and super admin)
 */
export interface SystemUser {
  id: string;
  tenantId: string;
  fullName: string;
  email: string;
  role: SystemUserRole;
  departmentId?: string;
  /** Branch assignments — every system_user lands on at least one branch (HQ by default). */
  branchIds?: string[];
  /** Optional embedded branch label; populated for unscoped roles in Phase 4. */
  branchSummary?: BranchSummary | null;
  accountStatus?: AccountStatus;
  createdAt: number;
  updatedAt: number;
}

/**
 * System User Invite / Signup Request.
 *
 * `branchIds` is OPTIONAL. If omitted or empty the server defaults to the
 * tenant's Headquarters branch. Sending more than one branch requires a
 * plan whose `max_branches` allows it.
 */
export interface SystemUserSignupRequest {
  departmentId?: string;
  fullName: string;
  email: string;
  password: string;
  role: SystemUserRole;
  branchIds?: string[];
}

/**
 * System User Update Request.
 *
 * `branchIds` REPLACES the existing list (it is not merged). Setting it
 * to an empty array is treated by the server the same as omitting it —
 * the server resolves it back to [HQ] and the user can never end up
 * unscoped.
 */
export interface SystemUserUpdateRequest {
  fullName?: string;
  email?: string;
  role?: SystemUserRole;
  departmentId?: string;
  branchIds?: string[];
}

/**
 * Body for POST /v1/system-users/{user_id}/reset-password (super_admin)
 * and POST /v1/admins/system-users/{user_id}/reset-password (app admin).
 */
export interface ResetUserPasswordRequest {
  newPassword: string;
}

export interface ResetUserPasswordResponse {
  id: string;
  passwordReset: boolean;
}

/**
 * Body for POST /v1/admins/tenants/{tenant_id}/super-admins.
 * App-admin path for adding a super_admin to an EXISTING tenant.
 */
export interface AddTenantSuperAdminRequest {
  fullName: string;
  email: string;
  password: string;
  branchIds?: string[];
}

/**
 * Response from POST /v1/admins/tenants/{tenant_id}/super-admins.
 * Carries access + refresh tokens so the app admin can deliver them
 * out-of-band to the new super admin (per spec — the API does not email).
 */
export interface AddTenantSuperAdminResponse {
  id: string;
  tenantId: string;
  branchIds: string[];
  role: 'super_admin';
  fullName: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  accountStatus: AccountStatus;
}

/**
 * Invite Admin Request
 */
export interface InviteAdminRequest {
  fullName: string;
  email: string;
}

/**
 * Admin Profile
 */
export interface Admin {
  id: string;
  fullName: string;
  email: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Admin Signup Request
 */
export interface AdminSignupRequest {
  fullName: string;
  email: string;
  password: string;
}
