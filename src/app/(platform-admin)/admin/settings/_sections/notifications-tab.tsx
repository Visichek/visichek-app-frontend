"use client";

import { Separator } from "@/components/ui/separator";
import { SettingsToggle, SettingsSelect } from "@/components/recipes/settings-section";
import {
  useUserSettings,
  useUpdateUserSettings,
} from "@/features/settings/hooks";
import { toast } from "sonner";
import type { UserSettingsUpdate, DigestFrequency } from "@/types/settings";

export function NotificationsTab() {
  const { data: userSettings } = useUserSettings();
  const updateSettings = useUpdateUserSettings();

  const handleUpdate = (patch: UserSettingsUpdate) => {
    updateSettings.mutate(patch, {
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save"),
    });
  };

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-base font-semibold mb-1">Notification channels</h2>
        <p className="text-sm text-muted-foreground mb-4">How you receive alerts and updates</p>
        <div className="space-y-1">
          <SettingsToggle id="emailNotifications" label="Email notifications" description="Receive important alerts and updates via email" checked={userSettings?.emailNotifications ?? true} onCheckedChange={(v) => handleUpdate({ emailNotifications: v })} />
          <SettingsToggle id="pushNotifications" label="Push notifications" description="Get browser push notifications for time-sensitive alerts" checked={userSettings?.pushNotifications ?? false} onCheckedChange={(v) => handleUpdate({ pushNotifications: v })} />
          <SettingsToggle id="notifyOnSystemAlert" label="System alerts" description="Be notified when the platform triggers a system-level alert" checked={userSettings?.notifyOnSystemAlert ?? true} onCheckedChange={(v) => handleUpdate({ notifyOnSystemAlert: v })} />
        </div>
      </section>

      <Separator />

      <section>
        <h2 className="text-base font-semibold mb-1">Digest</h2>
        <p className="text-sm text-muted-foreground mb-4">How often non-urgent notifications are batched</p>
        <SettingsSelect id="digestFrequency" label="Frequency" description="Batching interval for non-urgent alerts" value={userSettings?.digestFrequency ?? "realtime"} onValueChange={(v) => handleUpdate({ digestFrequency: v as DigestFrequency })} options={[{ value: "realtime", label: "Realtime" }, { value: "hourly", label: "Hourly" }, { value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }, { value: "none", label: "None" }]} />
      </section>
    </div>
  );
}
