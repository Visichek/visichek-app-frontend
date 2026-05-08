"use client";

import { Info } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { SettingsInfo, SettingsToggle, SettingsSelect } from "@/components/recipes/settings-section";
import {
  useSettingsManifest,
  useSettingsSection,
  usePlatformSettings,
  useUpdatePlatformSettings,
} from "@/features/settings/hooks";

export function PlatformTab() {
  const { data: manifest } = useSettingsManifest();
  const platformSection = useSettingsSection(manifest, "platform_settings");
  const isPrimaryAdmin = manifest?.isPrimaryAdmin ?? false;
  const platformReadonly = platformSection?.readonly ?? true;

  const { data: platformSettingsData } = usePlatformSettings();
  const updatePlatformSettings = useUpdatePlatformSettings();

  if (!platformSection) return null;

  return (
    <div className="space-y-6">
      {platformReadonly && (
        <div className="flex items-start gap-2.5 rounded-lg border border-blue-500/30 bg-blue-500/5 px-4 py-3">
          <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
          <p className="text-sm text-blue-700 dark:text-blue-400">
            Only the primary platform admin can edit these settings. You have read-only access.
          </p>
        </div>
      )}

      <section>
        <h2 className="text-base font-semibold mb-1">Platform identity</h2>
        <p className="text-sm text-muted-foreground mb-4">Global configuration visible to all tenants</p>
        <div className="space-y-1">
          <SettingsInfo label="Platform name" description="Shown in emails and public pages" value={platformSettingsData?.platformName ?? "VisiChek"} />
          <SettingsInfo label="Support email" description="Displayed in help sections and error pages" value={platformSettingsData?.supportEmail ?? "support@visichek.com"} />
          <SettingsInfo label="Platform URL" description="Public URL of the platform" value={platformSettingsData?.platformUrl ?? "—"} />
        </div>
      </section>

      <Separator />

      <section>
        <h2 className="text-base font-semibold mb-1">Security policies</h2>
        <p className="text-sm text-muted-foreground mb-4">Platform-wide rules applied uniformly to admins and every tenant user</p>
        <div className="space-y-1">
          <SettingsSelect id="passwordMinLength" label="Minimum password length" description="Minimum characters required for any new or changed password" value={String(platformSettingsData?.passwordMinLength ?? 8)} onValueChange={(v) => updatePlatformSettings.mutate({ passwordMinLength: parseInt(v, 10) })} options={[{ value: "8", label: "8 characters" }, { value: "10", label: "10 characters" }, { value: "12", label: "12 characters" }, { value: "16", label: "16 characters" }, { value: "20", label: "20 characters" }]} disabled={platformReadonly} isLoading={updatePlatformSettings.isPending} />
          <SettingsSelect id="passwordMaxLength" label="Maximum password length" description="Hard cap on password length (must be greater than the minimum)" value={String(platformSettingsData?.passwordMaxLength ?? 128)} onValueChange={(v) => updatePlatformSettings.mutate({ passwordMaxLength: parseInt(v, 10) })} options={[{ value: "64", label: "64 characters" }, { value: "128", label: "128 characters" }, { value: "256", label: "256 characters" }]} disabled={platformReadonly} isLoading={updatePlatformSettings.isPending} />
          <SettingsToggle id="passwordRequireUppercase" label="Require uppercase letter" description="Passwords must contain at least one A–Z character" checked={platformSettingsData?.passwordRequireUppercase ?? true} onCheckedChange={(v) => updatePlatformSettings.mutate({ passwordRequireUppercase: v })} disabled={platformReadonly} isLoading={updatePlatformSettings.isPending} />
          <SettingsToggle id="passwordRequireLowercase" label="Require lowercase letter" description="Passwords must contain at least one a–z character" checked={platformSettingsData?.passwordRequireLowercase ?? true} onCheckedChange={(v) => updatePlatformSettings.mutate({ passwordRequireLowercase: v })} disabled={platformReadonly} isLoading={updatePlatformSettings.isPending} />
          <SettingsToggle id="passwordRequireNumber" label="Require number" description="Passwords must contain at least one digit" checked={platformSettingsData?.passwordRequireNumber ?? true} onCheckedChange={(v) => updatePlatformSettings.mutate({ passwordRequireNumber: v })} disabled={platformReadonly} isLoading={updatePlatformSettings.isPending} />
          <SettingsToggle id="passwordRequireSpecialChar" label="Require special character" description="Passwords must contain at least one symbol such as !@#$%" checked={platformSettingsData?.passwordRequireSpecialChar ?? true} onCheckedChange={(v) => updatePlatformSettings.mutate({ passwordRequireSpecialChar: v })} disabled={platformReadonly} isLoading={updatePlatformSettings.isPending} />
          <SettingsSelect id="passwordExpiryDays" label="Password expiry" description="Force users to change their password after this many days" value={platformSettingsData?.passwordExpiryDays == null ? "never" : String(platformSettingsData.passwordExpiryDays)} onValueChange={(v) => updatePlatformSettings.mutate({ passwordExpiryDays: v === "never" ? null : parseInt(v, 10) })} options={[{ value: "never", label: "Never expires" }, { value: "30", label: "30 days" }, { value: "60", label: "60 days" }, { value: "90", label: "90 days" }, { value: "180", label: "180 days" }, { value: "365", label: "1 year" }]} disabled={platformReadonly} isLoading={updatePlatformSettings.isPending} />
          <SettingsSelect id="passwordHistoryCount" label="Password history" description="Block reuse of this many of the user's most recent passwords" value={String(platformSettingsData?.passwordHistoryCount ?? 5)} onValueChange={(v) => updatePlatformSettings.mutate({ passwordHistoryCount: parseInt(v, 10) })} options={[{ value: "0", label: "Disabled" }, { value: "3", label: "Last 3" }, { value: "5", label: "Last 5" }, { value: "10", label: "Last 10" }, { value: "24", label: "Last 24" }]} disabled={platformReadonly} isLoading={updatePlatformSettings.isPending} />
          <SettingsSelect id="maxFailedLoginAttempts" label="Account lockout threshold" description="Lock the account after this many consecutive failed logins" value={String(platformSettingsData?.maxFailedLoginAttempts ?? 5)} onValueChange={(v) => updatePlatformSettings.mutate({ maxFailedLoginAttempts: parseInt(v, 10) })} options={[{ value: "3", label: "3 attempts" }, { value: "5", label: "5 attempts" }, { value: "10", label: "10 attempts" }]} disabled={platformReadonly} isLoading={updatePlatformSettings.isPending} />
          <SettingsSelect id="lockoutDurationMinutes" label="Lockout duration" description="How long a locked account stays locked before login is allowed again" value={String(platformSettingsData?.lockoutDurationMinutes ?? 15)} onValueChange={(v) => updatePlatformSettings.mutate({ lockoutDurationMinutes: parseInt(v, 10) })} options={[{ value: "5", label: "5 minutes" }, { value: "15", label: "15 minutes" }, { value: "30", label: "30 minutes" }, { value: "60", label: "1 hour" }, { value: "240", label: "4 hours" }]} disabled={platformReadonly} isLoading={updatePlatformSettings.isPending} />
          <SettingsSelect id="sessionTimeoutMinutes" label="Session timeout" description="Auto-sign-out for both admins and tenant users after inactivity" value={String(platformSettingsData?.sessionTimeoutMinutes ?? 60)} onValueChange={(v) => updatePlatformSettings.mutate({ sessionTimeoutMinutes: parseInt(v, 10) })} options={[{ value: "15", label: "15 minutes" }, { value: "30", label: "30 minutes" }, { value: "60", label: "1 hour" }, { value: "120", label: "2 hours" }, { value: "480", label: "8 hours" }]} disabled={platformReadonly} isLoading={updatePlatformSettings.isPending} />
          <SettingsToggle id="enforceTotpForAdmins" label="Enforce 2FA for platform admins" description="Require every platform admin to complete two-factor authentication at login" checked={platformSettingsData?.enforceTotpForAdmins ?? true} onCheckedChange={(v) => updatePlatformSettings.mutate({ enforceTotpForAdmins: v })} disabled={platformReadonly} isLoading={updatePlatformSettings.isPending} />
          <SettingsToggle id="enforceTotpForTenantUsers" label="Enforce 2FA for tenant users" description="Require every tenant user to complete two-factor authentication at login" checked={platformSettingsData?.enforceTotpForTenantUsers ?? false} onCheckedChange={(v) => updatePlatformSettings.mutate({ enforceTotpForTenantUsers: v })} disabled={platformReadonly} isLoading={updatePlatformSettings.isPending} />
        </div>
      </section>

      <Separator />

      <section>
        <h2 className="text-base font-semibold mb-1">Tenant defaults</h2>
        <p className="text-sm text-muted-foreground mb-4">Default settings applied to new tenants</p>
        <div className="space-y-1">
          <SettingsSelect id="defaultTrialDays" label="Default trial period" description="How many days new tenants get on trial" value={String(platformSettingsData?.defaultTrialDays ?? 14)} onValueChange={(v) => updatePlatformSettings.mutate({ defaultTrialDays: parseInt(v, 10) })} options={[{ value: "7", label: "7 days" }, { value: "14", label: "14 days" }, { value: "30", label: "30 days" }, { value: "60", label: "60 days" }]} disabled={platformReadonly} isLoading={updatePlatformSettings.isPending} />
        </div>
      </section>

      <Separator />

      <section>
        <h2 className="text-base font-semibold mb-1">Feature controls</h2>
        <p className="text-sm text-muted-foreground mb-4">Toggle platform-wide features on or off</p>
        <div className="space-y-1">
          <SettingsToggle
            id="maintenanceMode"
            label="Maintenance mode"
            description="Show a maintenance page to all tenants"
            checked={platformSettingsData?.maintenanceMode ?? false}
            onCheckedChange={(v) => {
              if (v) {
                if (!confirm("Enabling maintenance mode will affect ALL tenants. Are you sure?")) return;
              }
              updatePlatformSettings.mutate({ maintenanceMode: v });
            }}
            disabled={platformReadonly}
            isLoading={updatePlatformSettings.isPending}
          />
          <SettingsToggle id="signupsEnabled" label="Self-service signups" description="Allow new organisations to create accounts" checked={platformSettingsData?.signupsEnabled ?? true} onCheckedChange={(v) => updatePlatformSettings.mutate({ signupsEnabled: v })} disabled={platformReadonly} isLoading={updatePlatformSettings.isPending} />
          <SettingsToggle
            id="selfOnboardingEnabled"
            label="Marketing-site onboarding form"
            description="Accept new submissions from the public marketing-site form. Disabling stops the public endpoint with FEATURE_DISABLED — admins can still work the existing onboarding queue."
            checked={platformSettingsData?.selfOnboardingEnabled ?? true}
            onCheckedChange={(v) => updatePlatformSettings.mutate({ selfOnboardingEnabled: v })}
            disabled={platformReadonly}
            isLoading={updatePlatformSettings.isPending}
          />
          <SettingsToggle id="publicApiEnabled" label="Public API access" description="Allow tenants to use the public API" checked={platformSettingsData?.publicApiEnabled ?? true} onCheckedChange={(v) => updatePlatformSettings.mutate({ publicApiEnabled: v })} disabled={platformReadonly} isLoading={updatePlatformSettings.isPending} />
          <SettingsToggle id="betaFeatures" label="Beta features" description="Unlock experimental features for all tenants" checked={platformSettingsData?.betaFeaturesEnabled ?? false} onCheckedChange={(v) => updatePlatformSettings.mutate({ betaFeaturesEnabled: v })} disabled={platformReadonly} isLoading={updatePlatformSettings.isPending} />
        </div>
      </section>

      <Separator />

      <section>
        <h2 className="text-base font-semibold mb-1">Rate limiting</h2>
        <p className="text-sm text-muted-foreground mb-4">Global API rate limits</p>
        <div className="space-y-1">
          <SettingsSelect id="globalRateLimit" label="Requests per minute" description="Maximum API requests per minute per user" value={String(platformSettingsData?.globalRateLimitPerMinute ?? 80)} onValueChange={(v) => updatePlatformSettings.mutate({ globalRateLimitPerMinute: parseInt(v, 10) })} options={[{ value: "30", label: "30/min" }, { value: "60", label: "60/min" }, { value: "80", label: "80/min" }, { value: "120", label: "120/min" }, { value: "200", label: "200/min" }]} disabled={platformReadonly} isLoading={updatePlatformSettings.isPending} />
          <SettingsSelect id="globalRateBurst" label="Burst limit" description="Maximum burst of requests allowed" value={String(platformSettingsData?.globalRateLimitBurst ?? 20)} onValueChange={(v) => updatePlatformSettings.mutate({ globalRateLimitBurst: parseInt(v, 10) })} options={[{ value: "10", label: "10" }, { value: "20", label: "20" }, { value: "50", label: "50" }, { value: "100", label: "100" }]} disabled={platformReadonly} isLoading={updatePlatformSettings.isPending} />
        </div>
      </section>
    </div>
  );
}

// suppress unused warning — isPrimaryAdmin is used in the page to decide tab visibility
export type { };
