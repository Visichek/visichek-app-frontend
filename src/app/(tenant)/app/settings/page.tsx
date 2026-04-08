"use client";

/**
 * Tenant User Settings — Manifest-Driven
 *
 * Fetches GET /v1/settings once on mount. The manifest decides which
 * sections and tabs appear. The visual structure is preserved:
 *   Profile + Preferences + Security + Sessions + Advanced
 *
 * Super-admin–only sections (tenant_settings) appear in "Advanced" only
 * when the manifest includes them.
 */

import { useState, useCallback } from "react";
import { useTheme } from "next-themes";
import {
  Sun,
  Moon,
  Monitor,
  KeyRound,
  ShieldOff,
  ShieldAlert,
  LogOut,
  Laptop,
  Smartphone,
  Tablet,
  Copy,
  Check,
  MoreHorizontal,
  Trash2,
  Loader2,
} from "lucide-react";
import {
  SettingsLayout,
  type SettingsTab,
} from "@/components/recipes/settings-layout";
import {
  SettingsToggle,
  SettingsSelect,
  SettingsInfo,
} from "@/components/recipes/settings-section";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils/cn";
import { toast } from "sonner";

// Manifest & data hooks
import {
  useSettingsManifest,
  useSettingsSection,
  useVisibleSections,
  useUserSettings,
  useUpdateUserSettings,
  useTenantSettings,
  useUpdateTenantSettings,
} from "@/features/settings/hooks";
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from "@/features/notifications/hooks";
import {
  useSessions,
  useRevokeSession,
  useRevokeAllSessions,
} from "@/features/account/hooks";
import {
  PasswordChangeDialog,
  TwoFactorSetupDialog,
  TwoFactorDisableDialog,
} from "@/features/account/components";

import type { UserSettingsUpdate, DigestFrequency, DateFormat, TimeFormat } from "@/types/settings";
import type { NotificationPreferencesUpdate } from "@/types/notification";
import type { SessionOut, DeviceType } from "@/types/account";

// ── Page ─────────────────────────────────────────────────────────────

export default function TenantSettingsPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [twoFaSetupOpen, setTwoFaSetupOpen] = useState(false);
  const [twoFaDisableOpen, setTwoFaDisableOpen] = useState(false);

  // ── Manifest ────────────────────────────────────────────
  const { data: manifest, isLoading: manifestLoading } = useSettingsManifest();
  const visibleSections = useVisibleSections(manifest);

  // Section lookups
  const profileSection = useSettingsSection(manifest, "profile");
  const prefsSection = useSettingsSection(manifest, "preferences");
  const notifsSection = useSettingsSection(manifest, "notifications");
  const passwordSection = useSettingsSection(manifest, "password");
  const twoFactorSection = useSettingsSection(manifest, "two_factor");
  const sessionsSection = useSettingsSection(manifest, "sessions");
  const deletionSection = useSettingsSection(manifest, "account_deletion");
  const tenantSettingsSection = useSettingsSection(manifest, "tenant_settings");

  // Profile from manifest (server-authoritative)
  const profile = manifest?.profile;

  // ── Data hooks (only enabled when manifest says section exists) ──
  const { data: userSettings } = useUserSettings();
  const updateSettings = useUpdateUserSettings();

  const { data: notifPrefs } = useNotificationPreferences();
  const updateNotifPrefs = useUpdateNotificationPreferences();

  const { data: sessions, isLoading: sessionsLoading } = useSessions();
  const revokeSession = useRevokeSession();
  const revokeAllSessions = useRevokeAllSessions();

  const tenantId = profile?.tenantId ?? "";
  const { data: tenantSettingsData } = useTenantSettings(tenantId);
  const updateTenantSettings = useUpdateTenantSettings(tenantId);

  // Mount tracking for theme picker
  useState(() => { setMounted(true); });

  // ── Handlers ────────────────────────────────────────────
  const handleSettingsUpdate = useCallback(
    (patch: UserSettingsUpdate) => {
      updateSettings.mutate(patch, {
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save"),
      });
    },
    [updateSettings]
  );

  const handleThemeChange = useCallback(
    (t: string) => {
      setTheme(t);
      handleSettingsUpdate({ theme: t as "light" | "dark" | "system" });
    },
    [setTheme, handleSettingsUpdate]
  );

  const handleNotifPrefUpdate = useCallback(
    (patch: NotificationPreferencesUpdate) => {
      updateNotifPrefs.mutate(patch, {
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save"),
      });
    },
    [updateNotifPrefs]
  );

  // ── 2FA state from manifest ─────────────────────────────
  const twoFa = twoFactorSection?.currentState;
  const mfaEnabled = twoFa?.enabled ?? false;
  const mfaCanDisable = twoFa?.canDisable ?? true;
  const mfaRequired = twoFa?.required ?? false;
  const mfaEnforcementReason = twoFa?.enforcementReason ?? null;

  // ── Loading state ───────────────────────────────────────
  if (manifestLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Profile tab ────────────────────────────────────────

  const profileContent = (
    <div className="space-y-6">
      {profileSection && (
        <section>
          <h2 className="text-base font-semibold mb-1">{profileSection.label}</h2>
          <p className="text-sm text-muted-foreground mb-4">{profileSection.description}</p>
          <div className="space-y-1">
            <SettingsInfo label="Full name" value={profile?.fullName ?? "—"} />
            <SettingsInfo label="Email" value={profile?.email ?? "—"} />
            <SettingsInfo
              label="Role"
              value={
                profile?.role
                  ? profile.role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                  : "—"
              }
            />
          </div>
        </section>
      )}

      <Separator />

      <section>
        <h2 className="text-base font-semibold mb-1">Appearance</h2>
        <p className="text-sm text-muted-foreground mb-4">Choose how the application looks to you</p>
        <ThemePicker theme={theme} setTheme={handleThemeChange} mounted={mounted} />
      </section>

      {prefsSection && (
        <>
          <Separator />
          <section>
            <h2 className="text-base font-semibold mb-1">Regional</h2>
            <p className="text-sm text-muted-foreground mb-4">Language, timezone, and formatting preferences</p>
            <div className="space-y-1">
              <SettingsSelect id="language" label="Language" description="Display language for the interface" value={userSettings?.language ?? "en"} onValueChange={(v) => handleSettingsUpdate({ language: v })} options={[{ value: "en", label: "English" }, { value: "fr", label: "French" }, { value: "es", label: "Spanish" }]} />
              <SettingsSelect id="timezone" label="Timezone" description="Used for timestamps and scheduling" value={userSettings?.timezone ?? "Africa/Lagos"} onValueChange={(v) => handleSettingsUpdate({ timezone: v })} options={[{ value: "Africa/Lagos", label: "Africa/Lagos" }, { value: "Europe/London", label: "Europe/London" }, { value: "America/New_York", label: "America/New York" }, { value: "Asia/Tokyo", label: "Asia/Tokyo" }]} />
              <SettingsSelect id="dateFormat" label="Date format" description="How dates appear across the app" value={userSettings?.dateFormat ?? "DD/MM/YYYY"} onValueChange={(v) => handleSettingsUpdate({ dateFormat: v as DateFormat })} options={[{ value: "DD/MM/YYYY", label: "DD/MM/YYYY" }, { value: "MM/DD/YYYY", label: "MM/DD/YYYY" }, { value: "YYYY-MM-DD", label: "YYYY-MM-DD" }]} />
              <SettingsSelect id="timeFormat" label="Time format" description="12-hour or 24-hour clock" value={userSettings?.timeFormat ?? "24h"} onValueChange={(v) => handleSettingsUpdate({ timeFormat: v as TimeFormat })} options={[{ value: "12h", label: "12-hour" }, { value: "24h", label: "24-hour" }]} />
            </div>
          </section>
        </>
      )}
    </div>
  );

  // ── Security tab (password + 2FA from manifest) ────────

  const securityContent = (
    <div className="space-y-6">
      {twoFactorSection && (
        <section>
          <h2 className="text-base font-semibold mb-1">{twoFactorSection.label}</h2>
          <p className="text-sm text-muted-foreground mb-4">{twoFactorSection.description}</p>

          {/* Enforcement banner */}
          {mfaEnforcementReason && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 mb-4">
              <ShieldAlert className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-400">
                {mfaEnforcementReason}
              </p>
            </div>
          )}

          <SettingsInfo
            label="Status"
            description={
              mfaEnabled
                ? mfaRequired
                  ? "Two-factor authentication is mandatory for your account"
                  : "Your account is protected with 2FA"
                : "Not currently enabled"
            }
            value={
              mfaEnabled ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {mfaRequired ? "Enabled (required)" : "Enabled"}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Disabled
                </span>
              )
            }
            action={
              mfaEnabled ? (
                mfaCanDisable ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" className="min-h-[36px] text-destructive" onClick={() => setTwoFaDisableOpen(true)}>
                        <ShieldOff className="h-3.5 w-3.5 mr-1.5" />
                        Disable
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Remove two-factor authentication from your account</TooltipContent>
                  </Tooltip>
                ) : null
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" className="min-h-[36px]" onClick={() => setTwoFaSetupOpen(true)}>
                      <KeyRound className="h-3.5 w-3.5 mr-1.5" />
                      Enable
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Set up two-factor authentication using an authenticator app</TooltipContent>
                </Tooltip>
              )
            }
          />
        </section>
      )}

      {passwordSection && (
        <>
          <Separator />
          <section>
            <h2 className="text-base font-semibold mb-1">{passwordSection.label}</h2>
            <p className="text-sm text-muted-foreground mb-4">{passwordSection.description}</p>
            <SettingsInfo
              label="Current password"
              description="Change your password regularly to keep your account secure"
              value={<span className="text-xs">••••••••••</span>}
              action={
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" className="min-h-[36px]" onClick={() => setPasswordDialogOpen(true)}>Change</Button>
                  </TooltipTrigger>
                  <TooltipContent>Change your account password</TooltipContent>
                </Tooltip>
              }
            />
          </section>
        </>
      )}

      <PasswordChangeDialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen} />
      <TwoFactorSetupDialog open={twoFaSetupOpen} onOpenChange={setTwoFaSetupOpen} />
      <TwoFactorDisableDialog open={twoFaDisableOpen} onOpenChange={setTwoFaDisableOpen} />
    </div>
  );

  // ── Sessions tab ───────────────────────────────────────

  const sessionsContent = (
    <div className="space-y-6">
      {sessionsSection && (
        <>
          <section>
            <div className="flex items-center justify-between rounded-lg px-3 py-3 min-h-[52px]">
              <p className="text-sm font-medium">Log out of all devices</p>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-[36px]"
                    onClick={() => {
                      revokeAllSessions.mutate(undefined, {
                        onSuccess: (data) => toast.success(`${data.revokedCount} session(s) revoked`),
                        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to revoke sessions"),
                      });
                    }}
                    disabled={revokeAllSessions.isPending}
                  >
                    {revokeAllSessions.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                    Log out
                  </Button>
                </TooltipTrigger>
                <TooltipContent>End every active session and sign out all devices at once</TooltipContent>
              </Tooltip>
            </div>
          </section>

          <Separator />

          <section>
            <h2 className="text-base font-semibold mb-1">Active sessions</h2>
            <p className="text-sm text-muted-foreground mb-4">Devices where you are currently signed in</p>
            {sessionsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <SessionsTable
                sessions={sessions ?? []}
                onRevoke={(id) => {
                  revokeSession.mutate(id, {
                    onSuccess: () => toast.success("Session revoked"),
                    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to revoke session"),
                  });
                }}
                revokingId={revokeSession.isPending ? (revokeSession.variables as string) : null}
              />
            )}
          </section>
        </>
      )}
    </div>
  );

  // ── Notifications tab ──────────────────────────────────

  const notificationsContent = (
    <div className="space-y-6">
      <section>
        <h2 className="text-base font-semibold mb-1">Channels</h2>
        <p className="text-sm text-muted-foreground mb-4">How you receive alerts</p>
        <div className="space-y-1">
          <SettingsToggle id="emailNotifications" label="Email notifications" description="Receive important alerts and updates via email" checked={userSettings?.emailNotifications ?? true} onCheckedChange={(v) => handleSettingsUpdate({ emailNotifications: v })} />
          <SettingsToggle id="pushNotifications" label="Push notifications" description="Get browser push notifications for time-sensitive alerts" checked={userSettings?.pushNotifications ?? false} onCheckedChange={(v) => handleSettingsUpdate({ pushNotifications: v })} />
        </div>
      </section>

      {notifsSection && (
        <>
          <Separator />
          <section>
            <h2 className="text-base font-semibold mb-1">Event alerts</h2>
            <p className="text-sm text-muted-foreground mb-4">Choose which events trigger notifications</p>
            <div className="space-y-1">
              <SettingsToggle id="emailOnVisitorCheckIn" label="Visitor check-in" description="Get notified when a visitor checks in at your location" checked={notifPrefs?.emailOnVisitorCheckIn ?? false} onCheckedChange={(v) => handleNotifPrefUpdate({ emailOnVisitorCheckIn: v })} />
              <SettingsToggle id="emailOnAppointmentReminder" label="Appointment reminders" description="Receive reminders before upcoming appointments" checked={notifPrefs?.emailOnAppointmentReminder ?? true} onCheckedChange={(v) => handleNotifPrefUpdate({ emailOnAppointmentReminder: v })} />
              <SettingsToggle id="emailOnIncident" label="Incident alerts" description="Be notified when a new security incident is created" checked={notifPrefs?.emailOnIncident ?? true} onCheckedChange={(v) => handleNotifPrefUpdate({ emailOnIncident: v })} />
              <SettingsToggle id="emailOnDsrReceived" label="Data subject requests" description="Be notified when a new data subject request arrives" checked={notifPrefs?.emailOnDsrReceived ?? true} onCheckedChange={(v) => handleNotifPrefUpdate({ emailOnDsrReceived: v })} />
              <SettingsToggle id="emailOnSubscriptionAlert" label="Subscription alerts" description="Get notified about subscription expiry and payment issues" checked={notifPrefs?.emailOnSubscriptionAlert ?? true} onCheckedChange={(v) => handleNotifPrefUpdate({ emailOnSubscriptionAlert: v })} />
              <SettingsToggle id="emailOnNewUser" label="New user added" description="Get notified when a new user is added to your tenant" checked={notifPrefs?.emailOnNewUser ?? false} onCheckedChange={(v) => handleNotifPrefUpdate({ emailOnNewUser: v })} />
            </div>
          </section>

          <Separator />

          <section>
            <h2 className="text-base font-semibold mb-1">Digest</h2>
            <p className="text-sm text-muted-foreground mb-4">How often non-urgent notifications are batched</p>
            <SettingsSelect id="digestFrequency" label="Frequency" description="Batching interval for non-urgent alerts" value={userSettings?.digestFrequency ?? "realtime"} onValueChange={(v) => handleSettingsUpdate({ digestFrequency: v as DigestFrequency })} options={[{ value: "realtime", label: "Realtime" }, { value: "hourly", label: "Hourly" }, { value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }, { value: "none", label: "None" }]} />
          </section>
        </>
      )}
    </div>
  );

  // ── Advanced tab (account deletion + tenant settings) ──

  const advancedContent = (
    <div className="space-y-6">
      {/* Account deletion — driven by manifest */}
      {deletionSection && (
        <section>
          <h2 className="text-base font-semibold mb-1">{deletionSection.label}</h2>
          <p className="text-sm text-muted-foreground mb-4">{deletionSection.description}</p>
          <div className="flex items-center justify-between rounded-lg px-3 py-3 min-h-[52px]">
            <div className="flex-1 mr-4">
              {deletionSection.blockedReason && (
                <p className="text-sm text-muted-foreground">{deletionSection.blockedReason}</p>
              )}
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-[36px] text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
                  disabled={!deletionSection.allowed}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Delete account
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {deletionSection.allowed
                  ? "Permanently delete your account and all associated data"
                  : deletionSection.blockedReason ?? "Account deletion is not available"}
              </TooltipContent>
            </Tooltip>
          </div>
        </section>
      )}

      {/* IDs */}
      <section>
        <div className="space-y-1">
          {profile?.tenantId && <CopyableId label="Tenant ID" value={profile.tenantId} />}
          {profile?.id && <CopyableId label="User ID" value={profile.id} />}
        </div>
      </section>

      {/* Tenant settings — only when manifest includes it (super_admin) */}
      {tenantSettingsSection && tenantSettingsData && (
        <>
          <Separator />
          <section>
            <h2 className="text-base font-semibold mb-1">Security policies</h2>
            <p className="text-sm text-muted-foreground mb-4">Organisation-wide security rules applied to all users</p>
            <div className="space-y-1">
              <SettingsToggle
                id="enforceTotp"
                label="Enforce 2FA for all users"
                description="Require every user to set up two-factor authentication before they can log in"
                checked={tenantSettingsData.enforceTotp ?? false}
                onCheckedChange={(v) => updateTenantSettings.mutate({ enforceTotp: v })}
              />
              <SettingsSelect
                id="passwordMinLength"
                label="Minimum password length"
                description="Minimum characters required for passwords"
                value={String(tenantSettingsData.passwordMinLength ?? 8)}
                onValueChange={(v) => updateTenantSettings.mutate({ passwordMinLength: parseInt(v, 10) })}
                options={[{ value: "8", label: "8 characters" }, { value: "10", label: "10 characters" }, { value: "12", label: "12 characters" }, { value: "16", label: "16 characters" }]}
              />
              <SettingsSelect
                id="sessionTimeout"
                label="Session timeout"
                description="Automatically sign out users after inactivity"
                value={String(tenantSettingsData.sessionTimeoutMinutes ?? 60)}
                onValueChange={(v) => updateTenantSettings.mutate({ sessionTimeoutMinutes: parseInt(v, 10) })}
                options={[{ value: "15", label: "15 minutes" }, { value: "30", label: "30 minutes" }, { value: "60", label: "1 hour" }, { value: "120", label: "2 hours" }, { value: "480", label: "8 hours" }]}
              />
              <SettingsSelect
                id="maxFailedLogins"
                label="Account lockout threshold"
                description="Lock account after this many failed login attempts"
                value={String(tenantSettingsData.maxFailedLoginAttempts ?? 5)}
                onValueChange={(v) => updateTenantSettings.mutate({ maxFailedLoginAttempts: parseInt(v, 10) })}
                options={[{ value: "3", label: "3 attempts" }, { value: "5", label: "5 attempts" }, { value: "10", label: "10 attempts" }]}
              />
              <SettingsSelect
                id="lockoutDuration"
                label="Lockout duration"
                description="How long accounts stay locked after exceeding the threshold"
                value={String(tenantSettingsData.lockoutDurationMinutes ?? 30)}
                onValueChange={(v) => updateTenantSettings.mutate({ lockoutDurationMinutes: parseInt(v, 10) })}
                options={[{ value: "5", label: "5 minutes" }, { value: "15", label: "15 minutes" }, { value: "30", label: "30 minutes" }, { value: "60", label: "1 hour" }]}
              />
            </div>
          </section>

          <Separator />

          <section>
            <h2 className="text-base font-semibold mb-1">Visitor policies</h2>
            <p className="text-sm text-muted-foreground mb-4">Rules for how visitors are checked in and managed</p>
            <div className="space-y-1">
              <SettingsToggle id="requireIdScan" label="Require ID scan" description="Mandate identity document scanning during check-in" checked={tenantSettingsData.requireIdScan ?? false} onCheckedChange={(v) => updateTenantSettings.mutate({ requireIdScan: v })} />
              <SettingsToggle id="requireHostApproval" label="Require host approval" description="Visitor must be approved by their host before completing check-in" checked={tenantSettingsData.requireHostApproval ?? false} onCheckedChange={(v) => updateTenantSettings.mutate({ requireHostApproval: v })} />
              <SettingsToggle id="requireConsent" label="Require NDPA consent" description="Visitors must acknowledge a data protection notice before check-in" checked={tenantSettingsData.requireConsentBeforeCheckIn ?? true} onCheckedChange={(v) => updateTenantSettings.mutate({ requireConsentBeforeCheckIn: v })} />
              <SettingsToggle id="allowSelfRegistration" label="Self-registration via QR" description="Allow visitors to register themselves by scanning a public QR code" checked={tenantSettingsData.allowSelfRegistration ?? false} onCheckedChange={(v) => updateTenantSettings.mutate({ allowSelfRegistration: v })} />
              <SettingsSelect id="autoCheckout" label="Auto checkout" description="Automatically check visitors out after a set duration" value={tenantSettingsData.autoCheckoutAfterHours ? String(tenantSettingsData.autoCheckoutAfterHours) : "disabled"} onValueChange={(v) => updateTenantSettings.mutate({ autoCheckoutAfterHours: v === "disabled" ? null : parseInt(v, 10) })} options={[{ value: "disabled", label: "Disabled" }, { value: "4", label: "4 hours" }, { value: "8", label: "8 hours" }, { value: "12", label: "12 hours" }]} />
              <SettingsSelect id="badgeExpiry" label="Badge expiry" description="When visitor badges become invalid" value={tenantSettingsData.visitorBadgeExpiry ?? "end_of_day"} onValueChange={(v) => updateTenantSettings.mutate({ visitorBadgeExpiry: v as "end_of_day" | "manual" | "hours" })} options={[{ value: "end_of_day", label: "End of day" }, { value: "manual", label: "Manual" }, { value: "hours", label: "After set hours" }]} />
            </div>
          </section>

          <Separator />

          <section>
            <h2 className="text-base font-semibold mb-1">Data retention</h2>
            <p className="text-sm text-muted-foreground mb-4">How long data is kept before automatic cleanup</p>
            <div className="space-y-1">
              <SettingsSelect id="visitorRetention" label="Visitor data" description="Automatically delete visitor records after this period" value={String(tenantSettingsData.visitorDataRetentionDays ?? 365)} onValueChange={(v) => updateTenantSettings.mutate({ visitorDataRetentionDays: parseInt(v, 10) })} options={[{ value: "90", label: "90 days" }, { value: "180", label: "180 days" }, { value: "365", label: "1 year" }, { value: "730", label: "2 years" }]} />
              <SettingsSelect id="auditRetention" label="Audit logs" description="Automatically delete audit log entries after this period" value={String(tenantSettingsData.auditLogRetentionDays ?? 730)} onValueChange={(v) => updateTenantSettings.mutate({ auditLogRetentionDays: parseInt(v, 10) })} options={[{ value: "90", label: "90 days" }, { value: "180", label: "180 days" }, { value: "365", label: "1 year" }, { value: "730", label: "2 years" }, { value: "1825", label: "5 years" }]} />
              <SettingsSelect id="incidentRetention" label="Incidents" description="Automatically delete incident records after this period" value={String(tenantSettingsData.incidentRetentionDays ?? 730)} onValueChange={(v) => updateTenantSettings.mutate({ incidentRetentionDays: parseInt(v, 10) })} options={[{ value: "365", label: "1 year" }, { value: "730", label: "2 years" }, { value: "1825", label: "5 years" }]} />
              <SettingsSelect id="deletionAction" label="On expiry" description="Permanently delete or anonymise expired records" value={tenantSettingsData.deletionAction ?? "anonymise"} onValueChange={(v) => updateTenantSettings.mutate({ deletionAction: v as "delete" | "anonymise" })} options={[{ value: "delete", label: "Permanently delete" }, { value: "anonymise", label: "Anonymise" }]} />
            </div>
          </section>

          <Separator />

          <section>
            <h2 className="text-base font-semibold mb-1">Organisation</h2>
            <p className="text-sm text-muted-foreground mb-4">Company details and email preferences</p>
            <div className="space-y-1">
              <SettingsInfo label="Company name" description="Displayed on badges and visitor-facing pages" value={tenantSettingsData.companyName ?? "—"} />
              <SettingsInfo label="Company email" description="Contact email for the organisation" value={tenantSettingsData.companyEmail ?? "—"} />
              <SettingsInfo label="Default timezone" description="Organisation-wide timezone for scheduling and reports" value={tenantSettingsData.defaultTimezone ?? "Africa/Lagos"} />
            </div>
          </section>

          <Separator />

          <section>
            <h2 className="text-base font-semibold mb-1">Email preferences</h2>
            <p className="text-sm text-muted-foreground mb-4">Organisation-wide email behaviour</p>
            <div className="space-y-1">
              <SettingsToggle id="sendWelcomeEmail" label="Welcome email" description="Send a welcome email when new staff accounts are created" checked={tenantSettingsData.sendWelcomeEmail ?? true} onCheckedChange={(v) => updateTenantSettings.mutate({ sendWelcomeEmail: v })} />
              <SettingsToggle id="sendHostNotification" label="Host arrival notification" description="Notify hosts via email when their visitor arrives" checked={tenantSettingsData.sendHostNotificationOnArrival ?? true} onCheckedChange={(v) => updateTenantSettings.mutate({ sendHostNotificationOnArrival: v })} />
              <SettingsToggle id="sendVisitorBadgeEmail" label="Visitor badge email" description="Email the visitor badge to the visitor after check-in" checked={tenantSettingsData.sendVisitorBadgeEmail ?? false} onCheckedChange={(v) => updateTenantSettings.mutate({ sendVisitorBadgeEmail: v })} />
            </div>
          </section>
        </>
      )}
    </div>
  );

  // ── Build tabs from manifest ───────────────────────────

  const tabs: SettingsTab[] = [
    { id: "profile", label: "Profile", description: "Profile, appearance, and regional preferences", content: profileContent },
  ];

  if (visibleSections.has("password") || visibleSections.has("two_factor")) {
    tabs.push({ id: "security", label: "Security", description: "Two-factor authentication and password", content: securityContent });
  }

  if (visibleSections.has("sessions")) {
    tabs.push({ id: "sessions", label: "Sessions", description: "Active sessions and device management", content: sessionsContent });
  }

  if (visibleSections.has("notifications")) {
    tabs.push({ id: "notifications", label: "Notifications", description: "Email, push, event alerts, and digest settings", content: notificationsContent });
  }

  // Advanced tab shows if there's account deletion or tenant settings
  if (visibleSections.has("account_deletion") || visibleSections.has("tenant_settings")) {
    tabs.push({ id: "advanced", label: "Advanced", description: "Account deletion, IDs, and organisation settings", content: advancedContent });
  }

  return <SettingsLayout title="Settings" tabs={tabs} />;
}

// ── Sub-components ───────────────────────────────────────────────────

function ThemePicker({
  theme,
  setTheme,
  mounted,
}: {
  theme: string | undefined;
  setTheme: (t: string) => void;
  mounted: boolean;
}) {
  const options = [
    { value: "light", label: "Light", icon: Sun, desc: "Use a bright colour scheme" },
    { value: "dark", label: "Dark", icon: Moon, desc: "Use a dimmer colour scheme that's easier on the eyes" },
    { value: "system", label: "System", icon: Monitor, desc: "Automatically match your operating system preference" },
  ] as const;

  if (!mounted) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-[76px] rounded-md bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = theme === opt.value;
        return (
          <Tooltip key={opt.value}>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "flex flex-col items-center gap-2 h-auto py-4 min-h-[44px] transition-colors",
                  active && "border-primary bg-primary/5 text-primary ring-1 ring-primary",
                )}
                onClick={() => setTheme(opt.value)}
                aria-pressed={active}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="text-sm font-medium">{opt.label}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{opt.desc}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

function CopyableId({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <div className="flex items-center justify-between rounded-lg px-3 py-3 hover:bg-muted/50 transition-colors min-h-[52px]">
      <div className="flex-1 mr-4">
        <p className="text-sm font-medium">{label}</p>
      </div>
      <div className="flex items-center gap-2">
        <code className="rounded-md border bg-muted/50 px-2.5 py-1 text-xs font-mono text-muted-foreground select-all">
          {value}
        </code>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={copy}>
              {copied ? (
                <Check className="h-3.5 w-3.5 text-success" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{copied ? "Copied!" : `Copy ${label} to clipboard`}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

// ── Sessions table ──────────────────────────────────────────────────

const DEVICE_ICONS: Record<DeviceType, typeof Laptop> = {
  desktop: Laptop,
  tablet: Tablet,
  mobile: Smartphone,
  unknown: Laptop,
};

function formatSessionDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function parseUserAgent(ua: string): string {
  let browser = "Unknown";
  if (ua.includes("Chrome") && !ua.includes("Edg")) browser = "Chrome";
  else if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
  else if (ua.includes("Edg")) browser = "Edge";

  let os = "";
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Macintosh") || ua.includes("Mac OS")) os = "macOS";
  else if (ua.includes("Linux") && !ua.includes("Android")) os = "Linux";
  else if (ua.includes("iPhone")) os = "iOS";
  else if (ua.includes("iPad")) os = "iPadOS";
  else if (ua.includes("Android")) os = "Android";

  return os ? `${browser} (${os})` : browser;
}

function SessionsTable({
  sessions,
  onRevoke,
  revokingId,
}: {
  sessions: SessionOut[];
  onRevoke: (id: string) => void;
  revokingId: string | null;
}) {
  return (
    <div>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left font-medium text-muted-foreground px-4 py-3">Device</th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3">Location</th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3">Created</th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3">Last active</th>
              <th className="w-10 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {sessions.map((sess) => {
              const DeviceIcon = DEVICE_ICONS[sess.deviceType] ?? Laptop;
              return (
                <tr key={sess.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">
                    <span className="flex items-center gap-2">
                      <DeviceIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                      {parseUserAgent(sess.userAgent)}
                      {sess.isCurrent && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                          Current
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{sess.location ?? sess.ipAddress}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatSessionDate(sess.dateCreated)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatSessionDate(sess.lastActiveAt)}</td>
                  <td className="px-4 py-3">
                    <DropdownMenu>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              {revokingId === sess.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreHorizontal className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent>Session actions</TooltipContent>
                      </Tooltip>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => onRevoke(sess.id)}
                          className="text-destructive focus:text-destructive gap-2"
                          disabled={sess.isCurrent}
                        >
                          <LogOut className="h-4 w-4" />
                          {sess.isCurrent ? "Current session" : "Revoke session"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-2 md:hidden">
        {sessions.map((sess) => {
          const DeviceIcon = DEVICE_ICONS[sess.deviceType] ?? Laptop;
          return (
            <div key={sess.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium flex items-center gap-2">
                  <DeviceIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                  {parseUserAgent(sess.userAgent)}
                  {sess.isCurrent && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                      Current
                    </span>
                  )}
                </p>
                {!sess.isCurrent && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive h-8"
                        onClick={() => onRevoke(sess.id)}
                        disabled={revokingId === sess.id}
                      >
                        {revokingId === sess.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Revoke"}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>End this session</TooltipContent>
                  </Tooltip>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                <span>Location: {sess.location ?? sess.ipAddress}</span>
                <span>Created: {formatSessionDate(sess.dateCreated)}</span>
                <span className="col-span-2">Last active: {formatSessionDate(sess.lastActiveAt)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
