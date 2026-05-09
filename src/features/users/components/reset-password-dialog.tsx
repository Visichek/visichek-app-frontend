"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Eye, EyeOff, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";
import {
  PASSWORD_RULES,
  getStrengthLevel,
} from "@/features/account/lib/password-rules";
import { ApiError } from "@/types/api";

export type ResetPasswordHandler = (input: {
  userId: string;
  newPassword: string;
}) => Promise<unknown>;

export interface ResetPasswordTarget {
  id: string;
  fullName?: string;
  email?: string;
}

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Target user being reset. Carries the id used in the endpoint URL. */
  target: ResetPasswordTarget | null;
  /**
   * Either `useResetUserPassword().mutateAsync` (super_admin path) or
   * `useAdminResetSystemUserPassword().mutateAsync` (app-admin path).
   * The dialog is endpoint-agnostic — both endpoints share the request
   * shape and side effects.
   */
  onReset: ResetPasswordHandler;
  /** Pending state from the bound mutation. */
  isPending: boolean;
}

/**
 * Modal a super_admin or app admin uses to set a new password for
 * another user. The user is logged out of every active session on
 * success and the new password is shown once with a copy-to-clipboard
 * action so it can be delivered out-of-band — the API does NOT email
 * it.
 *
 * On 422 from the backend (policy/history failure) the message is
 * surfaced inline against the password field rather than as a toast,
 * matching the change-password 422 contract.
 */
export function ResetPasswordDialog({
  open,
  onOpenChange,
  target,
  onReset,
  isPending,
}: ResetPasswordDialogProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [resetCopy, setResetCopy] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setNewPassword("");
      setConfirmPassword("");
      setShowNew(false);
      setServerError(null);
      setResetCopy(null);
    }
  }, [open]);

  const ruleResults = useMemo(
    () =>
      PASSWORD_RULES.map((rule) => ({ ...rule, passed: rule.test(newPassword) })),
    [newPassword]
  );
  const passedCount = ruleResults.filter((r) => r.passed).length;
  const strength = getStrengthLevel(passedCount, PASSWORD_RULES.length);
  const allPassed = passedCount === PASSWORD_RULES.length;
  const passwordsMatch = newPassword === confirmPassword;
  const canSubmit =
    !!target && allPassed && passwordsMatch && !isPending && !resetCopy;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !target) return;
    setServerError(null);
    try {
      await onReset({ userId: target.id, newPassword });
      // Keep the password in state (resetCopy) so the actor can copy it
      // out — they won't see it again after they close the modal.
      setResetCopy(newPassword);
      toast.success(
        "Password reset. The user has been logged out of all sessions."
      );
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 422) {
          setServerError(err.message);
          return;
        }
        if (err.status === 400) {
          // VALIDATION_FAILED — most commonly "use change-password to
          // change your own password". Surface to user.
          setServerError(err.message);
          return;
        }
        if (err.status === 404) {
          setServerError("User not found.");
          return;
        }
      }
      const fallback =
        err instanceof Error ? err.message : "Failed to reset password";
      setServerError(fallback);
    }
  };

  const handleCopy = async () => {
    if (!resetCopy) return;
    try {
      await navigator.clipboard.writeText(resetCopy);
      toast.success("Password copied to clipboard");
    } catch {
      toast.error("Couldn't copy to clipboard — copy it manually.");
    }
  };

  const handleClose = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>
            {target?.fullName
              ? `Set a new password for ${target.fullName}${
                  target.email ? ` (${target.email})` : ""
                }.`
              : "Set a new password for this user."}{" "}
            They will be signed out of every active session and must use the
            new password to sign back in. The password is not emailed —
            deliver it out-of-band.
          </DialogDescription>
        </DialogHeader>

        {resetCopy ? (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-3 space-y-2">
              <Label
                htmlFor="reset-password-output"
                className="text-xs uppercase tracking-wider text-muted-foreground"
              >
                New password
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="reset-password-output"
                  readOnly
                  value={resetCopy}
                  className="font-mono"
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={handleCopy}
                      aria-label="Copy password to clipboard"
                      className="min-h-[44px]"
                    >
                      <Copy className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copy the password to clipboard</TooltipContent>
                </Tooltip>
              </div>
              <p className="text-xs text-muted-foreground">
                Copy this password now — it won&apos;t be shown again. Send it
                to the user privately (in person, on a secure channel, etc.).
              </p>
            </div>
            <DialogFooter>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    onClick={handleClose}
                    className="min-h-[44px]"
                  >
                    Done
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Close this dialog</TooltipContent>
              </Tooltip>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-new-password">New password</Label>
              <div className="relative">
                <Input
                  id="reset-new-password"
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (serverError) setServerError(null);
                  }}
                  className="pr-10 text-base md:text-sm"
                  autoComplete="new-password"
                  aria-invalid={!!serverError}
                  aria-describedby={
                    serverError ? "reset-password-error" : undefined
                  }
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => setShowNew(!showNew)}
                      aria-label={showNew ? "Hide password" : "Show password"}
                    >
                      {showNew ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {showNew ? "Hide password" : "Show password"}
                  </TooltipContent>
                </Tooltip>
              </div>

              {newPassword.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          strength.color,
                          strength.width
                        )}
                      />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">
                      {strength.label}
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {ruleResults.map((rule) => (
                      <li
                        key={rule.label}
                        className="flex items-center gap-2 text-xs"
                      >
                        {rule.passed ? (
                          <Check className="h-3 w-3 text-emerald-500 shrink-0" />
                        ) : (
                          <X className="h-3 w-3 text-muted-foreground shrink-0" />
                        )}
                        <span
                          className={cn(
                            rule.passed
                              ? "text-muted-foreground"
                              : "text-foreground"
                          )}
                        >
                          {rule.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {serverError && (
                <p
                  id="reset-password-error"
                  className="text-sm text-destructive"
                  role="alert"
                >
                  {serverError}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="reset-confirm-password">Confirm new password</Label>
              <Input
                id="reset-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="text-base md:text-sm"
                autoComplete="new-password"
              />
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="text-xs text-destructive">
                  Passwords do not match
                </p>
              )}
            </div>

            <DialogFooter>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClose}
                    className="min-h-[44px]"
                  >
                    Cancel
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Close without resetting</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="submit"
                    disabled={!canSubmit}
                    className="min-h-[44px]"
                  >
                    {isPending && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    Reset password
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Save the new password and revoke this user&apos;s sessions
                </TooltipContent>
              </Tooltip>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
