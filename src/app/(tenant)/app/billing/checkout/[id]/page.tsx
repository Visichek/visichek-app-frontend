"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/recipes/page-header";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useCheckoutSession,
  useCancelCheckoutSession,
  resolveCheckoutUrl,
} from "@/features/checkout/hooks/use-checkout";
import { useSession } from "@/hooks/use-session";
import { formatCurrency } from "@/lib/utils/format-currency";
import { formatDate } from "@/lib/utils/format-date";
import { ApiError } from "@/types/api";
import type { CheckoutSessionStatus } from "@/types/billing";

// Match the integration-guide cadence: aggressive polling for 30s, slower for
// the next 2 minutes, then give up.
const GIVE_UP_AFTER_MS = 2 * 60_000 + 30_000;

function statusBadgeVariant(
  status: CheckoutSessionStatus
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "succeeded":
      return "secondary";
    case "pending":
      return "default";
    case "failed":
    case "expired":
      return "destructive";
    case "cancelled":
      return "outline";
    default:
      return "default";
  }
}

function statusLabel(status: CheckoutSessionStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function cancelErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) return "This session can no longer be cancelled.";
    return error.message;
  }
  return error instanceof Error ? error.message : "Couldn't cancel the session.";
}

export default function CheckoutStatusPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { tenantId } = useSession();

  const sessionId = typeof params?.id === "string" ? params.id : "";

  const {
    data: session,
    isLoading,
    isError,
    error,
    refetch,
  } = useCheckoutSession(sessionId, { poll: true });

  const cancelMutation = useCancelCheckoutSession();

  // Track whether polling has timed out based on the session's creation time.
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (!session || session.status !== "pending") {
      setTimedOut(false);
      return;
    }
    const createdAtMs = session.dateCreated * 1000;
    const remaining = createdAtMs + GIVE_UP_AFTER_MS - Date.now();
    if (remaining <= 0) {
      setTimedOut(true);
      return;
    }
    const t = setTimeout(() => setTimedOut(true), remaining);
    return () => clearTimeout(t);
  }, [session]);

  // When the session succeeds, refresh active subscription so the billing
  // overview reflects the new plan when the user navigates back.
  useEffect(() => {
    if (session?.status === "succeeded" && tenantId) {
      queryClient.invalidateQueries({
        queryKey: ["subscriptions", "tenant", tenantId, "active"],
      });
      queryClient.invalidateQueries({ queryKey: ["usage"] });
    }
  }, [session?.status, tenantId, queryClient]);

  const checkoutUrlAbs = useMemo(
    () => (session?.checkoutUrl ? resolveCheckoutUrl(session.checkoutUrl) : null),
    [session?.checkoutUrl]
  );

  async function handleCancel() {
    if (!session) return;
    try {
      await cancelMutation.mutateAsync(session.id);
      toast.success("Checkout cancelled.");
    } catch (err) {
      toast.error(cancelErrorMessage(err));
    }
  }

  if (isLoading) return <PageSkeleton />;

  if (isError || !session) {
    return (
      <ErrorState
        title="Couldn't load this checkout"
        error={error}
        onRetry={() => refetch()}
      />
    );
  }

  const isPending = session.status === "pending";
  const isTerminal = !isPending;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        <PageHeader
          title="Checkout"
          description="We'll update this page automatically once your payment is complete."
          actions={
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  onClick={() => router.push("/app/billing")}
                  className="min-h-[44px] gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to billing
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Return to your billing overview
              </TooltipContent>
            </Tooltip>
          }
        />

        <Card>
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-lg">Session status</CardTitle>
            <Badge
              variant={statusBadgeVariant(session.status)}
              className="capitalize"
            >
              {statusLabel(session.status)}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Status hero */}
            <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4">
              {isPending && !timedOut && (
                <Loader2
                  className="mt-0.5 h-5 w-5 animate-spin text-primary"
                  aria-hidden="true"
                />
              )}
              {isPending && timedOut && (
                <Clock
                  className="mt-0.5 h-5 w-5 text-muted-foreground"
                  aria-hidden="true"
                />
              )}
              {session.status === "succeeded" && (
                <CheckCircle2
                  className="mt-0.5 h-5 w-5 text-emerald-500"
                  aria-hidden="true"
                />
              )}
              {(session.status === "failed" || session.status === "expired") && (
                <XCircle
                  className="mt-0.5 h-5 w-5 text-destructive"
                  aria-hidden="true"
                />
              )}
              {session.status === "cancelled" && (
                <XCircle
                  className="mt-0.5 h-5 w-5 text-muted-foreground"
                  aria-hidden="true"
                />
              )}

              <div className="space-y-1 text-sm">
                {isPending && !timedOut && (
                  <>
                    <p className="font-medium">Waiting for payment</p>
                    <p className="text-muted-foreground">
                      Complete the checkout in the other tab. This page will
                      update as soon as the payment clears.
                    </p>
                  </>
                )}
                {isPending && timedOut && (
                  <>
                    <p className="font-medium">Still processing</p>
                    <p className="text-muted-foreground">
                      This is taking longer than usual. You can safely close
                      this page — we'll email you once the payment is
                      confirmed.
                    </p>
                  </>
                )}
                {session.status === "succeeded" && (
                  <>
                    <p className="font-medium">Payment confirmed</p>
                    <p className="text-muted-foreground">
                      Your subscription is active. You can close this page or
                      head back to billing.
                    </p>
                  </>
                )}
                {session.status === "failed" && (
                  <>
                    <p className="font-medium">Payment failed</p>
                    <p className="text-muted-foreground">
                      {session.failureReason ??
                        "The payment could not be completed. Try again or contact support."}
                    </p>
                  </>
                )}
                {session.status === "expired" && (
                  <>
                    <p className="font-medium">Session expired</p>
                    <p className="text-muted-foreground">
                      This checkout session expired before payment was
                      completed. Start a new one from the billing page.
                    </p>
                  </>
                )}
                {session.status === "cancelled" && (
                  <>
                    <p className="font-medium">Checkout cancelled</p>
                    <p className="text-muted-foreground">
                      You cancelled this checkout. No charge was made.
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Summary rows */}
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Amount</dt>
                <dd className="font-medium tabular-nums">
                  {formatCurrency(session.amountMinor, session.currency)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Billing cycle</dt>
                <dd className="font-medium capitalize">
                  {session.billingCycle}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Provider</dt>
                <dd className="font-medium capitalize">{session.provider}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Created</dt>
                <dd className="font-medium">
                  {formatDate(session.dateCreated)}
                </dd>
              </div>
              {session.breakdown.totalPercentageOff > 0 && (
                <div>
                  <dt className="text-muted-foreground">Discount</dt>
                  <dd className="font-medium">
                    {session.breakdown.totalPercentageOff}% off
                  </dd>
                </div>
              )}
              {session.subscriptionId && (
                <div>
                  <dt className="text-muted-foreground">Subscription</dt>
                  <dd className="font-mono text-xs">{session.subscriptionId}</dd>
                </div>
              )}
            </dl>

            {/* Actions */}
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {isPending && checkoutUrlAbs && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button asChild className="min-h-[44px] gap-2">
                      <a
                        href={checkoutUrlAbs}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Open checkout page
                      </a>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    Re-open the secure payment page in a new tab
                  </TooltipContent>
                </Tooltip>
              )}

              {isPending && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      onClick={handleCancel}
                      disabled={cancelMutation.isPending}
                      className="min-h-[44px]"
                    >
                      {cancelMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Cancelling...
                        </>
                      ) : (
                        "Cancel checkout"
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    Cancel this pending checkout — no charge will be made
                  </TooltipContent>
                </Tooltip>
              )}

              {isTerminal && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => router.push("/app/billing")}
                      className="min-h-[44px]"
                    >
                      Return to billing
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    Go back to your billing overview
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
