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
  location: string | null;
  isCurrent: boolean;
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
