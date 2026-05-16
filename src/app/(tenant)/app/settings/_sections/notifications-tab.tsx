"use client";

import { Info, Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  SettingsToggle,
  SettingsSelect,
} from "@/components/recipes/settings-section";
import {
  useSettingsManifest,
  useSettingsSection,
  useUserSettings,
  useUpdateUserSettings,
} from "@/features/settings/hooks";
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
  useSendTestNotification,
} from "@/features/notifications/hooks";
import type { UserSettingsUpdate, DigestFrequency } from "@/types/settings";
import type { NotificationPreferencesUpdate } from "@/types/notification";

/**
 * Tenant notification settings (Issue 6).
 *
 * Improvements over the previous version:
 *   - Master "Email notifications" toggle drives whether any of the
 *     event toggles below produce email. We surface an inline info
 *     banner explaining the dependency so a user who toggles only
 *     the event row doesn't wonder why no email arrives.
 *   - Each event toggle keeps its existing description; we add a
 *     tooltip that explains the specific backend events the toggle
 *     covers so "Visitor check-in" doesn't read as ambiguous.
 *   - A "Send test email" button fires `POST /notifications/test` so
 *     the user can confirm their preferences and the platform's
 *     email provider actually deliver. The button is disabled while
 *     email is off in the master toggle and shows a clear toast on
 *     success / failure.
 */
export function NotificationsTab() {
  const { data: manifest } = useSettingsManifest();
  const notifsSection = useSettingsSection(manifest, "notifications");

  const { data: userSettings } = useUserSettings();
  const updateSettings = useUpdateUserSettings();

  const { data: notifPrefs } = useNotificationPreferences();
  const updateNotifPrefs = useUpdateNotificationPreferences();
  const sendTest = useSendTestNotification();

  const masterEmailEnabled = userSettings?.emailNotifications ?? true;

  const handleUpdate = (patch: UserSettingsUpdate) => {
    updateSettings.mutate(patch, {
      onSuccess: () => toast.success("Preferences saved"),
      onError: (err) =>
        toast.error(err instanceof Error ? err.message : "Failed to save"),
    });
  };

  const handleNotifUpdate = (patch: NotificationPreferencesUpdate) => {
    updateNotifPrefs.mutate(patch, {
      onSuccess: () => toast.success("Event alert preference saved"),
      onError: (err) =>
        toast.error(err instanceof Error ? err.message : "Failed to save"),
    });
  };

  const handleSendTest = () => {
    sendTest.mutate(undefined, {
      onSuccess: (result) => {
        if (result.delivered) {
          toast.success(
            "Test sent — check your inbox in the next minute or two.",
          );
        } else {
          toast.warning(
            result.skippedReason
              ? `Test skipped: ${humanizeSkipReason(result.skippedReason)}`
              : result.message ?? "Test wasn't sent. Check your settings.",
          );
        }
      },
      onError: (err) => {
        const msg = err instanceof Error ? err.message : "Couldn't send test email";
        toast.error(msg);
      },
    });
  };

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-base font-semibold mb-1">Channels</h2>
        <p className="text-sm text-muted-foreground mb-4">
          How you receive alerts
        </p>
        <div className="space-y-1">
          <SettingsToggle
            id="emailNotifications"
            label="Email notifications"
            description="Master switch — when this is off, none of the event alerts below send email (in-app notifications still show in your bell menu)."
            checked={masterEmailEnabled}
            onCheckedChange={(v) => handleUpdate({ emailNotifications: v })}
            isLoading={updateSettings.isPending}
          />
          <SettingsToggle
            id="pushNotifications"
            label="Push notifications"
            description="Get browser push notifications for time-sensitive alerts"
            checked={userSettings?.pushNotifications ?? false}
            onCheckedChange={(v) => handleUpdate({ pushNotifications: v })}
            isLoading={updateSettings.isPending}
          />
        </div>

        {/* Issue 6: surface the master-toggle dependency + test email entry. */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-md border bg-muted/40 px-4 py-3">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <span>
              Verify your email setup with a single test message — you should
              see it within a minute if everything is configured correctly.
            </span>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSendTest}
                disabled={sendTest.isPending || !masterEmailEnabled}
                className="min-h-[36px]"
              >
                {sendTest.isPending ? (
                  <Loader2
                    className="mr-2 h-3.5 w-3.5 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <MailCheck
                    className="mr-2 h-3.5 w-3.5"
                    aria-hidden="true"
                  />
                )}
                Send test email
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              {masterEmailEnabled
                ? "Send a test notification to your account email using your current preferences."
                : "Turn on Email notifications above to enable the test."}
            </TooltipContent>
          </Tooltip>
        </div>
      </section>

      {notifsSection && (
        <>
          <Separator />
          <section>
            <h2 className="text-base font-semibold mb-1">Event alerts</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Choose which events trigger notifications. Email delivery for any
              row below also requires the master <strong>Email notifications</strong>
              toggle above.
            </p>
            <div className="space-y-1">
              <SettingsToggle
                id="emailOnVisitorCheckIn"
                label="Visitor check-in"
                description="Fires whenever a visitor checks in through the kiosk, a QR scan, or a receptionist-driven check-in."
                checked={notifPrefs?.emailOnVisitorCheckIn ?? false}
                onCheckedChange={(v) =>
                  handleNotifUpdate({ emailOnVisitorCheckIn: v })
                }
                isLoading={updateNotifPrefs.isPending}
              />
              <SettingsToggle
                id="emailOnAppointmentReminder"
                label="Appointment reminders"
                description="A pre-visit reminder for hosts and scheduled visitors. Sends once before the appointment window opens."
                checked={notifPrefs?.emailOnAppointmentReminder ?? true}
                onCheckedChange={(v) =>
                  handleNotifUpdate({ emailOnAppointmentReminder: v })
                }
                isLoading={updateNotifPrefs.isPending}
              />
              <SettingsToggle
                id="emailOnIncident"
                label="Incident alerts"
                description="A new security incident has been logged. Includes incidents approaching the 72-hour NDPC notification deadline."
                checked={notifPrefs?.emailOnIncident ?? true}
                onCheckedChange={(v) =>
                  handleNotifUpdate({ emailOnIncident: v })
                }
                isLoading={updateNotifPrefs.isPending}
              />
              <SettingsToggle
                id="emailOnDsrReceived"
                label="Data subject requests"
                description="A new access, correction, deletion, or consent-withdrawal request landed in your DPO queue."
                checked={notifPrefs?.emailOnDsrReceived ?? true}
                onCheckedChange={(v) =>
                  handleNotifUpdate({ emailOnDsrReceived: v })
                }
                isLoading={updateNotifPrefs.isPending}
              />
              <SettingsToggle
                id="emailOnSubscriptionAlert"
                label="Subscription alerts"
                description="Trial expiry, failed payment, plan change, or other billing events that need a tenant admin to look."
                checked={notifPrefs?.emailOnSubscriptionAlert ?? true}
                onCheckedChange={(v) =>
                  handleNotifUpdate({ emailOnSubscriptionAlert: v })
                }
                isLoading={updateNotifPrefs.isPending}
              />
              <SettingsToggle
                id="emailOnNewUser"
                label="New user added"
                description="A new system user (receptionist, dept admin, etc.) was added to your tenant — useful for auditors."
                checked={notifPrefs?.emailOnNewUser ?? false}
                onCheckedChange={(v) =>
                  handleNotifUpdate({ emailOnNewUser: v })
                }
                isLoading={updateNotifPrefs.isPending}
              />
              <SettingsToggle
                id="emailOnSupportCase"
                label="Support case updates"
                description="Get emailed when VisiChek Support replies to one of your open cases, or transitions a case status."
                checked={notifPrefs?.emailOnSupportCase ?? true}
                onCheckedChange={(v) =>
                  handleNotifUpdate({ emailOnSupportCase: v })
                }
                isLoading={updateNotifPrefs.isPending}
              />
            </div>
          </section>

          <Separator />

          <section>
            <h2 className="text-base font-semibold mb-1">Digest</h2>
            <p className="text-sm text-muted-foreground mb-4">
              How often non-urgent notifications are batched
            </p>
            <SettingsSelect
              id="digestFrequency"
              label="Frequency"
              description="Batching interval for non-urgent alerts"
              value={userSettings?.digestFrequency ?? "realtime"}
              onValueChange={(v) =>
                handleUpdate({ digestFrequency: v as DigestFrequency })
              }
              options={[
                { value: "realtime", label: "Realtime" },
                { value: "hourly", label: "Hourly" },
                { value: "daily", label: "Daily" },
                { value: "weekly", label: "Weekly" },
                { value: "none", label: "None" },
              ]}
              isLoading={updateSettings.isPending}
            />
          </section>
        </>
      )}
    </div>
  );
}

/**
 * Convert a backend-supplied skip reason into copy a user can act on.
 * Falls back to the raw reason so a new code we haven't mapped yet
 * still surfaces something meaningful.
 */
function humanizeSkipReason(code: string): string {
  switch (code) {
    case "email_disabled_in_preferences":
      return "your master Email notifications toggle is off.";
    case "smtp_not_configured":
      return "the platform's email provider isn't configured yet. Contact support.";
    case "missing_recipient_email":
      return "your account doesn't have a verified email on file.";
    case "rate_limited":
      return "you've hit the test-email rate limit — try again in a few minutes.";
    default:
      return code.replace(/_/g, " ");
  }
}
