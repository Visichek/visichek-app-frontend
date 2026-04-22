"use client";

import { Separator } from "@/components/ui/separator";
import { SettingsToggle, SettingsSelect } from "@/components/recipes/settings-section";
import {
  useSettingsManifest,
  useSettingsSection,
  useUserSettings,
  useUpdateUserSettings,
} from "@/features/settings/hooks";
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from "@/features/notifications/hooks";
import { toast } from "sonner";
import type { UserSettingsUpdate, DigestFrequency } from "@/types/settings";
import type { NotificationPreferencesUpdate } from "@/types/notification";

export function NotificationsTab() {
  const { data: manifest } = useSettingsManifest();
  const notifsSection = useSettingsSection(manifest, "notifications");

  const { data: userSettings } = useUserSettings();
  const updateSettings = useUpdateUserSettings();

  const { data: notifPrefs } = useNotificationPreferences();
  const updateNotifPrefs = useUpdateNotificationPreferences();

  const handleUpdate = (patch: UserSettingsUpdate) => {
    updateSettings.mutate(patch, {
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save"),
    });
  };

  const handleNotifUpdate = (patch: NotificationPreferencesUpdate) => {
    updateNotifPrefs.mutate(patch, {
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save"),
    });
  };

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-base font-semibold mb-1">Channels</h2>
        <p className="text-sm text-muted-foreground mb-4">How you receive alerts</p>
        <div className="space-y-1">
          <SettingsToggle id="emailNotifications" label="Email notifications" description="Receive important alerts and updates via email" checked={userSettings?.emailNotifications ?? true} onCheckedChange={(v) => handleUpdate({ emailNotifications: v })} isLoading={updateSettings.isPending} />
          <SettingsToggle id="pushNotifications" label="Push notifications" description="Get browser push notifications for time-sensitive alerts" checked={userSettings?.pushNotifications ?? false} onCheckedChange={(v) => handleUpdate({ pushNotifications: v })} isLoading={updateSettings.isPending} />
        </div>
      </section>

      {notifsSection && (
        <>
          <Separator />
          <section>
            <h2 className="text-base font-semibold mb-1">Event alerts</h2>
            <p className="text-sm text-muted-foreground mb-4">Choose which events trigger notifications</p>
            <div className="space-y-1">
              <SettingsToggle id="emailOnVisitorCheckIn" label="Visitor check-in" description="Get notified when a visitor checks in at your location" checked={notifPrefs?.emailOnVisitorCheckIn ?? false} onCheckedChange={(v) => handleNotifUpdate({ emailOnVisitorCheckIn: v })} isLoading={updateNotifPrefs.isPending} />
              <SettingsToggle id="emailOnAppointmentReminder" label="Appointment reminders" description="Receive reminders before upcoming appointments" checked={notifPrefs?.emailOnAppointmentReminder ?? true} onCheckedChange={(v) => handleNotifUpdate({ emailOnAppointmentReminder: v })} isLoading={updateNotifPrefs.isPending} />
              <SettingsToggle id="emailOnIncident" label="Incident alerts" description="Be notified when a new security incident is created" checked={notifPrefs?.emailOnIncident ?? true} onCheckedChange={(v) => handleNotifUpdate({ emailOnIncident: v })} isLoading={updateNotifPrefs.isPending} />
              <SettingsToggle id="emailOnDsrReceived" label="Data subject requests" description="Be notified when a new data subject request arrives" checked={notifPrefs?.emailOnDsrReceived ?? true} onCheckedChange={(v) => handleNotifUpdate({ emailOnDsrReceived: v })} isLoading={updateNotifPrefs.isPending} />
              <SettingsToggle id="emailOnSubscriptionAlert" label="Subscription alerts" description="Get notified about subscription expiry and payment issues" checked={notifPrefs?.emailOnSubscriptionAlert ?? true} onCheckedChange={(v) => handleNotifUpdate({ emailOnSubscriptionAlert: v })} isLoading={updateNotifPrefs.isPending} />
              <SettingsToggle id="emailOnNewUser" label="New user added" description="Get notified when a new user is added to your tenant" checked={notifPrefs?.emailOnNewUser ?? false} onCheckedChange={(v) => handleNotifUpdate({ emailOnNewUser: v })} isLoading={updateNotifPrefs.isPending} />
              <SettingsToggle id="emailOnSupportCase" label="Support case updates" description="Get emailed when VisiChek Support replies to one of your open cases" checked={notifPrefs?.emailOnSupportCase ?? true} onCheckedChange={(v) => handleNotifUpdate({ emailOnSupportCase: v })} isLoading={updateNotifPrefs.isPending} />
            </div>
          </section>

          <Separator />

          <section>
            <h2 className="text-base font-semibold mb-1">Digest</h2>
            <p className="text-sm text-muted-foreground mb-4">How often non-urgent notifications are batched</p>
            <SettingsSelect id="digestFrequency" label="Frequency" description="Batching interval for non-urgent alerts" value={userSettings?.digestFrequency ?? "realtime"} onValueChange={(v) => handleUpdate({ digestFrequency: v as DigestFrequency })} options={[{ value: "realtime", label: "Realtime" }, { value: "hourly", label: "Hourly" }, { value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }, { value: "none", label: "None" }]} isLoading={updateSettings.isPending} />
          </section>
        </>
      )}
    </div>
  );
}
