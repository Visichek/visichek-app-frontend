import type { SystemUserRole, AccountStatus } from "./enums";

// ── Login Payloads ────────────────────────────────────────────────────
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

// ── Forgot / Reset Password ──────────────────────────────────────────
//
// The forgot/reset endpoints are unified across admin + system_user. The
// server decides which kind of account the email belongs to and dispatches
// the matching reset email. We never reveal whether the email exists — a
// 202 is returned even for unknown addresses.

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  requested: true;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface ResetPasswordResponse {
  reset: true;
}

// ── Token Shapes ──────────────────────────────────────────────────────
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// ── Session Types ─────────────────────────────────────────────────────
export type SessionType = "admin" | "system_user";

/**
 * Platform-admin access preset (Issue 10).
 *
 * The application admin role used to be all-or-nothing — every admin
 * had every permission. Presets let the business delegate slices of
 * the work (content, support, billing, or a combination) without
 * handing out tenant/subscription control.
 *
 * The presets are enforced server-side by the matching backend
 * permission dependency; this enum is the UI half that filters the
 * admin sidebar, command launcher, route guards, and page action
 * buttons. Until the backend ships, the field is optional and the
 * frontend treats `undefined` as `all_controls` for backwards compat.
 */
export type AdminAccessPreset =
  | "content_only"
  | "support_only"
  | "content_support"
  | "billing_only"
  | "all_controls";

export interface AdminProfile {
  id: string;
  fullName: string;
  email: string;
  mfaEnabled?: boolean;
  /**
   * Access preset selected at invite time. Optional for backwards
   * compatibility with admins provisioned before the preset feature
   * shipped — those default to `all_controls` at the UI layer.
   */
  accessPreset?: AdminAccessPreset;
  /**
   * True when the admin is holding a server-generated temporary
   * password (after invite / authority reset). While set, every
   * endpoint EXCEPT the change-password ones returns 403
   * AUTH_PERMISSION_DENIED with `details.code = "PASSWORD_CHANGE_REQUIRED"`.
   * The frontend routes the user into the change-password screen and
   * disables global navigation until they submit a real password.
   */
  mustChangePassword?: boolean;
}

export interface SystemUserProfile {
  id: string;
  fullName: string;
  email: string;
  role: SystemUserRole;
  tenantId: string;
  departmentId?: string;
  /**
   * Branch assignments synced onto the access token. Branch-scoped roles
   * (dept_admin / receptionist / security_officer) only see data from
   * these branches; unscoped roles (super_admin / auditor / dpo) see
   * everything in the tenant.
   */
  branchIds?: string[];
  mfaEnabled?: boolean;
  mfaLockedByAdmin?: boolean;
  /** See {@link AdminProfile.mustChangePassword}. */
  mustChangePassword?: boolean;
}

export interface AdminSession {
  type: "admin";
  tokens: TokenPair;
  profile: AdminProfile;
}

export interface SystemUserSession {
  type: "system_user";
  tokens: TokenPair;
  profile: SystemUserProfile;
}

export type Session = AdminSession | SystemUserSession;

// ── Backend Login Responses (after envelope unwrap) ───────────────────

/**
 * Flat response from `POST /v1/system-users/tenant/{tenantId}/login`
 * and `POST /v1/system-users/login`.
 * Tokens are embedded directly on the user object.
 */
export interface SystemUserLoginResponse {
  id: string;
  tenantId: string;
  departmentId?: string;
  fullName: string;
  email: string;
  role: SystemUserRole;
  accountStatus: AccountStatus;
  isActive: boolean;
  lastLoginAt: number | null;
  dateCreated: number;
  lastUpdated: number;
  accessToken: string;
  refreshToken: string;
  /** See {@link SystemUserProfile.mustChangePassword}. */
  mustChangePassword?: boolean;
}

/**
 * Response from `POST /v1/system-users/super-admin/login`.
 * Returns user + tenant context + tenant-scoped login URL.
 */
export interface SuperAdminGlobalLoginResponse {
  user: SystemUserLoginResponse;
  tenant: {
    tenantId: string;
    companyName: string;
  };
  tenantLoginUrl: string;
}

/**
 * Response from `POST /v1/admins/login`.
 * Backend returns camelCase for admin endpoints.
 */
export interface AdminLoginResponse {
  id: string;
  fullName: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  accountStatus: string;
  permissionList: string[] | null;
  /**
   * Access preset persisted on the admin row. Drives sidebar
   * filtering. Optional on the wire for backwards compat with admins
   * provisioned before the preset feature shipped.
   */
  accessPreset?: AdminAccessPreset;
  /**
   * True for every invited admin (2FA is mandatory). Surfaced so the
   * admin list can show a security-posture column without an extra
   * round trip.
   */
  mfaEnabled?: boolean;
  /** See {@link AdminProfile.mustChangePassword}. */
  mustChangePassword?: boolean;
  password: string;
  dateCreated: number | null;
  lastUpdated: number | null;
}
