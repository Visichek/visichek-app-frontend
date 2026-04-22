"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { Separator } from "@/components/ui/separator";
import { SettingsInfo, SettingsSelect } from "@/components/recipes/settings-section";
import { ThemePicker } from "@/components/settings/theme-picker";
import {
  useSettingsManifest,
  useSettingsSection,
  useUserSettings,
  useUpdateUserSettings,
} from "@/features/settings/hooks";
import { toast } from "sonner";
import type { UserSettingsUpdate, DateFormat, TimeFormat } from "@/types/settings";

export function ProfileTab() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useState(() => { setMounted(true); });

  const { data: manifest } = useSettingsManifest();
  const profileSection = useSettingsSection(manifest, "profile");
  const prefsSection = useSettingsSection(manifest, "preferences");
  const profile = manifest?.profile;

  const { data: userSettings } = useUserSettings();
  const updateSettings = useUpdateUserSettings();

  const handleUpdate = (patch: UserSettingsUpdate) => {
    updateSettings.mutate(patch, {
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save"),
    });
  };

  const handleThemeChange = (t: string) => {
    setTheme(t);
    handleUpdate({ theme: t as "light" | "dark" | "system" });
  };

  return (
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
        <ThemePicker
          theme={theme}
          setTheme={handleThemeChange}
          mounted={mounted}
          isLoading={updateSettings.isPending}
          loadingValue={updateSettings.isPending ? updateSettings.variables?.theme ?? null : null}
        />
      </section>

      {prefsSection && (
        <>
          <Separator />
          <section>
            <h2 className="text-base font-semibold mb-1">Regional</h2>
            <p className="text-sm text-muted-foreground mb-4">Language, timezone, and formatting preferences</p>
            <div className="space-y-1">
              <SettingsSelect id="language" label="Language" description="Display language for the interface" value={userSettings?.language ?? "en"} onValueChange={(v) => handleUpdate({ language: v })} options={[{ value: "en", label: "English" }, { value: "fr", label: "French" }, { value: "es", label: "Spanish" }]} isLoading={updateSettings.isPending} />
              <SettingsSelect id="timezone" label="Timezone" description="Used for timestamps and scheduling" value={userSettings?.timezone ?? "Africa/Lagos"} onValueChange={(v) => handleUpdate({ timezone: v })} options={[{ value: "Africa/Lagos", label: "Africa/Lagos" }, { value: "Europe/London", label: "Europe/London" }, { value: "America/New_York", label: "America/New York" }, { value: "Asia/Tokyo", label: "Asia/Tokyo" }]} isLoading={updateSettings.isPending} />
              <SettingsSelect id="dateFormat" label="Date format" description="How dates appear across the app" value={userSettings?.dateFormat ?? "DD/MM/YYYY"} onValueChange={(v) => handleUpdate({ dateFormat: v as DateFormat })} options={[{ value: "DD/MM/YYYY", label: "DD/MM/YYYY" }, { value: "MM/DD/YYYY", label: "MM/DD/YYYY" }, { value: "YYYY-MM-DD", label: "YYYY-MM-DD" }]} isLoading={updateSettings.isPending} />
              <SettingsSelect id="timeFormat" label="Time format" description="12-hour or 24-hour clock" value={userSettings?.timeFormat ?? "24h"} onValueChange={(v) => handleUpdate({ timeFormat: v as TimeFormat })} options={[{ value: "12h", label: "12-hour" }, { value: "24h", label: "24-hour" }]} isLoading={updateSettings.isPending} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
