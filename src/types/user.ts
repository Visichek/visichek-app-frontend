import type { SystemUserRole } from './enums';

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
  createdAt: number;
  updatedAt: number;
}

/**
 * System User Signup Request
 */
export interface SystemUserSignupRequest {
  departmentId?: string;
  fullName: string;
  email: string;
  password: string;
  role: SystemUserRole;
}

/**
 * System User Update Request
 */
export interface SystemUserUpdateRequest {
  fullName?: string;
  email?: string;
  role?: SystemUserRole;
  departmentId?: string;
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
