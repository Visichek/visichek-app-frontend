import type { SystemUserRole, AccountStatus } from "./enums";

// ── Login Payloads ────────────────────────────────────────────────────
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

// ── Token Shapes ──────────────────────────────────────────────────────
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// ── Session Types ─────────────────────────────────────────────────────
export type SessionType = "admin" | "system_user";

export interface AdminProfile {
  id: string;
  fullName: string;
  email: string;
}

export interface SystemUserProfile {
  id: string;
  fullName: string;
  email: string;
  role: SystemUserRole;
  tenantId: string;
  departmentId?: string;
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
  Id: string;
  fullName: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  accountStatus: string;
  permissionList: string[] | null;
  password: string;
  dateCreated: number | null;
  lastUpdated: number | null;
}
