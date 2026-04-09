"use client";

import { Loader2 } from "lucide-react";
import {
  SettingsLayout,
  type SettingsTab,
} from "@/components/recipes/settings-layout";
import {
  useSettingsManifest,
  useVisibleSections,
  useSettingsSection,
} from "@/features/settings/hooks";
import { ProfileTab } from "./_sections/profile-tab";
import { SecurityTab } from "@/components/settings/security-tab";
import { SessionsTab } from "./_sections/sessions-tab";
import { NotificationsTab } from "./_sections/notifications-tab";
import { PlatformTab } from "./_sections/platform-tab";

export default function AdminSettingsPage() {
  const { data: manifest, isLoading: manifestLoading } = useSettingsManifest();
  const visibleSections = useVisibleSections(manifest);
  const platformSection = useSettingsSection(manifest, "platform_settings");

  if (manifestLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const tabs: SettingsTab[] = [
    {
      id: "profile",
      label: "Profile",
      description: "Profile, appearance, and regional preferences",
      content: <ProfileTab />,
    },
  ];

  if (visibleSections.has("password") || visibleSections.has("two_factor")) {
    tabs.push({
      id: "security",
      label: "Security",
      description: "Two-factor authentication and password",
      content: <SecurityTab />,
    });
  }

  if (visibleSections.has("sessions")) {
    tabs.push({
      id: "sessions",
      label: "Sessions",
      description: "Active sessions, account management, and device management",
      content: <SessionsTab />,
    });
  }

  if (visibleSections.has("notifications")) {
    tabs.push({
      id: "notifications",
      label: "Notifications",
      description: "Email, push, and digest settings",
      content: <NotificationsTab />,
    });
  }

  if (platformSection) {
    tabs.push({
      id: "platform",
      label: "Platform",
      description: "Global platform configuration and feature flags",
      content: <PlatformTab />,
    });
  }

  return <SettingsLayout title="Settings" tabs={tabs} />;
}
