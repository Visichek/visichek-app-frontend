import type { SystemUserRole } from './enums';

/**
 * System User (tenant staff and super admin)
 */
export interface SystemUser {
  id: string;
  tenant_id: string;
  full_name: string;
  email: string;
  role: SystemUserRole;
  department_id?: string;
  created_at: number;
  updated_at: number;
}

/**
 * System User Signup Request
 */
export interface SystemUserSignupRequest {
  department_id?: string;
  full_name: string;
  email: string;
  password: string;
  role: SystemUserRole;
}

/**
 * System User Update Request
 */
export interface SystemUserUpdateRequest {
  full_name?: string;
  email?: string;
  role?: SystemUserRole;
  department_id?: string;
}

/**
 * Invite Admin Request
 */
export interface InviteAdminRequest {
  full_name: string;
  email: string;
}

/**
 * Admin Profile
 */
export interface Admin {
  id: string;
  full_name: string;
  email: string;
  created_at: number;
  updated_at: number;
}

/**
 * Admin Signup Request
 */
export interface AdminSignupRequest {
  full_name: string;
  email: string;
  password: string;
}
