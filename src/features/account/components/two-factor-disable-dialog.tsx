"use client";

import { useState, useCallback } from "react";
import { Loader2, ShieldOff } from "lucide-react";
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
import { useDisable2FA } from "@/features/account/hooks";
import { toast } from "sonner";

interface TwoFactorDisableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

export function TwoFactorDisableDialog({
  open,
  onOpenChange,
  onComplete,
}: TwoFactorDisableDialogProps) {
  const [code, setCode] = useState("");
  const disable2FA = useDisable2FA();

  const handleClose = useCallback(
    (v: boolean) => {
      if (!v) setCode("");
      onOpenChange(v);
    },
    [onOpenChange]
  );

  const handleDisable = async () => {
    if (code.length < 6) return;
    try {
      await disable2FA.mutateAsync({ code });
      toast.success("Two-factor authentication has been disabled");
      handleClose(false);
      onComplete?.();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Invalid code. Please try again.";
      toast.error(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldOff className="h-5 w-5 text-destructive" />
            Disable two-factor authentication
          </DialogTitle>
          <DialogDescription>
            Enter your current TOTP code or a backup code to confirm. Your
            account will be less secure without 2FA.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="disableCode">Verification code</Label>
            <Input
              id="disableCode"
              type="text"
              inputMode="numeric"
              maxLength={8}
              placeholder="Enter TOTP or backup code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\s/g, ""))}
              className="text-center text-lg tracking-wider font-mono text-base md:text-lg"
              autoFocus
            />
          </div>
        </div>

        <DialogFooter>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                onClick={() => handleClose(false)}
                className="min-h-[44px]"
              >
                Cancel
              </Button>
            </TooltipTrigger>
            <TooltipContent>Keep 2FA enabled</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="destructive"
                onClick={handleDisable}
                disabled={code.length < 6 || disable2FA.isPending}
                className="min-h-[44px]"
              >
                {disable2FA.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Disable 2FA
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Remove two-factor authentication from your account
            </TooltipContent>
          </Tooltip>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
