"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Mail,
  MailCheck,
  ServerCog,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePlatformSettings } from "@/features/settings/hooks";
import { useSendTestNotification } from "@/features/notifications/hooks";

/**
 * Email delivery diagnostics (Issue 6 follow-up).
 *
 * One card that surfaces three things admins need to debug
 * "tenants say emails never arrive":
 *
 *   1. Is the SMTP host configured at all? (read from
 *      `PlatformSettings.smtpHost`)
 *   2. What from-address are we using?
 *   3. Can we actually send to the current admin? (fires the same
 *      `useSendTestNotification` hook the notification preferences
 *      tab uses, so a successful send here proves the whole pipeline,
 *      not just SMTP credentials)
 *
 * The card is read-mostly: edits to SMTP host/port/user/etc. live in
 * the existing platform tab; the diagnostics view is just a
 * status-at-a-glance plus a send button.
 */
export function EmailDiagnosticsCard() {
  const { data: platform, isLoading } = usePlatformSettings();
  const sendTest = useSendTestNotification();
  const [lastResult, setLastResult] = useState<{
    delivered: boolean;
    detail: string;
    timestamp: number;
  } | null>(null);

  const smtpHost = platform?.smtpHost ?? null;
  const smtpPort = platform?.smtpPort ?? null;
  const fromEmail = platform?.smtpFromEmail ?? null;
  const fromName = platform?.smtpFromName ?? null;
  const encryption = platform?.smtpEncryption ?? "none";

  const configured = !!smtpHost && !!fromEmail;

  const fireTest = () => {
    sendTest.mutate(undefined, {
      onSuccess: (result) => {
        const ts = Math.floor(Date.now() / 1000);
        if (result.delivered) {
          setLastResult({
            delivered: true,
            detail: "Test message accepted by the provider.",
            timestamp: ts,
          });
          toast.success("Test sent — check your inbox shortly.");
        } else {
          const reason =
            result.skippedReason?.replace(/_/g, " ") ??
            result.message ??
            "Provider did not accept the message.";
          setLastResult({ delivered: false, detail: reason, timestamp: ts });
          toast.warning(`Test skipped: ${reason}`);
        }
      },
      onError: (err) => {
        const ts = Math.floor(Date.now() / 1000);
        const detail =
          err instanceof Error ? err.message : "Couldn't send test email";
        setLastResult({ delivered: false, detail, timestamp: ts });
        toast.error(detail);
      },
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <ServerCog className="h-4 w-4" aria-hidden="true" />
          Email delivery diagnostics
        </CardTitle>
        <CardDescription>
          Quick status of the platform's outgoing-email pipeline. Edits to
          SMTP credentials live in the security section above; this card is
          read-only.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status row */}
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading platform settings…
          </div>
        ) : configured ? (
          <div className="flex items-start gap-2 rounded-md border border-emerald-400/40 bg-emerald-50/30 dark:bg-emerald-500/[0.06] p-3 text-sm">
            <CheckCircle2
              className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
              aria-hidden="true"
            />
            <div className="space-y-1 min-w-0">
              <p className="font-medium">SMTP host configured</p>
              <p className="text-xs text-muted-foreground">
                Outgoing mail is wired up to{" "}
                <code className="rounded bg-background/60 px-1 py-0.5 text-[11px]">
                  {smtpHost}
                  {smtpPort ? `:${smtpPort}` : ""}
                </code>
                . Configuration shown below.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-md border border-amber-400/60 bg-amber-50/40 dark:bg-amber-500/[0.06] p-3 text-sm">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
              aria-hidden="true"
            />
            <div className="space-y-1 min-w-0">
              <p className="font-medium">SMTP host not configured</p>
              <p className="text-xs text-muted-foreground">
                Until <code>smtpHost</code> and <code>smtpFromEmail</code> are
                set in platform settings, every email notification is
                silently skipped. Tenants who report missing notifications are
                almost certainly hitting this.
              </p>
            </div>
          </div>
        )}

        {/* Configuration summary */}
        <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div className="rounded-md border bg-background/40 p-3">
            <dt className="text-xs font-semibold text-muted-foreground">
              From address
            </dt>
            <dd className="mt-1 text-sm">
              {fromEmail ? (
                <>
                  {fromName ? `${fromName} ` : ""}
                  <span className="text-muted-foreground">
                    &lt;{fromEmail}&gt;
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">Not set</span>
              )}
            </dd>
          </div>
          <div className="rounded-md border bg-background/40 p-3">
            <dt className="text-xs font-semibold text-muted-foreground">
              Encryption
            </dt>
            <dd className="mt-1 text-sm uppercase">
              {encryption ?? "none"}
            </dd>
          </div>
        </dl>

        {/* Test send */}
        <div className="flex flex-col gap-3 rounded-md border bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Mail
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <span>
              Send yourself a test message using the configured provider. Use
              this after any SMTP credential change to verify the change
              before tenants notice.
            </span>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={fireTest}
                disabled={sendTest.isPending || !configured}
                className="min-h-[36px]"
              >
                {sendTest.isPending ? (
                  <Loader2
                    className="mr-2 h-3.5 w-3.5 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <MailCheck
                    className="mr-2 h-3.5 w-3.5"
                    aria-hidden="true"
                  />
                )}
                Send test email
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              {configured
                ? "Fires POST /notifications/test using the SMTP provider above."
                : "Configure SMTP first — without smtpHost the test would just silently skip."}
            </TooltipContent>
          </Tooltip>
        </div>

        {lastResult && (
          <div
            role="status"
            className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
              lastResult.delivered
                ? "border-emerald-400/40 bg-emerald-50/30 dark:bg-emerald-500/[0.06]"
                : "border-amber-400/60 bg-amber-50/40 dark:bg-amber-500/[0.06]"
            }`}
          >
            {lastResult.delivered ? (
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                aria-hidden="true"
              />
            ) : (
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
                aria-hidden="true"
              />
            )}
            <div className="min-w-0 space-y-0.5">
              <p className="font-medium">
                {lastResult.delivered ? "Last test: delivered" : "Last test: skipped"}
              </p>
              <p className="text-xs text-muted-foreground">{lastResult.detail}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
