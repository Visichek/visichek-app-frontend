import type { SystemUserRole } from "./enums";

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
