"use client";

import { useState } from "react";
import { KeyRound, ShieldOff, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { SettingsInfo } from "@/components/recipes/settings-section";
import {
  useSettingsManifest,
  useSettingsSection,
} from "@/features/settings/hooks";
import {
  PasswordChangeDialog,
  TwoFactorSetupDialog,
  TwoFactorDisableDialog,
} from "@/features/account/components";

export function SecurityTab() {
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [twoFaSetupOpen, setTwoFaSetupOpen] = useState(false);
  const [twoFaDisableOpen, setTwoFaDisableOpen] = useState(false);

  const { data: manifest } = useSettingsManifest();
  const twoFactorSection = useSettingsSection(manifest, "two_factor");
  const passwordSection = useSettingsSection(manifest, "password");

  const twoFa = twoFactorSection?.currentState;
  const mfaEnabled = twoFa?.enabled ?? false;
  const mfaCanDisable = twoFa?.canDisable ?? true;
  const mfaRequired = twoFa?.required ?? false;
  const mfaEnforcementReason = twoFa?.enforcementReason ?? null;

  return (
    <div className="space-y-6">
      {twoFactorSection && (
        <section>
          <h2 className="text-base font-semibold mb-1">{twoFactorSection.label}</h2>
          <p className="text-sm text-muted-foreground mb-4">{twoFactorSection.description}</p>

          {mfaEnforcementReason && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 mb-4">
              <ShieldAlert className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-400">
                {mfaEnforcementReason}
              </p>
            </div>
          )}

          <SettingsInfo
            label="Status"
            description={
              mfaEnabled
                ? mfaRequired
                  ? "Two-factor authentication is mandatory for your account"
                  : "Your account is protected with 2FA"
                : "Not currently enabled"
            }
            value={
              mfaEnabled ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {mfaRequired ? "Enabled (required)" : "Enabled"}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Disabled
                </span>
              )
            }
            action={
              mfaEnabled ? (
                mfaCanDisable ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-[36px] text-destructive"
                        onClick={() => setTwoFaDisableOpen(true)}
                      >
                        <ShieldOff className="h-3.5 w-3.5 mr-1.5" />
                        Disable
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Remove two-factor authentication from your account</TooltipContent>
                  </Tooltip>
                ) : null
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-[36px]"
                      onClick={() => setTwoFaSetupOpen(true)}
                    >
                      <KeyRound className="h-3.5 w-3.5 mr-1.5" />
                      Enable
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Set up two-factor authentication using an authenticator app</TooltipContent>
                </Tooltip>
              )
            }
          />
        </section>
      )}

      {passwordSection && (
        <>
          <Separator />
          <section>
            <h2 className="text-base font-semibold mb-1">{passwordSection.label}</h2>
            <p className="text-sm text-muted-foreground mb-4">{passwordSection.description}</p>
            <SettingsInfo
              label="Current password"
              description="Change your password regularly to keep your account secure"
              value={<span className="text-xs">••••••••••</span>}
              action={
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-[36px]"
                      onClick={() => setPasswordDialogOpen(true)}
                    >
                      Change
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Change your account password</TooltipContent>
                </Tooltip>
              }
            />
          </section>
        </>
      )}

      <PasswordChangeDialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen} />
      <TwoFactorSetupDialog open={twoFaSetupOpen} onOpenChange={setTwoFaSetupOpen} />
      <TwoFactorDisableDialog open={twoFaDisableOpen} onOpenChange={setTwoFaDisableOpen} />
    </div>
  );
}
