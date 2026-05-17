import type { SystemUserRole } from "./enums";

// ── Password Change ──────────────────────────────────────────────────

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ChangePasswordResponse {
  changed: boolean;
}

// ── Two-Factor Authentication ────────────────────────────────────────

export interface TwoFactorSetupResponse {
  secret: string;
  qrCodeUri: string;
  backupCodes: string[];
}

export interface TwoFactorVerifyRequest {
  code: string;
}

export interface TwoFactorVerifyResponse {
  enabled: boolean;
}

export interface TwoFactorDisableRequest {
  code: string;
}

export interface TwoFactorDisableResponse {
  disabled: boolean;
}

export interface BackupCodesResponse {
  backupCodes: string[];
}

// ── MFA Settings ─────────────────────────────────────────────────────

export interface MfaSettingsUpdate {
  mfaEnabled: boolean;
}

export interface MfaAdminUpdate {
  mfaEnabled: boolean;
  mfaLockedByAdmin?: boolean;
}

// ── Session Management ───────────────────────────────────────────────

export type DeviceType = "desktop" | "tablet" | "mobile" | "unknown";

export interface SessionOut {
  id: string;
  userId: string;
  userType: string;
  ipAddress: string;
  userAgent: string;
  deviceType: DeviceType;
  /**
   * Backend-formatted device label like "Chrome (Windows)". Prefer this
   * over parsing `userAgent` on the client — the server has richer UA
   * data and keeps the format consistent across rows. May be missing on
   * legacy rows; clients should fall back to `userAgent` parsing.
   */
  device?: string;
  location: string | null;
  isCurrent: boolean;
  /**
   * DB id of the access-token row backing this session. Used by the
   * server to compute `isCurrent`; surfaced so the client can correlate
   * sessions with token revocation events if needed.
   */
  accessTokenId?: string;
  dateCreated: number;
  lastActiveAt: number;
}

export interface RevokeSessionResponse {
  revoked: boolean;
}

export interface RevokeAllSessionsResponse {
  revokedCount: number;
}

// ── OTP Challenge ────────────────────────────────────────────────────

export interface OtpChallengeResponse {
  otpRequired: true;
  otpChallengeId: string;
  message: string;
}

export interface OtpVerifyRequest {
  otpChallengeId: string;
  otpCode: string;
}

/**
 * Check if a login response is an OTP challenge (2FA required).
 */
export function isOtpChallenge(data: unknown): data is OtpChallengeResponse {
  return (
    typeof data === "object" &&
    data !== null &&
    "otpRequired" in data &&
    (data as OtpChallengeResponse).otpRequired === true
  );
}

// ── Tenant Selection (multi-tenant login disambiguation) ─────────────

export interface TenantSelectionCandidate {
  tenantId: string;
  companyName: string;
  role: SystemUserRole;
  fullName: string;
  mfaEnabled: boolean;
}

export interface TenantSelectionResponse {
  tenantSelectionRequired: true;
  selectionToken: string;
  tenants: TenantSelectionCandidate[];
}

export interface SelectTenantRequest {
  selectionToken: string;
  tenantId: string;
}

/**
 * Check if a login response requires the user to pick a tenant. Returned
 * by `POST /v1/system-users/login` when the email matches an active
 * account in more than one tenant. The `selectionToken` is single-use
 * and expires in 5 minutes.
 */
export function isTenantSelectionRequired(
  data: unknown
): data is TenantSelectionResponse {
  return (
    typeof data === "object" &&
    data !== null &&
    "tenantSelectionRequired" in data &&
    (data as TenantSelectionResponse).tenantSelectionRequired === true
  );
}
