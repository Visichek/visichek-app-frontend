"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
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
import {
  useAddTenantSuperAdmin,
  useReplaceTenantSuperAdmin,
} from "@/features/auth/hooks/use-admin-dashboard";
import { ApiError } from "@/types/api";

interface AddSuperAdminDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  tenantName: string;
  /**
   * `add` — POST /v1/admins/tenants/{id}/super-admins (fresh provision).
   * `replace` — POST /v1/admins/tenants/{id}/super-admins/replace
   *   (atomic swap; deactivates the existing super_admin).
   *
   * The parent decides which mode to use based on whether the tenant
   * already has an active super_admin (see {@link useOffboardingSummary}
   * or the tenant-detail payload).
   */
  mode: "add" | "replace";
}

/**
 * App-admin modal for provisioning a tenant super_admin without ever
 * choosing or seeing their password. The backend generates a temp
 * password, persists it with `mustChangePassword=true`, and emails the
 * cleartext via the welcome template — the only credential carrier.
 *
 * Two modes:
 *   - `add`     → first super_admin on a tenant that has none. Fails
 *                 with 409 SUPER_ADMIN_ALREADY_EXISTS when one is on
 *                 file; switch the parent to `replace` mode.
 *   - `replace` → atomic swap. Deactivates the existing super_admin,
 *                 revokes their tokens, and provisions the replacement
 *                 in one step.
 */
export function AddSuperAdminDialog({
  open,
  onOpenChange,
  tenantId,
  tenantName,
  mode,
}: AddSuperAdminDialogProps) {
  const addSuperAdmin = useAddTenantSuperAdmin();
  const replaceSuperAdmin = useReplaceTenantSuperAdmin();

  const isReplace = mode === "replace";
  const mutation = isReplace ? replaceSuperAdmin : addSuperAdmin;
  const isPending = mutation.isPending;

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setFullName("");
      setEmail("");
      setServerError(null);
    }
  }, [open]);

  const isEmailValid = /\S+@\S+\.\S+/.test(email);
  const canSubmit =
    fullName.trim().length > 0 && isEmailValid && !isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setServerError(null);
    try {
      const payload = {
        fullName: fullName.trim(),
        email: email.trim(),
      };
      if (isReplace) {
        const result = await replaceSuperAdmin.mutateAsync({
          tenantId,
          data: payload,
        });
        toast.success(
          `Replaced. A temporary password was emailed to ${result.newSuperAdmin.email}.`,
        );
      } else {
        const result = await addSuperAdmin.mutateAsync({
          tenantId,
          data: payload,
        });
        toast.success(
          `Super admin added. A temporary password was emailed to ${result.email}.`,
        );
      }
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError) {
        // 409 SUPER_ADMIN_ALREADY_EXISTS: caller should re-open in
        // `replace` mode. 409 SUPER_ADMIN_NONE_TO_REPLACE: opposite.
        // Surface the backend message so the reviewer knows what to do.
        if (
          err.status === 400 ||
          err.status === 409 ||
          err.status === 422
        ) {
          setServerError(err.message);
          return;
        }
      }
      setServerError(
        err instanceof Error
          ? err.message
          : `Failed to ${isReplace ? "replace" : "add"} super admin`,
      );
    }
  };

  const title = isReplace ? "Replace super admin" : "Add super admin";
  const targetEmail = email.trim() || "the email below";
  const description = isReplace
    ? `Deactivates the current super_admin on ${tenantName} and emails a temporary password to ${targetEmail}. The replaced account will be signed out of every active session.`
    : `Add the first super_admin to ${tenantName}. A temporary password will be emailed to ${targetEmail}; they will be required to change it on first sign-in. The cleartext is never shown to you.`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-md border border-info/30 bg-info/5 p-3 text-sm">
            <div className="flex items-start gap-2">
              {isReplace ? (
                <ShieldAlert className="mt-0.5 h-4 w-4 text-amber-500" />
              ) : (
                <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-500" />
              )}
              <div className="space-y-1">
                <p className="font-medium">Temporary password handling</p>
                <p className="text-xs text-muted-foreground">
                  The backend generates the temporary password and emails
                  it to the new super admin. You will not see, set, or
                  copy a password from this dialog.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="add-sa-fullName">Full name *</Label>
            <Input
              id="add-sa-fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="min-h-[44px]"
              autoComplete="name"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-sa-email">Email *</Label>
            <Input
              id="add-sa-email"
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-h-[44px]"
              autoComplete="email"
              required
            />
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
                  onClick={() => onOpenChange(false)}
                  className="min-h-[44px]"
                >
                  Cancel
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Close without {isReplace ? "replacing" : "adding"} the admin
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="submit"
                  disabled={!canSubmit}
                  className="min-h-[44px]"
                >
                  {isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {isReplace ? "Replace super admin" : "Add super admin"}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isReplace
                  ? "Deactivate the current super admin and email a temporary password to the replacement"
                  : "Provision the new super admin and queue their welcome email"}
              </TooltipContent>
            </Tooltip>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
