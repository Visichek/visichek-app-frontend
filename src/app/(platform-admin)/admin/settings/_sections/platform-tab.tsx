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
        <h2 className="text-base font-semibold mb-1">Security</h2>
        <p className="text-sm text-muted-foreground mb-4">Admin-specific security settings</p>
        <div className="space-y-1">
          <SettingsToggle id="adminEnforceTotp" label="Enforce admin 2FA" description="Require two-factor authentication for all admin accounts" checked={platformSettingsData?.adminEnforceTotp ?? false} onCheckedChange={(v) => updatePlatformSettings.mutate({ adminEnforceTotp: v })} disabled={platformReadonly} />
          <SettingsSelect id="adminSessionTimeout" label="Admin session timeout" description="Auto-logout admin accounts after inactivity" value={String(platformSettingsData?.adminSessionTimeoutMinutes ?? 30)} onValueChange={(v) => updatePlatformSettings.mutate({ adminSessionTimeoutMinutes: parseInt(v, 10) })} options={[{ value: "15", label: "15 minutes" }, { value: "30", label: "30 minutes" }, { value: "60", label: "1 hour" }, { value: "120", label: "2 hours" }]} disabled={platformReadonly} />
          <SettingsSelect id="adminPasswordMinLength" label="Admin password minimum length" description="Minimum characters required for admin passwords" value={String(platformSettingsData?.adminPasswordMinLength ?? 12)} onValueChange={(v) => updatePlatformSettings.mutate({ adminPasswordMinLength: parseInt(v, 10) })} options={[{ value: "8", label: "8 characters" }, { value: "10", label: "10 characters" }, { value: "12", label: "12 characters" }, { value: "16", label: "16 characters" }]} disabled={platformReadonly} />
        </div>
      </section>

      <Separator />

      <section>
        <h2 className="text-base font-semibold mb-1">Tenant defaults</h2>
        <p className="text-sm text-muted-foreground mb-4">Default settings applied to new tenants</p>
        <div className="space-y-1">
          <SettingsSelect id="defaultTrialDays" label="Default trial period" description="How many days new tenants get on trial" value={String(platformSettingsData?.defaultTrialDays ?? 14)} onValueChange={(v) => updatePlatformSettings.mutate({ defaultTrialDays: parseInt(v, 10) })} options={[{ value: "7", label: "7 days" }, { value: "14", label: "14 days" }, { value: "30", label: "30 days" }, { value: "60", label: "60 days" }]} disabled={platformReadonly} />
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
          />
          <SettingsToggle id="signupsEnabled" label="Self-service signups" description="Allow new organisations to create accounts" checked={platformSettingsData?.signupsEnabled ?? true} onCheckedChange={(v) => updatePlatformSettings.mutate({ signupsEnabled: v })} disabled={platformReadonly} />
          <SettingsToggle id="publicApiEnabled" label="Public API access" description="Allow tenants to use the public API" checked={platformSettingsData?.publicApiEnabled ?? true} onCheckedChange={(v) => updatePlatformSettings.mutate({ publicApiEnabled: v })} disabled={platformReadonly} />
          <SettingsToggle id="betaFeatures" label="Beta features" description="Unlock experimental features for all tenants" checked={platformSettingsData?.betaFeaturesEnabled ?? false} onCheckedChange={(v) => updatePlatformSettings.mutate({ betaFeaturesEnabled: v })} disabled={platformReadonly} />
        </div>
      </section>

      <Separator />

      <section>
        <h2 className="text-base font-semibold mb-1">Rate limiting</h2>
        <p className="text-sm text-muted-foreground mb-4">Global API rate limits</p>
        <div className="space-y-1">
          <SettingsSelect id="globalRateLimit" label="Requests per minute" description="Maximum API requests per minute per user" value={String(platformSettingsData?.globalRateLimitPerMinute ?? 80)} onValueChange={(v) => updatePlatformSettings.mutate({ globalRateLimitPerMinute: parseInt(v, 10) })} options={[{ value: "30", label: "30/min" }, { value: "60", label: "60/min" }, { value: "80", label: "80/min" }, { value: "120", label: "120/min" }, { value: "200", label: "200/min" }]} disabled={platformReadonly} />
          <SettingsSelect id="globalRateBurst" label="Burst limit" description="Maximum burst of requests allowed" value={String(platformSettingsData?.globalRateLimitBurst ?? 20)} onValueChange={(v) => updatePlatformSettings.mutate({ globalRateLimitBurst: parseInt(v, 10) })} options={[{ value: "10", label: "10" }, { value: "20", label: "20" }, { value: "50", label: "50" }, { value: "100", label: "100" }]} disabled={platformReadonly} />
        </div>
      </section>
    </div>
  );
}

// suppress unused warning — isPrimaryAdmin is used in the page to decide tab visibility
export type { };
