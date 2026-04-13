"use client";

import { Loader2 } from "lucide-react";
import {
  SettingsLayout,
  type SettingsTab,
} from "@/components/recipes/settings-layout";
import {
  useSettingsManifest,
  useVisibleSections,
} from "@/features/settings/hooks";
import { ProfileTab } from "./_sections/profile-tab";
import { SecurityTab } from "@/components/settings/security-tab";
import { SessionsTab } from "./_sections/sessions-tab";
import { NotificationsTab } from "./_sections/notifications-tab";
import { AdvancedTab } from "./_sections/advanced-tab";
import { BrandingTab } from "./_sections/branding-tab";
import { useCapabilities } from "@/hooks/use-capabilities";
import { CAPABILITIES } from "@/lib/permissions/capabilities";

export default function TenantSettingsPage() {
  const { data: manifest, isLoading: manifestLoading } = useSettingsManifest();
  const visibleSections = useVisibleSections(manifest);
  const { hasCapability } = useCapabilities();
  const canViewBranding =
    hasCapability(CAPABILITIES.BRANDING_VIEW) || hasCapability(CAPABILITIES.BRANDING_EDIT);

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
      description: "Active sessions and device management",
      content: <SessionsTab />,
    });
  }

  if (visibleSections.has("notifications")) {
    tabs.push({
      id: "notifications",
      label: "Notifications",
      description: "Email, push, event alerts, and digest settings",
      content: <NotificationsTab />,
    });
  }

  if (canViewBranding) {
    tabs.push({
      id: "branding",
      label: "Branding",
      description: "Colors, logo, and visitor badge appearance for your tenant",
      content: <BrandingTab />,
    });
  }

  if (visibleSections.has("account_deletion") || visibleSections.has("tenant_settings")) {
    tabs.push({
      id: "advanced",
      label: "Advanced",
      description: "Account deletion, IDs, and organisation settings",
      content: <AdvancedTab />,
    });
  }

  return <SettingsLayout title="Settings" tabs={tabs} />;
}
