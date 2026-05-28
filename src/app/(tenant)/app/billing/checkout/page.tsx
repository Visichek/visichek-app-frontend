"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { NavButton } from "@/components/recipes/nav-button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ErrorState } from "@/components/feedback/error-state";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { useSession } from "@/hooks/use-session";
import { useCapabilities } from "@/hooks/use-capabilities";
import { CAPABILITIES } from "@/lib/permissions/capabilities";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { useActiveSubscription } from "@/features/subscriptions/hooks/use-subscriptions";
import { useMyUsage } from "@/features/usage/hooks/use-usage";
import { ChangePlanForm } from "@/features/checkout/components/change-plan-form";
import type { BillingCycle, PlanTier } from "@/types/enums";

const LIST_HREF = "/app/billing";

function parseBillingCycle(value: string | null): BillingCycle | undefined {
  return value === "monthly" || value === "yearly" ? value : undefined;
}

/**
 * Checkout deep-link entry (`/app/billing/checkout?planId=…&discountCode=…`).
 *
 * Reached from "A discount is available" notifications. It pre-fills the
 * plan picker with the linked plan and auto-applies the discount code, then
 * lets the user review the discounted summary and click through to checkout.
 * We intentionally do NOT auto-create a checkout session on load — starting a
 * payment flow is an explicit, user-confirmed action.
 *
 * `planId` may be absent (global-scope discounts), in which case the user
 * picks a plan first and the code is applied once they do. The sibling
 * `/app/billing/checkout/[id]` route remains the post-creation status page.
 */
function CheckoutDeepLink() {
  const searchParams = useSearchParams();
  const { tenantId } = useSession();
  const { hasCapability } = useCapabilities();
  const { loadingHref } = useNavigationLoading();

  const canManageBilling = hasCapability(CAPABILITIES.BILLING_MANAGE);

  const { data: activeSubscription } = useActiveSubscription(
    canManageBilling ? tenantId || "" : ""
  );
  const { data: usage } = useMyUsage();
  const currentPlanTier = usage?.planTier
    ? (usage.planTier as PlanTier)
    : undefined;

  if (!canManageBilling) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <NavButton
              href={LIST_HREF}
              variant="ghost"
              size="sm"
              className="min-h-[44px] -ml-2"
            >
              {loadingHref === LIST_HREF ? (
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Back to billing
            </NavButton>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Return to the billing and usage page
          </TooltipContent>
        </Tooltip>
        <ErrorState
          title="You can't change the billing plan"
          message="Only a super admin can pick or change the subscription plan for this tenant."
        />
      </div>
    );
  }

  const planId = searchParams.get("planId") || undefined;
  const discountCode = searchParams.get("discountCode") || undefined;
  const billingCycle = parseBillingCycle(searchParams.get("billingCycle"));

  return (
    <ChangePlanForm
      currentPlanId={activeSubscription?.planId}
      currentPlanTier={currentPlanTier}
      initialPlanId={planId}
      initialDiscountCode={discountCode}
      initialBillingCycle={billingCycle}
    />
  );
}

export default function CheckoutDeepLinkPage() {
  // useSearchParams() needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CheckoutDeepLink />
    </Suspense>
  );
}
