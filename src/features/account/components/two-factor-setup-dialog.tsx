"use client";

import { useState, useCallback } from "react";
import {
  Loader2,
  KeyRound,
  Copy,
  Check,
  Download,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils/cn";
import {
  useSetup2FA,
  useVerify2FA,
} from "@/features/account/hooks";
import { toast } from "sonner";

type SetupStep = "init" | "scan" | "verify" | "backup" | "done";

interface TwoFactorSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

export function TwoFactorSetupDialog({
  open,
  onOpenChange,
  onComplete,
}: TwoFactorSetupDialogProps) {
  const [step, setStep] = useState<SetupStep>("init");
  const [secret, setSecret] = useState("");
  const [qrCodeUri, setQrCodeUri] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verifyCode, setVerifyCode] = useState("");
  const [secretCopied, setSecretCopied] = useState(false);

  const setup2FA = useSetup2FA();
  const verify2FA = useVerify2FA();

  const handleClose = useCallback(
    (v: boolean) => {
      if (!v) {
        // Reset state on close
        setStep("init");
        setSecret("");
        setQrCodeUri("");
        setBackupCodes([]);
        setVerifyCode("");
        setSecretCopied(false);
      }
      onOpenChange(v);
    },
    [onOpenChange]
  );

  const handleInitSetup = async () => {
    try {
      const data = await setup2FA.mutateAsync();
      setSecret(data.secret);
      setQrCodeUri(data.qrCodeUri);
      setBackupCodes(data.backupCodes);
      setStep("scan");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to start 2FA setup";
      toast.error(message);
    }
  };

  const handleVerify = async () => {
    if (verifyCode.length !== 6) return;
    try {
      await verify2FA.mutateAsync({ code: verifyCode });
      setStep("backup");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Invalid verification code";
      toast.error(message);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setSecretCopied(true);
    setTimeout(() => setSecretCopied(false), 2000);
    toast.success("Secret copied to clipboard");
  };

  const downloadBackupCodes = () => {
    const content = [
      "VisiChek 2FA Backup Codes",
      "=".repeat(30),
      "",
      "Each code can only be used once.",
      "Store these codes in a safe place.",
      "",
      ...backupCodes.map((code, i) => `${i + 1}. ${code}`),
      "",
      `Generated: ${new Date().toISOString()}`,
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "visichek-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Backup codes downloaded");
  };

  const handleDone = () => {
    handleClose(false);
    onComplete?.();
    toast.success("Two-factor authentication enabled");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {/* ── Step: Init ────────────────────────────────────── */}
        {step === "init" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                Enable two-factor authentication
              </DialogTitle>
              <DialogDescription>
                Add a second layer of security to your account using an
                authenticator app like Google Authenticator, Authy, or 1Password.
              </DialogDescription>
            </DialogHeader>
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
                <TooltipContent>Close without enabling 2FA</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleInitSetup}
                    disabled={setup2FA.isPending}
                    className="min-h-[44px]"
                  >
                    {setup2FA.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ArrowRight className="h-4 w-4 mr-2" />
                    )}
                    Get started
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Generate a QR code for your authenticator app
                </TooltipContent>
              </Tooltip>
            </DialogFooter>
          </>
        )}

        {/* ── Step: Scan QR ──────────────────────────────────── */}
        {step === "scan" && (
          <>
            <DialogHeader>
              <DialogTitle>Scan QR code</DialogTitle>
              <DialogDescription>
                Open your authenticator app and scan the QR code below, or enter
                the secret key manually.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center gap-4 py-2">
              {/* QR Code — rendered as a URI the user copies into their app */}
              <div className="rounded-lg border bg-white p-4">
                {/* Use a QR code image. In production, use qrcode.react */}
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCodeUri)}`}
                  alt="Scan this QR code with your authenticator app"
                  width={200}
                  height={200}
                  className="rounded"
                />
              </div>

              <Separator />

              {/* Manual secret entry */}
              <div className="w-full space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Or enter this key manually:
                </Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-md border bg-muted/50 px-3 py-2 text-sm font-mono select-all">
                    {secret}
                  </code>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        onClick={copySecret}
                      >
                        {secretCopied ? (
                          <Check className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {secretCopied ? "Copied!" : "Copy secret to clipboard"}
                    </TooltipContent>
                  </Tooltip>
                </div>
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
                <TooltipContent>Cancel 2FA setup</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => setStep("verify")}
                    className="min-h-[44px]"
                  >
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Next
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Proceed to enter verification code
                </TooltipContent>
              </Tooltip>
            </DialogFooter>
          </>
        )}

        {/* ── Step: Verify Code ──────────────────────────────── */}
        {step === "verify" && (
          <>
            <DialogHeader>
              <DialogTitle>Verify your code</DialogTitle>
              <DialogDescription>
                Enter the 6-digit code from your authenticator app to confirm
                setup.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="otpCode">Verification code</Label>
                <Input
                  id="otpCode"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={verifyCode}
                  onChange={(e) =>
                    setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  className="text-center text-lg tracking-[0.5em] font-mono text-base md:text-lg"
                  autoFocus
                  autoComplete="one-time-code"
                />
              </div>
            </div>

            <DialogFooter>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    onClick={() => setStep("scan")}
                    className="min-h-[44px]"
                  >
                    Back
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Go back to the QR code</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleVerify}
                    disabled={verifyCode.length !== 6 || verify2FA.isPending}
                    className="min-h-[44px]"
                  >
                    {verify2FA.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-4 w-4 mr-2" />
                    )}
                    Verify
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Verify the code and activate 2FA
                </TooltipContent>
              </Tooltip>
            </DialogFooter>
          </>
        )}

        {/* ── Step: Backup Codes ─────────────────────────────── */}
        {step === "backup" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
                Save your backup codes
              </DialogTitle>
              <DialogDescription>
                These 8 single-use codes can be used to sign in if you lose
                access to your authenticator app. They will only be shown once.
              </DialogDescription>
            </DialogHeader>

            <div className="py-2">
              <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/30 p-4">
                {backupCodes.map((code, i) => (
                  <code
                    key={i}
                    className="text-sm font-mono text-center py-1 px-2 rounded bg-background border select-all"
                  >
                    {code}
                  </code>
                ))}
              </div>

              <div className="mt-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full min-h-[44px]"
                      onClick={downloadBackupCodes}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download backup codes
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Save backup codes as a text file
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            <DialogFooter>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={handleDone} className="min-h-[44px]">
                    I've saved my codes
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Confirm you've saved the backup codes and finish setup
                </TooltipContent>
              </Tooltip>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
