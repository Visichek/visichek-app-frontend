import type { SystemUserRole, AccountStatus } from './enums';
import type { AdminAccessPreset } from './auth';

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
  /**
   * Exactly one super_admin per tenant carries `true`. Every endpoint that
   * mutates a system_user (PATCH, DELETE, bulk delete/deactivate) returns
   * `MAIN_SUPER_ADMIN_LOCKED` when called on the main super_admin row.
   * The role can only be moved via the two-step transfer flow
   * (`/v1/system-users/transfer-main-super-admin/initiate` + verify).
   *
   * The field is absent on responses from older backends — treat missing
   * as `false`. Always guard demote/delete UI by checking strictly
   * `=== true` so legacy rows fall through to the server's authoritative
   * rejection rather than getting silently disabled.
   */
  isMainSuperAdmin?: boolean;
  /**
   * True while the user is holding a server-generated temporary
   * password. The backend blocks every endpoint except change-password
   * for these rows; the FE shows a "Pending password change" badge so
   * the admin list can spot new invites that haven't completed first
   * login yet.
   */
  mustChangePassword?: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * System User Invite / Signup Request.
 *
 * `password` is GONE — the backend generates a temporary password and
 * emails it via the invite welcome template. The new row carries
 * `mustChangePassword=true` and the invitee is forced to change the
 * password on first sign-in.
 *
 * `branchIds` is OPTIONAL. If omitted or empty the server defaults to the
 * tenant's Headquarters branch. Sending more than one branch requires a
 * plan whose `max_branches` allows it.
 */
export interface SystemUserSignupRequest {
  departmentId?: string;
  fullName: string;
  email: string;
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
 * Body for POST /v1/system-users/{user_id}/reset-password (super_admin),
 * POST /v1/admins/system-users/{user_id}/reset-password (app admin), and
 * POST /v1/system-users/bulk/reset-password (super_admin, queued).
 *
 * INTENTIONALLY EMPTY — the backend always generates a temporary
 * password, marks the row `mustChangePassword=true`, revokes every
 * active token for the target, and emails the cleartext via the
 * `password_reset_temp` template. Sending `newPassword` here is now a
 * 422 "extra fields not permitted".
 */
export type ResetUserPasswordRequest = Record<string, never>;

export interface ResetUserPasswordResponse {
  id: string;
  passwordReset: boolean;
}

/**
 * Body for POST /v1/admins/tenants/{tenant_id}/super-admins.
 * App-admin path for adding a super_admin to an EXISTING tenant.
 *
 * `password` is GONE — the backend generates a temporary password and
 * emails it to the new super_admin. The reviewer never sees the
 * cleartext value. Sending `password` here is now a 422 "extra fields
 * not permitted". Same singleton invariant as the bootstrap path:
 * exactly one active super_admin per tenant. To swap the lone
 * super_admin for a different person, hit the `replace` endpoint below.
 */
export interface AddTenantSuperAdminRequest {
  fullName: string;
  email: string;
  branchIds?: string[];
}

/**
 * Response from POST /v1/admins/tenants/{tenant_id}/super-admins.
 *
 * `accessToken` / `refreshToken` are no longer emitted — the welcome
 * email is the only credential carrier. `mustChangePassword=true` is
 * set on the new row so first login routes through the change-password
 * screen.
 */
export interface AddTenantSuperAdminResponse {
  id: string;
  tenantId: string;
  branchIds: string[];
  role: 'super_admin';
  fullName: string;
  email: string;
  accountStatus: AccountStatus;
  mustChangePassword?: boolean;
}

/**
 * Body for POST /v1/admins/tenants/{tenant_id}/super-admins/replace.
 *
 * Atomically swaps the tenant's lone super_admin for a new one — the
 * existing super_admin is deactivated, all their tokens are revoked,
 * the new super_admin is created with a temporary password (emailed
 * via the welcome template), and the audit row records who replaced
 * whom. No `password` field.
 *
 * Errors to surface in the UI:
 *   - 400  "Cannot replace a super admin on an inactive tenant"
 *   - 404  tenant not found
 *   - 409  `SUPER_ADMIN_NONE_TO_REPLACE` — caller should hit the
 *          plain super-admins POST instead
 *   - 409  `MAIN_SUPER_ADMIN_MISSING` — multiple super_admins but none
 *          flagged as main; wait for the 6h backfill or designate one
 *          via the transfer endpoint first
 */
export interface ReplaceTenantSuperAdminRequest {
  fullName: string;
  email: string;
  branchIds?: string[];
}

export interface ReplaceTenantSuperAdminResponse {
  tenantId: string;
  /** The previously-active super_admin row id (now INACTIVE). */
  replacedUserId: string;
  newSuperAdmin: AddTenantSuperAdminResponse;
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
  /**
   * Access preset selected at invite time. Optional for backwards compat
   * with admins provisioned before the preset feature shipped — those
   * resolve to `all_controls` at the UI layer.
   */
  accessPreset?: AdminAccessPreset;
  /**
   * Live permission slice derived from `accessPreset`. The backend's
   * route gate reads the live row, so the FE only uses this for display
   * (e.g., capability badges).
   */
  permissionList?: string[] | null;
  /**
   * Always true for invited admins (2FA is mandatory). Surfaced so the
   * admin list can show a security-posture column.
   */
  mfaEnabled?: boolean;
  /** See `SystemUser.mustChangePassword`. */
  mustChangePassword?: boolean;
}

/**
 * Admin Signup Request.
 *
 * `password` is GONE — the backend generates a temporary password,
 * persists it (hashed) with `mustChangePassword=true` and
 * `mfaEnabled=true`, and emails the cleartext via the `admin_invite`
 * template. Sending `password` here is now a 422 "extra fields not
 * permitted".
 *
 * `accessPreset` is OPTIONAL. The backend defaults to `all_controls`
 * when omitted, preserving the legacy "platform admin can do
 * everything" behavior. Inviters should pass an explicit preset
 * whenever they want to scope the invitee.
 */
export interface AdminSignupRequest {
  fullName: string;
  email: string;
  accessPreset?: AdminAccessPreset;
}

/**
 * Body for POST /v1/system-users/transfer-main-super-admin/initiate.
 *
 * `tenantId` is REQUIRED when the actor is an application admin and
 * OPTIONAL (server resolves from session) when the actor is the current
 * main super_admin of the tenant.
 *
 * The target must:
 *   - currently hold `role === "super_admin"` in the same tenant
 *   - be `ACTIVE`
 *   - not already be the main super_admin
 *
 * Errors (machine codes):
 *   400 TARGET_NOT_SUPER_ADMIN | TARGET_INACTIVE | TARGET_ALREADY_MAIN |
 *       TENANT_ID_REQUIRED
 *   403 AUTH_PERMISSION_DENIED
 *   404 RESOURCE_NOT_FOUND
 */
export interface InitiateTransferMainSuperAdminRequest {
  newMainSuperAdminUserId: string;
  tenantId?: string;
}

export interface InitiateTransferMainSuperAdminResponse {
  otpRequired: true;
  otpChallengeId: string;
  newMainSuperAdminUserId: string;
  tenantId: string;
  message: string;
}

/**
 * Body for POST /v1/system-users/transfer-main-super-admin.
 *
 * `newMainSuperAdminUserId` and `tenantId` MUST match the values returned
 * by the initiate call. The server checks the OTP intent + target before
 * applying the rotation; mismatches return `OTP_TARGET_MISMATCH`.
 *
 * Errors:
 *   400 OTP_WRONG_INTENT | OTP_TARGET_MISMATCH
 *   401 (invalid / expired OTP)
 *   429 (too many OTP attempts — reset by re-initiating)
 */
export interface CompleteTransferMainSuperAdminRequest {
  otpChallengeId: string;
  otpCode: string;
  newMainSuperAdminUserId: string;
  tenantId: string;
}

/**
 * Body for PATCH /v1/admins/{admin_id}/access-preset.
 *
 * Re-scopes an existing admin to a different preset. Backend rejects
 * with 403 if the target is the env-pinned primary admin and the
 * requested preset is anything other than `all_controls`.
 */
export interface UpdateAdminAccessPresetRequest {
  accessPreset: AdminAccessPreset;
}
