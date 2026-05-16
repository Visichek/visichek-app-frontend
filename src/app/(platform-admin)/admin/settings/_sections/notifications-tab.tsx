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
  useUserSettings,
  useUpdateUserSettings,
} from "@/features/settings/hooks";
import { useSendTestNotification } from "@/features/notifications/hooks";
import type { UserSettingsUpdate, DigestFrequency } from "@/types/settings";

/**
 * Platform-admin notification settings (Issue 6).
 *
 * Adds:
 *   - success toasts on save (used to fail silently except for errors),
 *   - "Send test email" button so admins can confirm SMTP routing
 *     end-to-end before relying on automated emails,
 *   - tightened copy on the master email toggle so admins know it
 *     short-circuits every event toggle below.
 */
export function NotificationsTab() {
  const { data: userSettings } = useUserSettings();
  const updateSettings = useUpdateUserSettings();
  const sendTest = useSendTestNotification();

  const masterEmailEnabled = userSettings?.emailNotifications ?? true;

  const handleUpdate = (patch: UserSettingsUpdate) => {
    updateSettings.mutate(patch, {
      onSuccess: () => toast.success("Preferences saved"),
      onError: (err) =>
        toast.error(err instanceof Error ? err.message : "Failed to save"),
    });
  };

  const handleSendTest = () => {
    sendTest.mutate(undefined, {
      onSuccess: (result) => {
        if (result.delivered) {
          toast.success("Test sent — check your inbox shortly.");
        } else {
          toast.warning(
            result.skippedReason
              ? `Test skipped: ${result.skippedReason.replace(/_/g, " ")}`
              : result.message ?? "Test wasn't sent. Check your settings.",
          );
        }
      },
      onError: (err) =>
        toast.error(
          err instanceof Error ? err.message : "Couldn't send test email",
        ),
    });
  };

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-base font-semibold mb-1">Notification channels</h2>
        <p className="text-sm text-muted-foreground mb-4">
          How you receive alerts and updates
        </p>
        <div className="space-y-1">
          <SettingsToggle
            id="emailNotifications"
            label="Email notifications"
            description="Master switch — when this is off none of the platform's automated emails reach you, including system alerts and the test message below."
            checked={masterEmailEnabled}
            onCheckedChange={(v) =>
              handleUpdate({ emailNotifications: v })
            }
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
          <SettingsToggle
            id="notifyOnSystemAlert"
            label="System alerts"
            description="Be notified when the platform triggers a system-level alert (job failures, infrastructure errors, security signals)."
            checked={userSettings?.notifyOnSystemAlert ?? true}
            onCheckedChange={(v) =>
              handleUpdate({ notifyOnSystemAlert: v })
            }
            isLoading={updateSettings.isPending}
          />
        </div>

        {/* Issue 6: test email entry point so admins can confirm the
            email provider is wired up without waiting for a real
            event to fire. */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-md border bg-muted/40 px-4 py-3">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <span>
              Send yourself a test notification using your current preferences.
              Useful when validating SMTP configuration after a provider switch.
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
                ? "Fires POST /notifications/test using your account's email and current preferences."
                : "Turn on Email notifications above to enable the test."}
            </TooltipContent>
          </Tooltip>
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
    </div>
  );
}
