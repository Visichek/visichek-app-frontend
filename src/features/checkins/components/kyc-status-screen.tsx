"use client";

/**
 * Post-submit status screens for the kiosk.
 *
 * Three terminal-ish UI states share a layout:
 *   - `awaiting_approval`: KYC done (or skipped, or not required) — show
 *     "wait for the receptionist" with the queue-position copy.
 *   - `verifying`: the Dojah widget reported success but the webhook
 *     hasn't arrived yet (or the kiosk is polling `/kyc/status`).
 *   - `failed`: KYC failed or the visitor closed inconclusively after
 *     the doc-recommended poll window expired. Offer a retry CTA.
 *
 * Orchestration (when to render which state) lives in the kiosk page —
 * this component is presentational only.
 */

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type KycStatusScreenState = "verifying" | "awaiting_approval" | "failed";

export interface KycStatusScreenProps {
  state: KycStatusScreenState;
  /** Optional copy shown under the title. Falls back to a sensible default. */
  message?: string;
  /** Tenant name shown in the awaiting-approval message. */
  tenantName?: string;
  /** Provided when `state === "failed"` to expose the retry CTA. */
  onRetry?: () => void;
  /** Disables retry while a follow-up request is in flight. */
  retrying?: boolean;
}

export function KycStatusScreen({
  state,
  message,
  tenantName,
  onRetry,
  retrying,
}: KycStatusScreenProps) {
  if (state === "verifying") {
    return (
      <div className="text-center space-y-4 py-6" role="status" aria-live="polite">
        <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-display">Verifying your identity</h2>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          {message ??
            "Hang tight — we're confirming your verification. This usually takes a few seconds."}
        </p>
      </div>
    );
  }

  if (state === "awaiting_approval") {
    return (
      <div className="text-center space-y-4 py-6" role="status" aria-live="polite">
        <div className="mx-auto h-16 w-16 rounded-full bg-success/10 text-success flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-display">You&apos;re checked in</h2>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          {message ??
            (tenantName
              ? `Your check-in has been sent to ${tenantName}. Please have a seat — a receptionist will be with you shortly.`
              : "Your check-in is waiting for receptionist approval. Please have a seat.")}
        </p>
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-2">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Approval is usually under a minute.</span>
        </div>
      </div>
    );
  }

  // failed
  return (
    <div className="text-center space-y-4 py-6" role="alert">
      <div className="mx-auto h-16 w-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
        <AlertTriangle className="h-8 w-8" aria-hidden="true" />
      </div>
      <h2 className="text-xl font-display">Verification didn&apos;t go through</h2>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto">
        {message ??
          "We couldn't confirm your identity. You can try again, or ask a receptionist for help."}
      </p>
      {onRetry && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button onClick={onRetry} disabled={retrying}>
              {retrying ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCcw className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Try again
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            Reopen the verification widget and try the check again
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
