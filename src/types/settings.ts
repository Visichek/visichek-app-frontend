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
export type SmtpEncryption = "tls" | "ssl" | "none";

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

export interface PlatformSettings {
  id: string;
  platformName: string;
  supportEmail: string;
  supportPhone: string;
  platformUrl: string;
  // Security — password policy
  passwordMinLength: number;
  passwordMaxLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireLowercase: boolean;
  passwordRequireNumber: boolean;
  passwordRequireSpecialChar: boolean;
  passwordExpiryDays: number | null;
  passwordHistoryCount: number;
  // Security — account lockout
  maxFailedLoginAttempts: number;
  lockoutDurationMinutes: number;
  // Security — session
  sessionTimeoutMinutes: number;
  // Security — two-factor authentication
  enforceTotpForAdmins: boolean;
  enforceTotpForTenantUsers: boolean;
  maxAdminAccounts: number | null;
  // Tenant defaults
  defaultTrialDays: number;
  defaultPlanId: string | null;
  maxTenantsPerPlan: Record<string, number>;
  // SMTP
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpFromEmail: string | null;
  smtpFromName: string | null;
  smtpEncryption: SmtpEncryption;
  // Features
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  signupsEnabled: boolean;
  publicApiEnabled: boolean;
  betaFeaturesEnabled: boolean;
  // Public marketing-site self-onboarding form. When false, the public
  // submission endpoint returns FEATURE_DISABLED but admins can still
  // work the existing onboarding queue.
  selfOnboardingEnabled: boolean;
  // Rate limiting
  globalRateLimitPerMinute: number;
  globalRateLimitBurst: number;
  dateCreated: number;
  lastUpdated: number;
}

export type PlatformSettingsUpdate = Partial<
  Omit<PlatformSettings, "id" | "dateCreated" | "lastUpdated">
>;
