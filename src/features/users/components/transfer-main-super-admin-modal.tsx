"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { OtpInput } from "@/components/ui/otp-input";
import { ResponsiveModal } from "@/components/recipes/responsive-modal";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useInitiateTransferMainSuperAdmin,
  useCompleteTransferMainSuperAdmin,
} from "@/features/users/hooks/use-users";
import { ApiError } from "@/types/api";
import type { SystemUser } from "@/types/user";

interface TransferMainSuperAdminModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Candidate super_admins the actor can transfer ownership to. The
   * caller filters the tenant's user list down to active super_admins
   * other than the current main; the modal trusts that filter.
   */
  candidates: SystemUser[];
  /**
   * The current main super_admin row, for display copy. Optional — the
   * modal still works when the caller doesn't have it on hand.
   */
  currentMain?: SystemUser | null;
  /**
   * REQUIRED when the actor is an application admin (cross-tenant). For
   * the tenant super_admin path leave undefined; the backend resolves
   * the tenant from the session cookie.
   */
  tenantId?: string;
  /**
   * Pre-selected target id (useful when invoking the modal from a
   * row-level "Transfer to this user" action). Falls back to the first
   * candidate when omitted.
   */
  defaultTargetId?: string;
}

type Step =
  | { kind: "pick" }
  | {
      kind: "verify";
      otpChallengeId: string;
      newMainSuperAdminUserId: string;
      tenantId: string;
    };

export function TransferMainSuperAdminModal({
  open,
  onOpenChange,
  candidates,
  currentMain,
  tenantId,
  defaultTargetId,
}: TransferMainSuperAdminModalProps) {
  const [targetId, setTargetId] = useState<string>("");
  const [step, setStep] = useState<Step>({ kind: "pick" });
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const initiate = useInitiateTransferMainSuperAdmin();
  const complete = useCompleteTransferMainSuperAdmin();

  // Reset every time the modal re-opens. Keeping otpChallengeId / target
  // across opens would let a stale challenge fire against a different
  // target — better to force a fresh initiate.
  useEffect(() => {
    if (!open) return;
    setStep({ kind: "pick" });
    setOtpCode("");
    setError(null);
    setTargetId(defaultTargetId ?? candidates[0]?.id ?? "");
  }, [open, defaultTargetId, candidates]);

  const options = useMemo(
    () =>
      candidates.map((c) => ({
        value: c.id,
        label: `${c.fullName} — ${c.email}`,
      })),
    [candidates],
  );

  const targetUser = candidates.find((c) => c.id === targetId) ?? null;

  async function handleInitiate() {
    if (!targetId) {
      setError("Pick another super admin to transfer the role to.");
      return;
    }
    setError(null);
    try {
      const result = await initiate.mutateAsync({
        newMainSuperAdminUserId: targetId,
        tenantId,
      });
      setStep({
        kind: "verify",
        otpChallengeId: result.otpChallengeId,
        newMainSuperAdminUserId: result.newMainSuperAdminUserId,
        tenantId: result.tenantId,
      });
      setOtpCode("");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Couldn't start the transfer. Please try again.",
      );
    }
  }

  async function handleVerify() {
    if (step.kind !== "verify") return;
    if (otpCode.length < 6) return;
    setError(null);
    try {
      await complete.mutateAsync({
        otpChallengeId: step.otpChallengeId,
        otpCode,
        newMainSuperAdminUserId: step.newMainSuperAdminUserId,
        tenantId: step.tenantId,
      });
      toast.success("Main super admin transferred successfully.");
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429) {
          setError(
            "Too many code attempts. Start the transfer again to get a fresh code.",
          );
          setStep({ kind: "pick" });
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
    setStep({ kind: "pick" });
    setOtpCode("");
    setError(null);
  }

  const submitting = initiate.isPending || complete.isPending;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={
        step.kind === "verify"
          ? "Confirm transfer with verification code"
          : "Transfer main super admin"
      }
      description={
        step.kind === "verify"
          ? "Enter the 6-digit code we just sent to your verification channel to finalise the transfer."
          : currentMain
            ? `${currentMain.fullName} is currently the main super admin. Pick another active super admin to take over.`
            : "Pick another active super admin to take over the main super admin role for this organization."
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

        {step.kind === "pick" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="transfer-target">New main super admin</Label>
              <SearchableSelect
                id="transfer-target"
                value={targetId || undefined}
                onValueChange={(v) => setTargetId(v)}
                placeholder={
                  options.length === 0
                    ? "No other active super admins available"
                    : "Select a super admin"
                }
                searchPlaceholder="Search by name or email..."
                emptyText="No matching super admins"
                triggerClassName="min-h-[44px]"
                options={options}
              />
              {options.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Invite another active super admin before you can transfer
                  the role.
                </p>
              )}
            </div>

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
                <TooltipContent>Close without transferring</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    onClick={handleInitiate}
                    disabled={!targetId || submitting}
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
                  Send a one-time verification code to your verification
                  channel to confirm this transfer
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
              {targetUser && (
                <p className="text-sm text-center text-muted-foreground">
                  After verifying, <span className="font-medium text-foreground">
                    {targetUser.fullName}
                  </span>{" "}
                  becomes the main super admin and can no longer be removed
                  directly.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-center block">Verification code</Label>
              <OtpInput
                length={6}
                value={otpCode}
                onChange={setOtpCode}
                onComplete={() => handleVerify()}
                disabled={complete.isPending}
                autoFocus
                aria-label="Enter the 6-digit verification code"
              />
              <p className="text-[11px] text-muted-foreground text-center">
                Check your inbox or authenticator app. Codes expire after a
                few minutes.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2 md:flex-row md:justify-between">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleBack}
                    disabled={complete.isPending}
                    className="min-h-[44px]"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Pick a different person
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Go back to the previous step and pick a different target.
                  The current code will be invalidated.
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    onClick={handleVerify}
                    disabled={otpCode.length < 6 || complete.isPending}
                    className="min-h-[44px]"
                  >
                    {complete.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="mr-2 h-4 w-4" />
                    )}
                    Confirm transfer
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Verify the code and complete the transfer
                </TooltipContent>
              </Tooltip>
            </div>
          </>
        )}
      </div>
    </ResponsiveModal>
  );
}
