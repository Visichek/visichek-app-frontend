"use client";

import { Copy, Mail, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NavButton } from "@/components/recipes/nav-button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  SettingsToggle,
  SettingsSelect,
  SettingsTextEdit,
} from "@/components/recipes/settings-section";
import { CopyableId } from "@/components/settings/copyable-id";
import { GeofencingSection } from "./geofencing-section";
import {
  useSettingsManifest,
  useSettingsSection,
  useTenantSettings,
  useUpdateTenantSettings,
} from "@/features/settings/hooks";
import { useOrgContact } from "@/features/branches/hooks/use-branches";
import { useCapability } from "@/features/limitations/hooks/use-limitations";
import { LockedOverlay } from "@/features/limitations/components/locked-overlay";

export function AdvancedTab() {
  const { data: manifest } = useSettingsManifest();
  const deletionSection = useSettingsSection(manifest, "account_deletion");
  const tenantSettingsSection = useSettingsSection(manifest, "tenant_settings");
  const profile = manifest?.profile;
  const tenantId = profile?.tenantId ?? "";

  const { data: tenantSettingsData } = useTenantSettings(tenantId);
  const updateTenantSettings = useUpdateTenantSettings(tenantId);

  // Organization point of contact (WS4): the main super admin card.
  // Only fetched when the manifest exposes tenant settings (i.e. the
  // viewer is a super_admin — the endpoint 403s for everyone else).
  const { data: orgContact } = useOrgContact(!!tenantSettingsSection);

  // Free-plan gating for the three sections the backend should refuse
  // to persist on Free (see `new-limitations.txt` § "Settings sections
  // gated on Free plan"):
  //
  //   - Email preferences   → hidden entirely on Free
  //   - Visitor policies    → hidden entirely on Free
  //   - Geofencing          → wrapped in <LockedOverlay/> so the user
  //     sees "this exists, upgrade to unlock" rather than the section
  //     disappearing
  //
  // We honour both the formal `deniedFeatures` keys (`email_preferences`,
  // `visitor_policies`, `geofencing`) AND the current plan tier so the
  // gate works the moment we ship even if the backend feature keys
  // arrive in a later deploy.
  const { isFreePlan, denied, isLoading: capsLoading } = useCapability();
  const hideEmailPrefs = !capsLoading && (isFreePlan || denied("email_preferences"));
  const hideVisitorPolicies =
    !capsLoading && (isFreePlan || denied("visitor_policies"));
  const lockGeofencing = !capsLoading && (isFreePlan || denied("geofencing"));

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
          {profile?.tenantId && <CopyableId label="Organization ID" value={profile.tenantId} />}
          {profile?.id && <CopyableId label="User ID" value={profile.id} />}
        </div>
      </section>

      {tenantSettingsSection && tenantSettingsData && (
        <>
          <Separator />

          {!hideVisitorPolicies && (
            <>
              <section>
                <h2 className="text-base font-semibold mb-1">Visitor policies</h2>
                <p className="text-sm text-muted-foreground mb-4">Rules for how visitors are checked in and managed</p>
                <div className="space-y-1">
                  <SettingsToggle id="requireIdScan" label="Require ID scan" description="Mandate identity document scanning during check-in" checked={tenantSettingsData.requireIdScan ?? false} onCheckedChange={(v) => updateTenantSettings.mutate({ requireIdScan: v })} isLoading={updateTenantSettings.isPending} />
                  <SettingsToggle id="requireHostApproval" label="Require host approval" description="Visitor must be approved by their host before completing check-in" checked={tenantSettingsData.requireHostApproval ?? false} onCheckedChange={(v) => updateTenantSettings.mutate({ requireHostApproval: v })} isLoading={updateTenantSettings.isPending} />
                  <SettingsToggle id="requireConsent" label="Require NDPA consent" description="Visitors must acknowledge a data protection notice before check-in" checked={tenantSettingsData.requireConsentBeforeCheckIn ?? true} onCheckedChange={(v) => updateTenantSettings.mutate({ requireConsentBeforeCheckIn: v })} isLoading={updateTenantSettings.isPending} />
                  <SettingsToggle id="allowSelfRegistration" label="Self-registration via QR" description="Allow visitors to register themselves by scanning a public QR code" checked={tenantSettingsData.allowSelfRegistration ?? false} onCheckedChange={(v) => updateTenantSettings.mutate({ allowSelfRegistration: v })} isLoading={updateTenantSettings.isPending} />
                  <SettingsToggle
                    id="autoCheckoutEnabled"
                    label="Automatic checkout"
                    description="Visitors still shown as on-site after this long are checked out automatically; the time and reason are recorded"
                    checked={
                      (tenantSettingsData.autoCheckoutAfterHours ?? 0) > 0
                    }
                    onCheckedChange={(v) =>
                      updateTenantSettings.mutate({
                        autoCheckoutAfterHours: v ? 12 : null,
                      })
                    }
                    isLoading={updateTenantSettings.isPending}
                  />
                  {(tenantSettingsData.autoCheckoutAfterHours ?? 0) > 0 && (
                    <SettingsTextEdit
                      id="autoCheckoutAfterHours"
                      label="Check out after"
                      description="Hours a visitor can stay on-site before the automatic checkout runs (1-48)"
                      value={String(tenantSettingsData.autoCheckoutAfterHours)}
                      inputMode="numeric"
                      placeholder="12"
                      validate={(v) => {
                        const n = Number(v);
                        if (!Number.isInteger(n) || n < 1 || n > 48) {
                          return "Enter a whole number of hours between 1 and 48";
                        }
                        return null;
                      }}
                      onSave={(v) =>
                        updateTenantSettings.mutate({
                          autoCheckoutAfterHours: parseInt(v, 10),
                        })
                      }
                      isLoading={updateTenantSettings.isPending}
                    />
                  )}
                  <SettingsSelect id="badgeExpiry" label="Badge expiry" description="When visitor badges become invalid" value={tenantSettingsData.visitorBadgeExpiry ?? "end_of_day"} onValueChange={(v) => updateTenantSettings.mutate({ visitorBadgeExpiry: v as "end_of_day" | "manual" | "hours" })} options={[{ value: "end_of_day", label: "End of day" }, { value: "manual", label: "Manual" }, { value: "hours", label: "After set hours" }]} isLoading={updateTenantSettings.isPending} />
                </div>
              </section>

              <Separator />
            </>
          )}

          <LockedOverlay
            locked={lockGeofencing}
            featureKey="geofencing"
            title="Geofencing"
          >
            <section>
              <h2 className="text-base font-semibold mb-1">Geofencing</h2>
              <p className="text-sm text-muted-foreground mb-4">Require visitors to be on-site before their check-in is accepted. Off by default; enable only after updating your privacy notice.</p>
              <GeofencingSection settings={tenantSettingsData} />
            </section>
          </LockedOverlay>

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
              <SettingsTextEdit
                id="companyName"
                label="Company name"
                description="Displayed on badges and visitor-facing pages"
                value={tenantSettingsData.companyName}
                placeholder="Acme Ltd."
                onSave={(v) => updateTenantSettings.mutate({ companyName: v.length > 0 ? v : null })}
                isLoading={updateTenantSettings.isPending}
              />
              <SettingsTextEdit
                id="companyEmail"
                label="Company email"
                description="Contact email for the organisation"
                value={tenantSettingsData.companyEmail}
                type="email"
                inputMode="email"
                placeholder="hello@acme.com"
                validate={(v) => {
                  if (v.length === 0) return null;
                  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : "Enter a valid email address";
                }}
                onSave={(v) => updateTenantSettings.mutate({ companyEmail: v.length > 0 ? v : null })}
                isLoading={updateTenantSettings.isPending}
              />
              <SettingsSelect
                id="defaultTimezone"
                label="Default timezone"
                description="Organisation-wide timezone for scheduling and reports"
                value={tenantSettingsData.defaultTimezone ?? "Africa/Lagos"}
                onValueChange={(v) => updateTenantSettings.mutate({ defaultTimezone: v })}
                options={[
                  { value: "Africa/Lagos", label: "Africa/Lagos" },
                  { value: "Africa/Cairo", label: "Africa/Cairo" },
                  { value: "Africa/Johannesburg", label: "Africa/Johannesburg" },
                  { value: "Africa/Nairobi", label: "Africa/Nairobi" },
                  { value: "Europe/London", label: "Europe/London" },
                  { value: "Europe/Paris", label: "Europe/Paris" },
                  { value: "Europe/Berlin", label: "Europe/Berlin" },
                  { value: "America/New_York", label: "America/New York" },
                  { value: "America/Chicago", label: "America/Chicago" },
                  { value: "America/Los_Angeles", label: "America/Los Angeles" },
                  { value: "Asia/Dubai", label: "Asia/Dubai" },
                  { value: "Asia/Tokyo", label: "Asia/Tokyo" },
                  { value: "Asia/Singapore", label: "Asia/Singapore" },
                  { value: "Australia/Sydney", label: "Australia/Sydney" },
                  { value: "UTC", label: "UTC" },
                ]}
                isLoading={updateTenantSettings.isPending}
              />
            </div>

            {orgContact && (
              <div className="mt-4 rounded-lg border p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                    <UserRound
                      className="h-4 w-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">Organization contact</p>
                    <p className="text-sm truncate">
                      {orgContact.fullName || "Main administrator"}
                    </p>
                    {orgContact.email && (
                      <p className="text-xs text-muted-foreground truncate">
                        {orgContact.email}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      The main administrator is your organization&apos;s point
                      of contact. To change who holds this role, use the
                      transfer flow on the Users page.
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {orgContact.email && (
                      <>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-9 w-9"
                              onClick={() => {
                                navigator.clipboard
                                  .writeText(orgContact.email ?? "")
                                  .then(() => toast.success("Email copied"))
                                  .catch(() =>
                                    toast.error("Couldn't copy the email"),
                                  );
                              }}
                              aria-label="Copy organization contact email"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            Copy the contact&apos;s email address
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-9 w-9"
                              asChild
                            >
                              <a
                                href={`mailto:${orgContact.email}`}
                                aria-label="Email the organization contact"
                              >
                                <Mail className="h-3.5 w-3.5" />
                              </a>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            Open your mail app to email the contact
                          </TooltipContent>
                        </Tooltip>
                      </>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <NavButton
                          href="/app/users"
                          size="sm"
                          variant="outline"
                          className="min-h-[36px]"
                        >
                          Manage
                        </NavButton>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        Open Users to transfer the main administrator role
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>
            )}
          </section>

          {!hideEmailPrefs && (
            <>
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
        </>
      )}
    </div>
  );
}
