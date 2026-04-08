import type { SystemUserRole, AccountStatus } from "./enums";

// ── Login Payloads ────────────────────────────────────────────────────
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

// ── Token Shapes ──────────────────────────────────────────────────────
export interface TokenPair {
  access_token: string;
  refresh_token: string;
}

// ── Session Types ─────────────────────────────────────────────────────
export type SessionType = "admin" | "system_user";

export interface AdminProfile {
  id: string;
  full_name: string;
  email: string;
}

export interface SystemUserProfile {
  id: string;
  full_name: string;
  email: string;
  role: SystemUserRole;
  tenant_id: string;
  department_id?: string;
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
 * Flat response from `POST /v1/system-users/tenant/{tenant_id}/login`
 * and `POST /v1/system-users/login`.
 * Tokens are embedded directly on the user object.
 */
export interface SystemUserLoginResponse {
  id: string;
  tenant_id: string;
  department_id?: string;
  full_name: string;
  email: string;
  role: SystemUserRole;
  account_status: AccountStatus;
  is_active: boolean;
  last_login_at: number | null;
  date_created: number;
  last_updated: number;
  access_token: string;
  refresh_token: string;
}

/**
 * Response from `POST /v1/system-users/super-admin/login`.
 * Returns user + tenant context + tenant-scoped login URL.
 */
export interface SuperAdminGlobalLoginResponse {
  user: SystemUserLoginResponse;
  tenant: {
    tenant_id: string;
    company_name: string;
  };
  tenant_login_url: string;
}

/**
 * Response from `POST /v1/admins/login`.
 * Shape depends on backend; adjust if different.
 */
export interface AdminLoginResponse {
  id: string;
  full_name: string;
  email: string;
  access_token: string;
  refresh_token: string;
}
