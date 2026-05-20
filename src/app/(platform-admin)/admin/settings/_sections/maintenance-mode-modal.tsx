"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { OtpInput } from "@/components/ui/otp-input";
import { ResponsiveModal } from "@/components/recipes/responsive-modal";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useRequestMaintenanceOtp,
  useUpdatePlatformSettings,
} from "@/features/settings/hooks";
import { ApiError } from "@/types/api";

interface MaintenanceModeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The state the admin wants to move maintenance mode to. */
  targetState: boolean;
  /** Current maintenance message, pre-filled when turning maintenance on. */
  currentMessage?: string | null;
  /** Endpoints from the settings manifest section (absolute `/v1/...`). */
  requestOtpPath?: string;
  updatePath?: string;
}

type Step = { kind: "confirm" } | { kind: "verify"; otpChallengeId: string };

export function MaintenanceModeModal({
  open,
  onOpenChange,
  targetState,
  currentMessage,
  requestOtpPath,
  updatePath,
}: MaintenanceModeModalProps) {
  const [step, setStep] = useState<Step>({ kind: "confirm" });
  const [message, setMessage] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const requestOtp = useRequestMaintenanceOtp(requestOtpPath);
  const update = useUpdatePlatformSettings(updatePath);

  // Reset on each open. A stale challenge id left over from a previous
  // open could fire against the wrong target state — force a fresh
  // request every time.
  useEffect(() => {
    if (!open) return;
    setStep({ kind: "confirm" });
    setMessage(currentMessage ?? "");
    setOtpCode("");
    setError(null);
  }, [open, currentMessage]);

  async function handleRequestOtp() {
    setError(null);
    try {
      const result = await requestOtp.mutateAsync();
      setStep({ kind: "verify", otpChallengeId: result.otpChallengeId });
      setOtpCode("");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Couldn't send the verification code. Please try again.",
      );
    }
  }

  async function handleVerify() {
    if (step.kind !== "verify") return;
    if (otpCode.length < 6) return;
    setError(null);
    try {
      await update.mutateAsync({
        otpChallengeId: step.otpChallengeId,
        otpCode,
        maintenanceMode: targetState,
        // Only send a message when turning maintenance on; trim so an
        // accidental whitespace-only value doesn't overwrite.
        ...(targetState && message.trim()
          ? { maintenanceMessage: message.trim() }
          : {}),
      });
      toast.success(
        targetState
          ? "Maintenance mode is now ON for all tenants."
          : "Maintenance mode is now OFF.",
      );
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429) {
          setError(
            "Too many code attempts. Send a fresh code to try again.",
          );
          setStep({ kind: "confirm" });
          return;
        }
        if (err.status === 401) {
          setError("That code is invalid or expired. Try entering it again.");
          setOtpCode("");
          return;
        }
        setError(err.message);
        return;
      }
      setError("Verification failed. Please try again.");
    }
  }

  function handleBack() {
    setStep({ kind: "confirm" });
    setOtpCode("");
    setError(null);
  }

  const submitting = requestOtp.isPending || update.isPending;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={
        step.kind === "verify"
          ? "Confirm with verification code"
          : targetState
            ? "Turn maintenance mode ON"
            : "Turn maintenance mode OFF"
      }
      description={
        step.kind === "verify"
          ? "Enter the 6-digit code we just sent to your verification channel to apply the change."
          : targetState
            ? "All tenants will see a maintenance page until this is turned off. This change requires a verification code."
            : "Tenants will regain access to the platform. This change requires a verification code."
      }
    >
      <div className="space-y-5 pt-2">
        {error && (
          <div
            className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {error}
          </div>
        )}

        {step.kind === "confirm" && (
          <>
            {targetState && (
              <div className="space-y-2">
                <Label htmlFor="maintenance-message">
                  Maintenance message (optional)
                </Label>
                <Textarea
                  id="maintenance-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="e.g. Back at 14:00 UTC"
                  rows={3}
                  className="text-base md:text-sm"
                />
                <p className="text-[11px] text-muted-foreground">
                  Shown to tenants on the maintenance page. Leave blank to use
                  the default message.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2 md:flex-row md:justify-end">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    className="min-h-[44px]"
                  >
                    Cancel
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Close without changing maintenance mode
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    onClick={handleRequestOtp}
                    disabled={submitting}
                    className="min-h-[44px]"
                  >
                    {submitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="mr-2 h-4 w-4" />
                    )}
                    Send verification code
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Send a one-time verification code to your channel to confirm
                  this change
                </TooltipContent>
              </Tooltip>
            </div>
          </>
        )}

        {step.kind === "verify" && (
          <>
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-full bg-primary/10 p-3">
                <KeyRound className="h-6 w-6 text-primary" aria-hidden="true" />
              </div>
              <p className="text-sm text-center text-muted-foreground">
                After verifying, maintenance mode will be turned{" "}
                <span className="font-medium text-foreground">
                  {targetState ? "ON" : "OFF"}
                </span>
                {targetState ? " for all tenants." : "."}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-center block">Verification code</Label>
              <OtpInput
                length={6}
                value={otpCode}
                onChange={setOtpCode}
                onComplete={() => handleVerify()}
                disabled={update.isPending}
                autoFocus
                aria-label="Enter the 6-digit verification code"
              />
              <p className="text-[11px] text-muted-foreground text-center">
                Check your inbox or authenticator app. Codes expire after a few
                minutes.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2 md:flex-row md:justify-between">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleBack}
                    disabled={update.isPending}
                    className="min-h-[44px]"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Go back to the previous step. The current code will be
                  invalidated.
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    onClick={handleVerify}
                    disabled={otpCode.length < 6 || update.isPending}
                    className="min-h-[44px]"
                  >
                    {update.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="mr-2 h-4 w-4" />
                    )}
                    {targetState ? "Enable maintenance mode" : "Disable maintenance mode"}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Verify the code and apply the maintenance-mode change
                </TooltipContent>
              </Tooltip>
            </div>
          </>
        )}
      </div>
    </ResponsiveModal>
  );
}
