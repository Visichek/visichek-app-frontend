"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { SettingsInfo, SettingsToggle, SettingsSelect } from "@/components/recipes/settings-section";
import { CopyableId } from "@/components/settings/copyable-id";
import { GeofencingSection } from "./geofencing-section";
import {
  useSettingsManifest,
  useSettingsSection,
  useTenantSettings,
  useUpdateTenantSettings,
} from "@/features/settings/hooks";

export function AdvancedTab() {
  const { data: manifest } = useSettingsManifest();
  const deletionSection = useSettingsSection(manifest, "account_deletion");
  const tenantSettingsSection = useSettingsSection(manifest, "tenant_settings");
  const profile = manifest?.profile;
  const tenantId = profile?.tenantId ?? "";

  const { data: tenantSettingsData } = useTenantSettings(tenantId);
  const updateTenantSettings = useUpdateTenantSettings(tenantId);

  return (
    <div className="space-y-6">
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

      <section>
        <div className="space-y-1">
          {profile?.tenantId && <CopyableId label="Tenant ID" value={profile.tenantId} />}
          {profile?.id && <CopyableId label="User ID" value={profile.id} />}
        </div>
      </section>

      {tenantSettingsSection && tenantSettingsData && (
        <>
          <Separator />
          <section>
            <h2 className="text-base font-semibold mb-1">Security policies</h2>
            <p className="text-sm text-muted-foreground mb-4">Organisation-wide security rules applied to all users</p>
            <div className="space-y-1">
              <SettingsToggle id="enforceTotp" label="Enforce 2FA for all users" description="Require every user to set up two-factor authentication before they can log in" checked={tenantSettingsData.enforceTotp ?? false} onCheckedChange={(v) => updateTenantSettings.mutate({ enforceTotp: v })} isLoading={updateTenantSettings.isPending} />
              <SettingsSelect id="passwordMinLength" label="Minimum password length" description="Minimum characters required for passwords" value={String(tenantSettingsData.passwordMinLength ?? 8)} onValueChange={(v) => updateTenantSettings.mutate({ passwordMinLength: parseInt(v, 10) })} options={[{ value: "8", label: "8 characters" }, { value: "10", label: "10 characters" }, { value: "12", label: "12 characters" }, { value: "16", label: "16 characters" }]} isLoading={updateTenantSettings.isPending} />
              <SettingsSelect id="sessionTimeout" label="Session timeout" description="Automatically sign out users after inactivity" value={String(tenantSettingsData.sessionTimeoutMinutes ?? 60)} onValueChange={(v) => updateTenantSettings.mutate({ sessionTimeoutMinutes: parseInt(v, 10) })} options={[{ value: "15", label: "15 minutes" }, { value: "30", label: "30 minutes" }, { value: "60", label: "1 hour" }, { value: "120", label: "2 hours" }, { value: "480", label: "8 hours" }]} isLoading={updateTenantSettings.isPending} />
              <SettingsSelect id="maxFailedLogins" label="Account lockout threshold" description="Lock account after this many failed login attempts" value={String(tenantSettingsData.maxFailedLoginAttempts ?? 5)} onValueChange={(v) => updateTenantSettings.mutate({ maxFailedLoginAttempts: parseInt(v, 10) })} options={[{ value: "3", label: "3 attempts" }, { value: "5", label: "5 attempts" }, { value: "10", label: "10 attempts" }]} isLoading={updateTenantSettings.isPending} />
              <SettingsSelect id="lockoutDuration" label="Lockout duration" description="How long accounts stay locked after exceeding the threshold" value={String(tenantSettingsData.lockoutDurationMinutes ?? 30)} onValueChange={(v) => updateTenantSettings.mutate({ lockoutDurationMinutes: parseInt(v, 10) })} options={[{ value: "5", label: "5 minutes" }, { value: "15", label: "15 minutes" }, { value: "30", label: "30 minutes" }, { value: "60", label: "1 hour" }]} isLoading={updateTenantSettings.isPending} />
            </div>
          </section>

          <Separator />

          <section>
            <h2 className="text-base font-semibold mb-1">Visitor policies</h2>
            <p className="text-sm text-muted-foreground mb-4">Rules for how visitors are checked in and managed</p>
            <div className="space-y-1">
              <SettingsToggle id="requireIdScan" label="Require ID scan" description="Mandate identity document scanning during check-in" checked={tenantSettingsData.requireIdScan ?? false} onCheckedChange={(v) => updateTenantSettings.mutate({ requireIdScan: v })} isLoading={updateTenantSettings.isPending} />
              <SettingsToggle id="requireHostApproval" label="Require host approval" description="Visitor must be approved by their host before completing check-in" checked={tenantSettingsData.requireHostApproval ?? false} onCheckedChange={(v) => updateTenantSettings.mutate({ requireHostApproval: v })} isLoading={updateTenantSettings.isPending} />
              <SettingsToggle id="requireConsent" label="Require NDPA consent" description="Visitors must acknowledge a data protection notice before check-in" checked={tenantSettingsData.requireConsentBeforeCheckIn ?? true} onCheckedChange={(v) => updateTenantSettings.mutate({ requireConsentBeforeCheckIn: v })} isLoading={updateTenantSettings.isPending} />
              <SettingsToggle id="allowSelfRegistration" label="Self-registration via QR" description="Allow visitors to register themselves by scanning a public QR code" checked={tenantSettingsData.allowSelfRegistration ?? false} onCheckedChange={(v) => updateTenantSettings.mutate({ allowSelfRegistration: v })} isLoading={updateTenantSettings.isPending} />
              <SettingsSelect id="autoCheckout" label="Auto checkout" description="Automatically check visitors out after a set duration" value={tenantSettingsData.autoCheckoutAfterHours ? String(tenantSettingsData.autoCheckoutAfterHours) : "disabled"} onValueChange={(v) => updateTenantSettings.mutate({ autoCheckoutAfterHours: v === "disabled" ? null : parseInt(v, 10) })} options={[{ value: "disabled", label: "Disabled" }, { value: "4", label: "4 hours" }, { value: "8", label: "8 hours" }, { value: "12", label: "12 hours" }]} isLoading={updateTenantSettings.isPending} />
              <SettingsSelect id="badgeExpiry" label="Badge expiry" description="When visitor badges become invalid" value={tenantSettingsData.visitorBadgeExpiry ?? "end_of_day"} onValueChange={(v) => updateTenantSettings.mutate({ visitorBadgeExpiry: v as "end_of_day" | "manual" | "hours" })} options={[{ value: "end_of_day", label: "End of day" }, { value: "manual", label: "Manual" }, { value: "hours", label: "After set hours" }]} isLoading={updateTenantSettings.isPending} />
            </div>
          </section>

          <Separator />

          <section>
            <h2 className="text-base font-semibold mb-1">Geofencing</h2>
            <p className="text-sm text-muted-foreground mb-4">Require visitors to be on-site before their check-in is accepted. Off by default; enable only after updating your privacy notice.</p>
            <GeofencingSection settings={tenantSettingsData} />
          </section>

          <Separator />

          <section>
            <h2 className="text-base font-semibold mb-1">Data retention</h2>
            <p className="text-sm text-muted-foreground mb-4">How long data is kept before automatic cleanup</p>
            <div className="space-y-1">
              <SettingsSelect id="visitorRetention" label="Visitor data" description="Automatically delete visitor records after this period" value={String(tenantSettingsData.visitorDataRetentionDays ?? 365)} onValueChange={(v) => updateTenantSettings.mutate({ visitorDataRetentionDays: parseInt(v, 10) })} options={[{ value: "90", label: "90 days" }, { value: "180", label: "180 days" }, { value: "365", label: "1 year" }, { value: "730", label: "2 years" }]} isLoading={updateTenantSettings.isPending} />
              <SettingsSelect id="auditRetention" label="Audit logs" description="Automatically delete audit log entries after this period" value={String(tenantSettingsData.auditLogRetentionDays ?? 730)} onValueChange={(v) => updateTenantSettings.mutate({ auditLogRetentionDays: parseInt(v, 10) })} options={[{ value: "90", label: "90 days" }, { value: "180", label: "180 days" }, { value: "365", label: "1 year" }, { value: "730", label: "2 years" }, { value: "1825", label: "5 years" }]} isLoading={updateTenantSettings.isPending} />
              <SettingsSelect id="incidentRetention" label="Incidents" description="Automatically delete incident records after this period" value={String(tenantSettingsData.incidentRetentionDays ?? 730)} onValueChange={(v) => updateTenantSettings.mutate({ incidentRetentionDays: parseInt(v, 10) })} options={[{ value: "365", label: "1 year" }, { value: "730", label: "2 years" }, { value: "1825", label: "5 years" }]} isLoading={updateTenantSettings.isPending} />
              <SettingsSelect id="deletionAction" label="On expiry" description="Permanently delete or anonymise expired records" value={tenantSettingsData.deletionAction ?? "anonymise"} onValueChange={(v) => updateTenantSettings.mutate({ deletionAction: v as "delete" | "anonymise" })} options={[{ value: "delete", label: "Permanently delete" }, { value: "anonymise", label: "Anonymise" }]} isLoading={updateTenantSettings.isPending} />
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
              <SettingsToggle id="sendWelcomeEmail" label="Welcome email" description="Send a welcome email when new staff accounts are created" checked={tenantSettingsData.sendWelcomeEmail ?? true} onCheckedChange={(v) => updateTenantSettings.mutate({ sendWelcomeEmail: v })} isLoading={updateTenantSettings.isPending} />
              <SettingsToggle id="sendHostNotification" label="Host arrival notification" description="Notify hosts via email when their visitor arrives" checked={tenantSettingsData.sendHostNotificationOnArrival ?? true} onCheckedChange={(v) => updateTenantSettings.mutate({ sendHostNotificationOnArrival: v })} isLoading={updateTenantSettings.isPending} />
              <SettingsToggle id="sendVisitorBadgeEmail" label="Visitor badge email" description="Email the visitor badge to the visitor after check-in" checked={tenantSettingsData.sendVisitorBadgeEmail ?? false} onCheckedChange={(v) => updateTenantSettings.mutate({ sendVisitorBadgeEmail: v })} isLoading={updateTenantSettings.isPending} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
