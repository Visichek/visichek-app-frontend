import type { DeletionAction } from "./enums";

// ── Settings Manifest (GET /v1/settings) ────────────────────────────

export type SettingsSectionKey =
  | "profile"
  | "preferences"
  | "notifications"
  | "password"
  | "two_factor"
  | "sessions"
  | "dashboard_preferences"
  | "account_deletion"
  | "tenant_settings"
  | "platform_settings";

export interface SettingsFieldDef {
  key: string;
  label: string;
  type: string;
  editable: boolean;
}

export interface TwoFactorCurrentState {
  enabled: boolean;
  required: boolean;
  canDisable: boolean;
  enforcementReason: string | null;
}

export interface SettingsSection {
  key: SettingsSectionKey;
  label: string;
  description: string;
  endpoints: Record<string, string>;
  /** Profile section only */
  fields?: SettingsFieldDef[];
  /** Two-factor section only */
  currentState?: TwoFactorCurrentState;
  /** Account deletion section */
  allowed?: boolean;
  blockedReason?: string | null;
  /** Platform settings section */
  readonly?: boolean;
  isPrimaryAdmin?: boolean;
  /**
   * Platform settings section. When true, the only editable control
   * (maintenance mode) is gated behind a two-step OTP flow: request a
   * code via `endpoints.requestOtp`, then submit it with the new state
   * to `endpoints.update`.
   */
  otpRequired?: boolean;
}

export interface SettingsManifestProfile {
  id: string;
  fullName: string;
  email: string;
  role: string;
  tenantId?: string;
  departmentId?: string;
  accountStatus: string;
  mfaEnabled: boolean;
  mfaLockedByAdmin?: boolean;
}

/**
 * Policy block returned by GET /v1/settings. Each policy describes a
 * tenant-wide invariant the backend enforces; the frontend renders
 * informational chips so operators understand why certain controls are
 * locked. The `transferEndpoint` (for the main super_admin policy) is the
 * same one the transfer modal posts to — no separate wiring needed.
 */
export interface MainSuperAdminPolicy {
  active: boolean;
  rule: string;
  transferEndpoint: string;
}

export interface SettingsPolicies {
  mainSuperAdmin?: MainSuperAdminPolicy;
}

export interface SettingsManifest {
  profile: SettingsManifestProfile;
  isPrimaryAdmin: boolean;
  sections: SettingsSection[];
  policies?: SettingsPolicies;
}

// ── User Settings (per-user personal preferences) ───────────────────

export type ThemePreference = "light" | "dark" | "system";
export type DateFormat = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
export type TimeFormat = "12h" | "24h";
export type DigestFrequency = "realtime" | "hourly" | "daily" | "weekly" | "none";

export interface UserSettings {
  id: string;
  userId: string;
  userType: string;
  theme: ThemePreference;
  language: string;
  timezone: string;
  dateFormat: DateFormat;
  timeFormat: TimeFormat;
  emailNotifications: boolean;
  pushNotifications: boolean;
  notifyOnVisitorCheckIn: boolean;
  notifyOnAppointmentReminder: boolean;
  notifyOnIncidentCreated: boolean;
  notifyOnDsrReceived: boolean;
  notifyOnSystemAlert: boolean;
  digestFrequency: DigestFrequency;
  dashboardActionOrder: string[];
  dashboardCollapsedSections: string[];
  dateCreated: number;
  lastUpdated: number;
}

export type UserSettingsUpdate = Partial<
  Pick<
    UserSettings,
    | "theme"
    | "language"
    | "timezone"
    | "dateFormat"
    | "timeFormat"
    | "emailNotifications"
    | "pushNotifications"
    | "notifyOnVisitorCheckIn"
    | "notifyOnAppointmentReminder"
    | "notifyOnIncidentCreated"
    | "notifyOnDsrReceived"
    | "notifyOnSystemAlert"
    | "digestFrequency"
    | "dashboardActionOrder"
    | "dashboardCollapsedSections"
  >
>;

// ── User Preferences (key-value store) ───────────────────────────────

export type UserPreferences = Record<string, unknown>;

export interface UserPreferenceUpdate {
  key: string;
  value: unknown;
}

// ── Tenant Settings (super_admin) ────────────────────────────────────

export type VisitorBadgeExpiry = "end_of_day" | "manual" | "hours";
export type SsoProvider = "google" | "microsoft" | "okta" | "custom";

export interface TenantSettings {
  id: string;
  tenantId: string;
  // General
  companyName: string | null;
  companyEmail: string | null;
  companyPhone: string | null;
  companyWebsite: string | null;
  companyAddress: string | null;
  defaultTimezone: string;
  defaultLanguage: string;
  // Visitor policies
  requireIdScan: boolean;
  requireHostApproval: boolean;
  requireConsentBeforeCheckIn: boolean;
  autoCheckoutAfterHours: number | null;
  visitorBadgeExpiry: VisitorBadgeExpiry;
  visitorBadgeExpiryHours: number | null;
  allowSelfRegistration: boolean;
  selfRegistrationFields: string[];
  // Retention
  visitorDataRetentionDays: number;
  auditLogRetentionDays: number;
  incidentRetentionDays: number;
  deletionAction: DeletionAction;
  // Notifications
  sendWelcomeEmail: boolean;
  sendVisitorBadgeEmail: boolean;
  sendHostNotificationOnArrival: boolean;
  incidentEscalationEmail: string | null;
  // Integrations
  webhookUrl: string | null;
  webhookSecret: string | null;
  webhookEvents: string[];
  ssoEnabled: boolean;
  ssoProvider: SsoProvider | null;
  // Geofencing — when enabled, public visitor submits must include
  // visitor_lat/lng and the backend rejects submits outside radius_m of
  // either a fixed reference coordinate or an active approver.
  geofencingEnabled: boolean;
  geofencingRadiusMeters: number;
  geofencingReferenceLat: number | null;
  geofencingReferenceLng: number | null;
  dateCreated: number;
  lastUpdated: number;
}

export type TenantSettingsUpdate = Partial<
  Omit<TenantSettings, "id" | "tenantId" | "dateCreated" | "lastUpdated">
>;

// ── Platform Settings (admin) ────────────────────────────────────────

/**
 * Platform settings now expose a single runtime knob: maintenance mode.
 * Every other field that used to live here (password policy, lockout,
 * session timeout, 2FA enforcement, SMTP, tenant defaults, rate limits,
 * signup/beta/onboarding flags) moved into version-controlled backend
 * config and is changed by a deploy, not the UI — so it is no longer
 * returned by GET /v1/platform-settings.
 */
export interface PlatformSettings {
  id: string;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  dateCreated: number;
  lastUpdated: number;
}

/**
 * Toggling maintenance mode is a two-step OTP flow. Step 1 requests a
 * code (POST endpoints.requestOtp); step 2 PATCHes endpoints.update with
 * the returned challenge id, the code, and the new maintenance state.
 * PATCH accepts ONLY these four fields.
 */
export interface PlatformSettingsUpdate {
  otpChallengeId: string;
  otpCode: string;
  maintenanceMode: boolean;
  maintenanceMessage?: string;
}

/** Response from POST /v1/platform-settings/maintenance/request-otp. */
export interface RequestMaintenanceOtpResponse {
  otpRequired: boolean;
  otpChallengeId: string;
  message: string;
}
