"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { ApiError } from "@/types/api";

/**
 * Mutation handler for authority password reset (super_admin path or
 * app-admin path — both share the empty-body contract).
 */
export type ResetPasswordHandler = (input: {
  userId: string;
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
   * Both endpoints accept an empty body — the backend generates the
   * temp password, marks the user `mustChangePassword=true`, revokes
   * every active token, and emails the cleartext.
   */
  onReset: ResetPasswordHandler;
  /** Pending state from the bound mutation. */
  isPending: boolean;
}

/**
 * Modal a super_admin or app admin uses to trigger an authority
 * password reset. The actor no longer chooses the new value —
 * confirming this dialog hits the endpoint with an empty body and
 * the backend handles the rest (temp password + email + token
 * revocation + audit row).
 */
export function ResetPasswordDialog({
  open,
  onOpenChange,
  target,
  onReset,
  isPending,
}: ResetPasswordDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [resetCompleted, setResetCompleted] = useState(false);

  useEffect(() => {
    if (!open) {
      setServerError(null);
      setResetCompleted(false);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!target) return;
    setServerError(null);
    try {
      await onReset({ userId: target.id });
      setResetCompleted(true);
      toast.success(
        `Reset queued. ${target.email ?? "The user"} was emailed a temporary password and signed out of every session.`,
      );
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 422) {
          setServerError(err.message);
          return;
        }
        if (err.status === 400) {
          // VALIDATION_FAILED — typically "use change-password for
          // your own password" if the actor targeted themselves.
          setServerError(err.message);
          return;
        }
        if (err.status === 404) {
          setServerError("User not found.");
          return;
        }
      }
      setServerError(
        err instanceof Error ? err.message : "Failed to reset password",
      );
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
              ? `Trigger an authority password reset for ${target.fullName}${
                  target.email ? ` (${target.email})` : ""
                }.`
              : "Trigger an authority password reset for this user."}
          </DialogDescription>
        </DialogHeader>

        {resetCompleted ? (
          <div className="space-y-4">
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
              <p className="font-medium text-emerald-700 dark:text-emerald-300">
                Reset complete
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                A temporary password was emailed to{" "}
                <span className="font-mono">
                  {target?.email ?? "the user"}
                </span>
                . They have been signed out of every active session and
                will be forced to change the password on next sign-in.
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
          <div className="space-y-4">
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
              <div className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 h-4 w-4 text-amber-500" />
                <div className="space-y-1">
                  <p className="font-medium">This will:</p>
                  <ul className="list-disc pl-4 text-xs text-muted-foreground">
                    <li>
                      Generate a new temporary password (you will not see it).
                    </li>
                    <li>
                      Email the temp password to{" "}
                      <span className="font-mono">
                        {target?.email ?? "this user"}
                      </span>
                      .
                    </li>
                    <li>
                      Sign the user out of every active session
                      immediately.
                    </li>
                    <li>
                      Force them to change the password on next sign-in.
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {serverError && (
              <p className="text-sm text-destructive" role="alert">
                {serverError}
              </p>
            )}

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
                    type="button"
                    onClick={handleSubmit}
                    disabled={isPending || !target}
                    className="min-h-[44px]"
                  >
                    {isPending && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    Reset password
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Trigger the authority reset and revoke this user&apos;s sessions
                </TooltipContent>
              </Tooltip>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
