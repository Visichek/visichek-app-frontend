"use client";

import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ErrorState } from "@/components/feedback/error-state";
import { useSession } from "@/hooks/use-session";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { useActiveSubscription } from "@/features/subscriptions/hooks/use-subscriptions";
import { ChangePlanForm } from "@/features/checkout/components/change-plan-form";

const LIST_HREF = "/app/billing";

export default function ChangePlanPage() {
  const { tenantId, currentRole } = useSession();
  const { loadingHref, handleNavClick } = useNavigationLoading();
  const canManageBilling = currentRole === "super_admin";

  const { data: activeSubscription } = useActiveSubscription(
    canManageBilling ? tenantId || "" : ""
  );

  if (!canManageBilling) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="min-h-[44px] -ml-2"
            >
              <Link
                href={LIST_HREF}
                onClick={() => handleNavClick(LIST_HREF)}
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
              </Link>
            </Button>
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

  return <ChangePlanForm currentPlanId={activeSubscription?.planId} />;
}
