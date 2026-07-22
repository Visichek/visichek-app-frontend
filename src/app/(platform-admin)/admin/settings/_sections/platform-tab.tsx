"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { SettingsToggle } from "@/components/recipes/settings-section";
import {
  useSettingsManifest,
  useSettingsSection,
  usePlatformSettings,
} from "@/features/settings/hooks";
import { MaintenanceModeModal } from "./maintenance-mode-modal";

export function PlatformTab() {
  const { data: manifest } = useSettingsManifest();
  const platformSection = useSettingsSection(manifest, "platform_settings");

  const { data: platformSettingsData } = usePlatformSettings();

  const [modalState, setModalState] = useState<{
    open: boolean;
    target: boolean;
  }>({ open: false, target: false });

  if (!platformSection) return null;

  const maintenanceOn = platformSettingsData?.maintenanceMode ?? false;
  const endpoints = platformSection.endpoints ?? {};

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-base font-semibold mb-1">Platform Settings</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Maintenance mode is the only runtime-editable platform setting. Every
          other platform configuration value (password rules, lockout, 2FA
          enforcement, SMTP, rate limits, organization defaults) is version-controlled
          in backend code and changed by a deploy.
        </p>

        <div className="space-y-1">
          <SettingsToggle
            id="maintenanceMode"
            label="Maintenance mode"
            description="Show a maintenance page to all organizations. Toggling this requires a one-time verification code."
            checked={maintenanceOn}
            onCheckedChange={(v) => setModalState({ open: true, target: v })}
          />
        </div>

        {maintenanceOn && (
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
            <Info className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-amber-700 dark:text-amber-400">
                Maintenance mode is ON — all organizations see a maintenance page.
              </p>
              <p className="text-muted-foreground mt-0.5">
                {platformSettingsData?.maintenanceMessage
                  ? `Message shown to organizations: “${platformSettingsData.maintenanceMessage}”`
                  : "No custom message set — organizations see the default maintenance page."}
              </p>
            </div>
          </div>
        )}
      </section>

      <MaintenanceModeModal
        open={modalState.open}
        onOpenChange={(open) => setModalState((s) => ({ ...s, open }))}
        targetState={modalState.target}
        currentMessage={platformSettingsData?.maintenanceMessage}
        requestOtpPath={endpoints.requestOtp}
        updatePath={endpoints.update}
      />
    </div>
  );
}
