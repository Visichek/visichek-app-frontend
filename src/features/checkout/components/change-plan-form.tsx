"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/recipes/page-header";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/format-currency";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { usePlans } from "@/features/plans/hooks/use-plans";
import {
  useCreateCheckoutSession,
  resolveCheckoutUrl,
} from "@/features/checkout/hooks/use-checkout";
import type { Plan } from "@/types/billing";
import type { BillingCycle } from "@/types/enums";
import { ApiError } from "@/types/api";

const LIST_HREF = "/app/billing";

export interface ChangePlanFormProps {
  /** Currently active plan id — highlighted and disabled in the picker. */
  currentPlanId?: string;
}

function messageForError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return error instanceof Error
      ? error.message
      : "Something went wrong. Please try again.";
  }
  switch (error.code) {
    case "PAYMENT_PROVIDER_ERROR":
      return "Couldn't reach our payment processor. Please try again.";
    case "RESOURCE_NOT_FOUND":
      return "That plan no longer exists.";
    case "VALIDATION_FAILED":
      return "That plan is not currently available.";
    default:
      return error.message;
  }
}

/**
 * Full-page plan picker used by `/app/billing/change-plan`.
 *
 * Replaces the old `PlanPickerModal`: same selection + checkout behaviour,
 * but as a dedicated server-rendered URL so the user can share or bookmark
 * the flow, and so deep-linking works from the billing page.
 */
export function ChangePlanForm({ currentPlanId }: ChangePlanFormProps) {
  const router = useRouter();
  const { loadingHref, handleNavClick } = useNavigationLoading();

  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const plansQuery = usePlans({ status: "active" });
  const createSession = useCreateCheckoutSession();

  const plans = useMemo(
    () =>
      (plansQuery.data ?? [])
        .filter((p) => p.isPublic !== false)
        .slice()
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [plansQuery.data]
  );

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) ?? null,
    [plans, selectedPlanId]
  );

  function priceForCycle(plan: Plan): number {
    return billingCycle === "yearly"
      ? plan.basePriceYearly
      : plan.basePriceMonthly;
  }

  async function handleSubscribe() {
    if (!selectedPlan) return;
    try {
      const session = await createSession.mutateAsync({
        planId: selectedPlan.id,
        billingCycle,
      });
      if (session.checkoutUrl) {
        window.open(
          resolveCheckoutUrl(session.checkoutUrl),
          "_blank",
          "noopener,noreferrer"
        );
      }
      router.push(`/app/billing/checkout/${session.id}`);
    } catch (err) {
      toast.error(messageForError(err));
    }
  }

  const isNavigatingBack = loadingHref === LIST_HREF;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="min-h-[44px] -ml-2"
              disabled={createSession.isPending}
            >
              <Link
                href={LIST_HREF}
                onClick={() => handleNavClick(LIST_HREF)}
              >
                {isNavigatingBack ? (
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
      </div>

      <PageHeader
        title={currentPlanId ? "Change plan" : "Choose a plan"}
        description="Pick a plan and billing cycle — we'll take you to a secure checkout page."
      />

      <div className="space-y-5">
        {/* Billing cycle toggle */}
        <div
          role="radiogroup"
          aria-label="Billing cycle"
          className="inline-flex rounded-lg border bg-muted/50 p-1"
        >
          {(["monthly", "yearly"] as const).map((cycle) => {
            const active = billingCycle === cycle;
            return (
              <Tooltip key={cycle}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setBillingCycle(cycle)}
                    className={cn(
                      "min-h-[44px] rounded-md px-4 text-sm font-medium transition-colors",
                      active
                        ? "bg-background shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {cycle === "monthly" ? "Monthly" : "Yearly"}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {cycle === "monthly"
                    ? "Bill every month — cancel anytime from your billing page"
                    : "Bill once a year — usually cheaper than the monthly rate"}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Plans list */}
        <div className="space-y-3">
          {plansQuery.isLoading ? (
            <>
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </>
          ) : plans.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No plans are currently available. Please check back later.
            </p>
          ) : (
            plans.map((plan) => {
              const isSelected = plan.id === selectedPlanId;
              const isCurrent = plan.id === currentPlanId;
              const price = priceForCycle(plan);
              return (
                <Tooltip key={plan.id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() =>
                        !isCurrent && setSelectedPlanId(plan.id)
                      }
                      disabled={isCurrent}
                      aria-pressed={isSelected}
                      className={cn(
                        "w-full rounded-lg border p-4 text-left transition-all min-h-[44px]",
                        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                        isSelected &&
                          "border-primary bg-primary/5 ring-2 ring-primary/40",
                        !isSelected &&
                          !isCurrent &&
                          "hover:border-foreground/30",
                        isCurrent && "cursor-not-allowed opacity-60"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">
                              {plan.displayName ?? plan.name}
                            </span>
                            <Badge
                              variant="outline"
                              className="capitalize"
                            >
                              {plan.tier}
                            </Badge>
                            {isCurrent && (
                              <Badge variant="secondary">Current plan</Badge>
                            )}
                          </div>
                          {plan.description && (
                            <p className="text-sm text-muted-foreground">
                              {plan.description}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="font-semibold tabular-nums">
                            {formatCurrency(price * 100, plan.currency)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            per {billingCycle === "yearly" ? "year" : "month"}
                          </div>
                        </div>
                        {isSelected && (
                          <Check
                            className="h-5 w-5 text-primary"
                            aria-hidden="true"
                          />
                        )}
                      </div>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {isCurrent
                      ? "This is your current plan — pick a different one to change your subscription"
                      : `Select the ${plan.displayName ?? plan.name} plan billed ${billingCycle}`}
                  </TooltipContent>
                </Tooltip>
              );
            })
          )}
        </div>

        {/* Summary */}
        {selectedPlan && (
          <div className="rounded-lg border bg-muted/40 p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total today</span>
              <span className="text-base font-semibold tabular-nums">
                {formatCurrency(
                  priceForCycle(selectedPlan) * 100,
                  selectedPlan.currency
                )}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              You&apos;ll be redirected to a secure checkout page to complete
              payment.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                asChild
                disabled={createSession.isPending}
                className="min-h-[44px] w-full sm:w-auto"
              >
                <Link
                  href={LIST_HREF}
                  onClick={() => handleNavClick(LIST_HREF)}
                >
                  Cancel
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Return to billing without starting a checkout
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                onClick={handleSubscribe}
                disabled={!selectedPlan || createSession.isPending}
                className="min-h-[44px] w-full sm:w-auto"
              >
                {createSession.isPending ? (
                  <>
                    <Loader2
                      className="mr-2 h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                    Starting checkout…
                  </>
                ) : (
                  "Continue to checkout"
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Create a checkout session and open a secure payment page in a new
              tab
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
