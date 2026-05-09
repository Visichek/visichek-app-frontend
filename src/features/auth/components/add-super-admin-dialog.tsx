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
import { useAddTenantSuperAdmin } from "@/features/auth/hooks/use-admin-dashboard";
import { ApiError } from "@/types/api";
import type { AddTenantSuperAdminResponse } from "@/types/user";

interface AddSuperAdminDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  tenantName: string;
}

/**
 * App-admin modal for adding a super_admin to an EXISTING tenant.
 *
 * Distinct from the bootstrap-tenant flow which provisions the tenant
 * and the first super_admin together. This is the path for offboarded /
 * lost-credentials / redundant-admin scenarios.
 *
 * On success the API returns the new user's access + refresh tokens
 * along with the password the actor just chose. The dialog shows them
 * once with copy-to-clipboard handles so the actor can deliver them
 * out-of-band — the API does NOT email them.
 */
export function AddSuperAdminDialog({
  open,
  onOpenChange,
  tenantId,
  tenantName,
}: AddSuperAdminDialogProps) {
  const addSuperAdmin = useAddTenantSuperAdmin();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [result, setResult] = useState<
    | (AddTenantSuperAdminResponse & { plainPassword: string })
    | null
  >(null);

  useEffect(() => {
    if (!open) {
      setFullName("");
      setEmail("");
      setPassword("");
      setShowPassword(false);
      setServerError(null);
      setResult(null);
    }
  }, [open]);

  const ruleResults = useMemo(
    () => PASSWORD_RULES.map((rule) => ({ ...rule, passed: rule.test(password) })),
    [password]
  );
  const passedCount = ruleResults.filter((r) => r.passed).length;
  const strength = getStrengthLevel(passedCount, PASSWORD_RULES.length);
  const allPassed = passedCount === PASSWORD_RULES.length;

  const isEmailValid = /\S+@\S+\.\S+/.test(email);
  const canSubmit =
    fullName.trim().length > 0 &&
    isEmailValid &&
    allPassed &&
    !addSuperAdmin.isPending &&
    !result;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setServerError(null);
    try {
      const response = await addSuperAdmin.mutateAsync({
        tenantId,
        // branchIds omitted — server defaults to the tenant's HQ branch.
        data: {
          fullName: fullName.trim(),
          email: email.trim(),
          password,
        },
      });
      setResult({ ...response, plainPassword: password });
      toast.success("Super admin added");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 400 || err.status === 409 || err.status === 422) {
          setServerError(err.message);
          return;
        }
      }
      setServerError(
        err instanceof Error ? err.message : "Failed to add super admin"
      );
    }
  };

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied to clipboard`);
    } catch {
      toast.error(`Couldn't copy ${label} — copy it manually.`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {result ? "Super admin added" : "Add super admin"}
          </DialogTitle>
          <DialogDescription>
            {result
              ? `Send ${
                  result.fullName
                } the credentials below privately. They won't be shown again.`
              : `Add a new super_admin to ${tenantName}. Use this for offboarded admins, redundancy, or restoring access. The API does not email credentials — copy them out at the end and send them out-of-band.`}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3">
            <CredentialRow
              label="Email"
              value={result.email}
              onCopy={() => copy("Email", result.email)}
            />
            <CredentialRow
              label="Password"
              value={result.plainPassword}
              onCopy={() => copy("Password", result.plainPassword)}
              mono
            />
            <CredentialRow
              label="Access token"
              value={result.accessToken}
              onCopy={() => copy("Access token", result.accessToken)}
              mono
              truncate
            />
            <CredentialRow
              label="Refresh token"
              value={result.refreshToken}
              onCopy={() => copy("Refresh token", result.refreshToken)}
              mono
              truncate
            />
            <DialogFooter>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    onClick={() => onOpenChange(false)}
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
            <div className="space-y-2">
              <Label htmlFor="add-sa-password">Initial password *</Label>
              <div className="relative">
                <Input
                  id="add-sa-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (serverError) setServerError(null);
                  }}
                  className="pr-10 min-h-[44px]"
                  autoComplete="new-password"
                  required
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {showPassword ? "Hide password" : "Show password"}
                  </TooltipContent>
                </Tooltip>
              </div>
              {password.length > 0 && (
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
                <p className="text-sm text-destructive" role="alert">
                  {serverError}
                </p>
              )}
            </div>

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
                <TooltipContent>Close without adding the admin</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="submit"
                    disabled={!canSubmit}
                    className="min-h-[44px]"
                  >
                    {addSuperAdmin.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Add super admin
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Provision the new super admin and show their credentials
                </TooltipContent>
              </Tooltip>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface CredentialRowProps {
  label: string;
  value: string;
  onCopy: () => void;
  mono?: boolean;
  truncate?: boolean;
}

function CredentialRow({
  label,
  value,
  onCopy,
  mono,
  truncate,
}: CredentialRowProps) {
  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-1">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex-1 break-all text-sm",
            mono ? "font-mono" : "",
            truncate ? "line-clamp-2" : ""
          )}
        >
          {value}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={onCopy}
              aria-label={`Copy ${label.toLowerCase()} to clipboard`}
              className="min-h-[44px]"
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Copy {label.toLowerCase()} to clipboard</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
