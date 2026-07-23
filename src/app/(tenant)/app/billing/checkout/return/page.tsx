"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/feedback/error-state";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCheckoutSessionByReference } from "@/features/checkout/hooks/use-checkout";

/**
 * Payment-return page (PAYMENT_CALLBACK_URL target).
 *
 * Paystack/Flutterwave redirect the customer's browser here after they pay,
 * appending the checkout reference as a query param. We resolve that reference
 * back to a session, then hand off to the canonical
 * `/app/billing/checkout/[id]` status page — which already polls and renders
 * every state (pending / succeeded / failed / expired). This page only does
 * the reference → session.id resolution so we don't duplicate that UI.
 */
function CheckoutReturnContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Paystack sends ?reference and ?trxref (same value); Flutterwave sends
  // ?tx_ref. Accept whichever is present.
  const reference =
    searchParams.get("reference") ||
    searchParams.get("trxref") ||
    searchParams.get("tx_ref") ||
    "";

  // Addon purchases (addon_...) and trial card captures (trialcap_...) are
  // not checkout sessions — the by-reference resolver only knows plan
  // checkouts (chk_...). Their outcome is applied by the payment webhook and
  // surfaced on the billing page, so hand off there instead of running (and
  // failing) the session lookup.
  const isNonSessionReference =
    reference.startsWith("addon_") || reference.startsWith("trialcap_");

  const { data: session, isLoading, isError, error, refetch } =
    useCheckoutSessionByReference(isNonSessionReference ? "" : reference);

  // Once resolved, hand off to the canonical status page. `replace` so the
  // browser back button skips this transient resolver.
  useEffect(() => {
    if (isNonSessionReference) {
      router.replace("/app/billing");
      return;
    }
    if (session?.id) {
      router.replace(`/app/billing/checkout/${session.id}`);
    }
  }, [isNonSessionReference, session?.id, router]);

  const billingButton = (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={() => router.push("/app/billing")}
            className="min-h-[44px]"
          >
            Go to billing
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Open your billing overview to see your subscription and payment status
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  // No reference in the URL — the link is malformed or was opened directly.
  if (!reference) {
    return (
      <div className="space-y-6">
        <ErrorState
          title="Missing payment reference"
          message="We couldn't read a payment reference from this link. Open your billing page to check your subscription and payment status."
        />
        <div className="flex justify-center">{billingButton}</div>
      </div>
    );
  }

  // Addon / trial-capture references skip the session lookup entirely; show
  // the finalizing spinner while the effect above redirects to billing.
  if (isNonSessionReference) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <Loader2
          className="h-8 w-8 animate-spin text-primary"
          aria-hidden="true"
        />
        <div className="space-y-1">
          <p className="text-base font-medium">Finalizing your payment…</p>
          <p className="text-sm text-muted-foreground">
            Hang tight — we&apos;re confirming your payment and taking you to
            your billing page.
          </p>
        </div>
      </div>
    );
  }

  // Reference present but no matching session (yet) or a lookup error. The
  // payment may still be processing, so offer a retry plus a way out.
  if (isError || (!isLoading && !session)) {
    return (
      <div className="space-y-6">
        <ErrorState
          title="We couldn't match that payment"
          message="This payment isn't linked to a checkout yet — it may still be processing. Try again in a moment, or open your billing page for the latest status."
          error={error}
          onRetry={() => refetch()}
        />
        <div className="flex justify-center">{billingButton}</div>
      </div>
    );
  }

  // Loading the lookup, or resolved and about to redirect.
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
      <div className="space-y-1">
        <p className="text-base font-medium">Finalizing your payment…</p>
        <p className="text-sm text-muted-foreground">
          Hang tight — we&apos;re confirming your payment and taking you to the
          result.
        </p>
      </div>
    </div>
  );
}

export default function CheckoutReturnPage() {
  // useSearchParams requires a Suspense boundary in the App Router.
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2
            className="h-8 w-8 animate-spin text-primary"
            aria-hidden="true"
          />
        </div>
      }
    >
      <CheckoutReturnContent />
    </Suspense>
  );
}
