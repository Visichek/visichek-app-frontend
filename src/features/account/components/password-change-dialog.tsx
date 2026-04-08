"use client";

import { useState, useMemo } from "react";
import { Eye, EyeOff, Loader2, Check, X } from "lucide-react";
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
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";
import { useChangePassword } from "@/features/account/hooks";
import { toast } from "sonner";

interface PasswordChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PasswordRule {
  label: string;
  test: (pw: string) => boolean;
}

const PASSWORD_RULES: PasswordRule[] = [
  { label: "At least 8 characters", test: (pw) => pw.length >= 8 },
  { label: "One uppercase letter", test: (pw) => /[A-Z]/.test(pw) },
  { label: "One lowercase letter", test: (pw) => /[a-z]/.test(pw) },
  { label: "One digit", test: (pw) => /\d/.test(pw) },
  { label: "One special character", test: (pw) => /[^A-Za-z0-9]/.test(pw) },
  {
    label: "No 4+ sequential characters",
    test: (pw) => !hasSequentialChars(pw),
  },
  {
    label: "No 4+ repeated characters",
    test: (pw) => !/(.)\1{3,}/.test(pw),
  },
];

function hasSequentialChars(pw: string): boolean {
  for (let i = 0; i <= pw.length - 4; i++) {
    const codes = [
      pw.charCodeAt(i),
      pw.charCodeAt(i + 1),
      pw.charCodeAt(i + 2),
      pw.charCodeAt(i + 3),
    ];
    const isAscending =
      codes[1] - codes[0] === 1 &&
      codes[2] - codes[1] === 1 &&
      codes[3] - codes[2] === 1;
    const isDescending =
      codes[0] - codes[1] === 1 &&
      codes[1] - codes[2] === 1 &&
      codes[2] - codes[3] === 1;
    if (isAscending || isDescending) return true;
  }
  return false;
}

function getStrengthLevel(passed: number, total: number): {
  label: string;
  color: string;
  width: string;
} {
  const ratio = passed / total;
  if (ratio < 0.4) return { label: "Weak", color: "bg-destructive", width: "w-1/4" };
  if (ratio < 0.7) return { label: "Fair", color: "bg-amber-500", width: "w-1/2" };
  if (ratio < 1) return { label: "Good", color: "bg-blue-500", width: "w-3/4" };
  return { label: "Strong", color: "bg-emerald-500", width: "w-full" };
}

export function PasswordChangeDialog({
  open,
  onOpenChange,
}: PasswordChangeDialogProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const changePassword = useChangePassword();

  const ruleResults = useMemo(
    () => PASSWORD_RULES.map((rule) => ({ ...rule, passed: rule.test(newPassword) })),
    [newPassword]
  );

  const passedCount = ruleResults.filter((r) => r.passed).length;
  const strength = getStrengthLevel(passedCount, PASSWORD_RULES.length);
  const allPassed = passedCount === PASSWORD_RULES.length;
  const passwordsMatch = newPassword === confirmPassword;
  const canSubmit =
    currentPassword.length > 0 &&
    allPassed &&
    passwordsMatch &&
    !changePassword.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    try {
      await changePassword.mutateAsync({ currentPassword, newPassword });
      toast.success("Password changed successfully");
      onOpenChange(false);
      resetForm();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to change password";
      toast.error(message);
    }
  };

  const resetForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrent(false);
    setShowNew(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetForm();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>
            Enter your current password and choose a new one that meets all the
            requirements below.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current password */}
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current password</Label>
            <div className="relative">
              <Input
                id="currentPassword"
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="pr-10 text-base md:text-sm"
                autoComplete="current-password"
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setShowCurrent(!showCurrent)}
                  >
                    {showCurrent ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {showCurrent ? "Hide password" : "Show password"}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* New password */}
          <div className="space-y-2">
            <Label htmlFor="newPassword">New password</Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="pr-10 text-base md:text-sm"
                autoComplete="new-password"
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setShowNew(!showNew)}
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

            {/* Strength indicator */}
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

                {/* Rule checklist */}
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
          </div>

          {/* Confirm password */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="text-base md:text-sm"
              autoComplete="new-password"
            />
            {confirmPassword.length > 0 && !passwordsMatch && (
              <p className="text-xs text-destructive">Passwords do not match</p>
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
              <TooltipContent>Close without changing your password</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="submit"
                  disabled={!canSubmit}
                  className="min-h-[44px]"
                >
                  {changePassword.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Change password
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Save your new password
              </TooltipContent>
            </Tooltip>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
