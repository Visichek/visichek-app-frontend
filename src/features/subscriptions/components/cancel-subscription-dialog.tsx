"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ResponsiveModal } from "@/components/recipes/responsive-modal";
import { useCancelSubscription } from "@/features/subscriptions/hooks/use-subscriptions";
import { formatDate } from "@/lib/utils/format-date";
import { cn } from "@/lib/utils/cn";

export interface CancelSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  /** Unix epoch seconds; rendered to the user as the period-end date. */
  periodEnd?: number;
  /** Human label shown in the body copy ("Premium", "Starter"). */
  planLabel?: string;
  onCancelled?: () => void;
}

type CancelMode = "end_of_period" | "immediate";

/**
 * Cancel-subscription dialog.
 *
 * Tenants pick between two distinct outcomes:
 *
 * - End of period — non-renewal flag; paid features stay on until
 *   `current_period_end`; the renewal sweeper drops the tenant to FREE
 *   the moment the period ends.
 * - Immediate — the paid subscription expires now, the tenant is
 *   provisioned on FREE, and non-HQ branches flip to inactive
 *   automatically. Use sparingly.
 */
export function CancelSubscriptionDialog({
  open,
  onOpenChange,
  tenantId,
  periodEnd,
  planLabel,
  onCancelled,
}: CancelSubscriptionDialogProps) {
  const [mode, setMode] = useState<CancelMode>("end_of_period");
  const [reason, setReason] = useState<string>("");
  const cancelMutation = useCancelSubscription();

  const periodEndLabel = periodEnd ? formatDate(periodEnd) : null;

  async function handleConfirm() {
    try {
      await cancelMutation.mutateAsync({
        tenantId,
        immediate: mode === "immediate",
        reason: reason.trim() || undefined,
      });
      toast.success(
        mode === "immediate"
          ? "Subscription cancelled. You're now on the Free plan."
          : periodEndLabel
            ? `Subscription will end on ${periodEndLabel}.`
            : "Subscription will not renew at the end of the period.",
      );
      onCancelled?.();
      onOpenChange(false);
      setReason("");
      setMode("end_of_period");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Couldn't cancel the subscription. Please try again.",
      );
    }
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(next) => {
        if (cancelMutation.isPending) return;
        onOpenChange(next);
      }}
      title={
        planLabel ? `Cancel ${planLabel} subscription` : "Cancel subscription"
      }
      description="Pick when the cancellation takes effect. You can re-subscribe at any time."
    >
      <div className="space-y-5">
        <div
          role="radiogroup"
          aria-label="Cancellation timing"
          className="space-y-2"
        >
          <CancelOption
            id="cancel-end-of-period"
            checked={mode === "end_of_period"}
            onSelect={() => setMode("end_of_period")}
            title="At the end of the current billing period"
            tooltip="Stop the subscription from renewing. You keep paid features until the period ends, then drop to the Free plan automatically."
            body={
              periodEndLabel ? (
                <>
                  Keeps paid features until <strong>{periodEndLabel}</strong>,
                  then drops to the Free plan automatically. You can undo this
                  any time before then.
                </>
              ) : (
                <>
                  Keeps paid features until the period ends, then drops to the
                  Free plan automatically.
                </>
              )
            }
          />
          <CancelOption
            id="cancel-immediate"
            checked={mode === "immediate"}
            onSelect={() => setMode("immediate")}
            title="Right away"
            tooltip="End the subscription now and switch to Free. Non-HQ branches will be deactivated and paid features stop immediately."
            body={
              <>
                Ends the subscription now and switches to the Free plan.{" "}
                <strong>Non-HQ branches are deactivated</strong> and paid
                features (multi-location, branding, KYC, exports,
                appointments) stop working immediately. Visitor logs and
                configuration are preserved.
              </>
            }
            tone="warning"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cancel-reason">
            Reason (optional)
          </Label>
          <Textarea
            id="cancel-reason"
            placeholder="Help us improve — why are you cancelling?"
            rows={3}
            className="text-base md:text-sm"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={cancelMutation.isPending}
          />
        </div>

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={cancelMutation.isPending}
                className="min-h-[44px] w-full sm:w-auto"
              >
                Keep subscription
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Close this dialog without cancelling — your subscription stays
              active.
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="destructive"
                onClick={handleConfirm}
                disabled={cancelMutation.isPending}
                className="min-h-[44px] w-full sm:w-auto"
              >
                {cancelMutation.isPending ? (
                  <>
                    <Loader2
                      className="mr-2 h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                    Cancelling…
                  </>
                ) : mode === "immediate" ? (
                  "Cancel now"
                ) : (
                  "End at period end"
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {mode === "immediate"
                ? "Cancel immediately and switch to the Free plan now."
                : "Stop the subscription from renewing at the end of the current period."}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </ResponsiveModal>
  );
}

function CancelOption({
  id,
  checked,
  onSelect,
  title,
  body,
  tooltip,
  tone = "default",
}: {
  id: string;
  checked: boolean;
  onSelect: () => void;
  title: string;
  body: React.ReactNode;
  tooltip: string;
  tone?: "default" | "warning";
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          id={id}
          type="button"
          role="radio"
          aria-checked={checked}
          onClick={onSelect}
          className={cn(
            "w-full rounded-lg border p-4 text-left transition-all min-h-[44px]",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            checked && tone === "warning"
              ? "border-destructive bg-destructive/5 ring-2 ring-destructive/30"
              : checked
                ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                : "hover:border-foreground/30",
          )}
        >
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                checked && tone === "warning"
                  ? "border-destructive"
                  : checked
                    ? "border-primary"
                    : "border-muted-foreground/40",
              )}
              aria-hidden="true"
            >
              {checked && (
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    tone === "warning" ? "bg-destructive" : "bg-primary",
                  )}
                />
              )}
            </span>
            <div className="space-y-1">
              <p className="text-sm font-medium">{title}</p>
              <p className="text-xs text-muted-foreground">{body}</p>
            </div>
          </div>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{tooltip}</TooltipContent>
    </Tooltip>
  );
}
