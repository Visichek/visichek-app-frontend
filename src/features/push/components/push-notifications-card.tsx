"use client";

import { Info } from "lucide-react";
import { toast } from "sonner";
import { SettingsToggle } from "@/components/recipes/settings-section";
import { usePushSubscription } from "../hooks";
import { useUpdateUserSettings } from "@/features/settings/hooks";
import { useUpdateNotificationPreferences } from "@/features/notifications/hooks";
import type { PushFailureReason } from "@/types/push";

/**
 * Shared "Push notifications" control for both shells' settings.
 *
 * Drives the real device subscription (the existing `pushNotifications`
 * user-setting toggle used to be a no-op flag). Flow:
 *   - toggle ON  → request permission, register the Service Worker,
 *     subscribe via the backend VAPID key, POST /push/subscriptions
 *   - toggle OFF → DELETE /push/subscriptions, then unsubscribe locally
 *
 * The device subscription is the source of truth for the toggle's checked
 * state. On success we also persist the `pushNotifications` user setting
 * (so the preference survives) and flip the server-side `pushEnabled`
 * gate — both best-effort, since the device state is what actually
 * controls whether pushes arrive on this browser.
 */
export function PushNotificationsCard() {
  const push = usePushSubscription();
  const updateSettings = useUpdateUserSettings();
  const updateNotifPrefs = useUpdateNotificationPreferences();

  const persistPreference = (enabled: boolean) => {
    // Best-effort — never block the user-facing device state on these.
    updateSettings.mutate(
      { pushNotifications: enabled },
      { onError: () => {} },
    );
    updateNotifPrefs.mutate({ pushEnabled: enabled }, { onError: () => {} });
  };

  const handleToggle = async (next: boolean) => {
    if (next) {
      const result = await push.enable();
      if (result.ok) {
        toast.success("Push notifications enabled on this device");
        persistPreference(true);
      } else {
        toast.error(messageForReason(result.reason));
      }
    } else {
      const result = await push.disable();
      if (result.ok) {
        toast.success("Push notifications turned off on this device");
        persistPreference(false);
      } else {
        toast.error("Couldn't fully turn off push. Please try again.");
      }
    }
  };

  // Capability gate: don't offer a toggle the browser can't honour.
  if (!push.isSupported) {
    return (
      <div className="flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          Push notifications aren&apos;t available in this browser. On iPhone
          and iPad, add VisiChek to your Home Screen first, then enable push
          from there.
        </span>
      </div>
    );
  }

  const blocked = push.permission === "denied";

  return (
    <div className="space-y-2">
      <SettingsToggle
        id="pushNotifications"
        label="Push notifications"
        description="Get browser and OS push alerts on this device — even when VisiChek isn't open — for time-sensitive events like check-ins, incidents, and approaching deadlines."
        checked={push.isSubscribed}
        onCheckedChange={handleToggle}
        isLoading={push.isBusy}
        disabled={blocked}
      />
      {blocked && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            Notifications are blocked for this site in your browser settings.
            Re-enable them there, then toggle this on.
          </span>
        </div>
      )}
    </div>
  );
}

/** Map a subscribe failure to actionable copy. */
function messageForReason(reason: PushFailureReason): string {
  switch (reason) {
    case "denied":
      return "Notifications are blocked. Re-enable them in your browser settings to turn push on.";
    case "dismissed":
      return "Permission prompt dismissed — push wasn't enabled. Toggle it again to retry.";
    case "unsupported":
      return "This browser doesn't support push notifications.";
    case "unsupported-provider":
      return "Push isn't available right now. Please try again later.";
    default:
      return "Couldn't enable push notifications. Please try again.";
  }
}
