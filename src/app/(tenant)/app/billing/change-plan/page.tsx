"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import { NavButton } from "@/components/recipes/nav-button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ErrorState } from "@/components/feedback/error-state";
import { useSession } from "@/hooks/use-session";
import { useCapabilities } from "@/hooks/use-capabilities";
import { CAPABILITIES } from "@/lib/permissions/capabilities";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { useActiveSubscription } from "@/features/subscriptions/hooks/use-subscriptions";
import { useMyUsage } from "@/features/usage/hooks/use-usage";
import { ChangePlanForm } from "@/features/checkout/components/change-plan-form";
import type { PlanTier } from "@/types/enums";

const LIST_HREF = "/app/billing";

export default function ChangePlanPage() {
  const { tenantId } = useSession();
  const { hasCapability } = useCapabilities();
  const { loadingHref } = useNavigationLoading();
  // Capability-gated (was `currentRole === "super_admin"`). Same set
  // of users authorized today; future role changes flow through the
  // capability map without touching this page.
  const canManageBilling = hasCapability(CAPABILITIES.BILLING_MANAGE);

  const { data: activeSubscription } = useActiveSubscription(
    canManageBilling ? tenantId || "" : ""
  );
  const { data: usage } = useMyUsage();
  const currentPlanTier = (
    usage?.planTier ? (usage.planTier as PlanTier) : undefined
  );

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

  return (
    <ChangePlanForm
      currentPlanId={activeSubscription?.planId}
      currentPlanTier={currentPlanTier}
    />
  );
}
