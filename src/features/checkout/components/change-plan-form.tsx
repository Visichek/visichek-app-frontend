"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  Check,
  Loader2,
  Mail,
  Minus,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { BillingCycle, PlanTier } from "@/types/enums";
import { ApiError } from "@/types/api";

const LIST_HREF = "/app/billing";
const SALES_EMAIL = "sales@visichek.app";
const SUPPORT_EMAIL = "support@visichek.app";

// Used to detect downgrades. Free is lowest, Enterprise highest. Legacy
// tiers slot below Enterprise so an existing `professional`/`custom`
// tenant moving to Premium isn't classified as a downgrade.
const TIER_RANK: Record<PlanTier, number> = {
  free: 0,
  starter: 1,
  premium: 2,
  professional: 2,
  custom: 2,
  enterprise: 3,
};

function isDowngrade(currentTier?: PlanTier, targetTier?: PlanTier): boolean {
  if (!currentTier || !targetTier) return false;
  return TIER_RANK[targetTier] < TIER_RANK[currentTier];
}

export interface ChangePlanFormProps {
  /** Currently active plan id — highlighted and disabled in the picker. */
  currentPlanId?: string;
  /** Currently active tier — used to detect downgrades. */
  currentPlanTier?: PlanTier;
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
export function ChangePlanForm({
  currentPlanId,
  currentPlanTier,
}: ChangePlanFormProps) {
  const router = useRouter();
  const { loadingHref, handleNavClick } = useNavigationLoading();

  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  // Premium plans are priced per location. Default to a single location;
  // tenants who need more bump it before paying. Free/Starter ignore this.
  const [locationCount, setLocationCount] = useState<number>(1);

  const plansQuery = usePlans({ status: "active" });
  const createSession = useCreateCheckoutSession();

  const plans = useMemo(
    () =>
      (plansQuery.data?.items ?? [])
        // Hide the FREE plan from the picker — to drop to Free a tenant
        // cancels their subscription, they don't "subscribe" to it.
        .filter((p) => p.isPublic !== false && p.tier !== "free")
        .slice()
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [plansQuery.data]
  );

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) ?? null,
    [plans, selectedPlanId]
  );

  const isPremium = selectedPlan?.tier === "premium";
  const isEnterprise = selectedPlan?.tier === "enterprise";
  const isDowngradeSelected = isDowngrade(
    currentPlanTier,
    selectedPlan?.tier as PlanTier | undefined,
  );

  function basePriceForCycle(plan: Plan): number {
    return billingCycle === "yearly"
      ? plan.basePriceYearly
      : plan.basePriceMonthly;
  }

  function quotedTotalForCycle(plan: Plan): number {
    const base = basePriceForCycle(plan);
    return plan.tier === "premium" ? base * Math.max(1, locationCount) : base;
  }

  async function handleSubscribe() {
    if (!selectedPlan || isEnterprise || isDowngradeSelected) return;
    try {
      const session = await createSession.mutateAsync({
        planId: selectedPlan.id,
        billingCycle,
        ...(isPremium
          ? { metadata: { location_count: Math.max(1, locationCount) } }
          : {}),
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
              const price = basePriceForCycle(plan);
              const planIsEnterprise = plan.tier === "enterprise";
              const planIsPremium = plan.tier === "premium";
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
                          {planIsEnterprise ? (
                            <>
                              <div className="font-semibold tabular-nums">
                                Custom
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Talk to sales
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="font-semibold tabular-nums">
                                {formatCurrency(price * 100, plan.currency)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                per{" "}
                                {billingCycle === "yearly" ? "year" : "month"}
                                {planIsPremium ? " / location" : ""}
                              </div>
                            </>
                          )}
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
                      : planIsEnterprise
                        ? "Enterprise pricing is custom — select to see how to contact our sales team"
                        : `Select the ${plan.displayName ?? plan.name} plan billed ${billingCycle}`}
                  </TooltipContent>
                </Tooltip>
              );
            })
          )}
        </div>

        {/* Premium per-location picker */}
        {selectedPlan && isPremium && (
          <div className="space-y-2 rounded-lg border bg-muted/40 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">Number of locations</p>
                <p className="text-xs text-muted-foreground">
                  Premium is billed per location. Each location includes the
                  plan&apos;s monthly visitor and department caps.
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-11 w-11"
                      aria-label="Decrease location count"
                      disabled={locationCount <= 1}
                      onClick={() =>
                        setLocationCount((n) => Math.max(1, n - 1))
                      }
                    >
                      <Minus className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    Reduce the number of locations on this checkout
                  </TooltipContent>
                </Tooltip>
                <Input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={locationCount}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setLocationCount(Number.isFinite(v) && v > 0 ? v : 1);
                  }}
                  className="h-11 w-16 text-center"
                  aria-label="Locations"
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-11 w-11"
                      aria-label="Increase location count"
                      onClick={() => setLocationCount((n) => n + 1)}
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    Add another location to this checkout
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        )}

        {/* Downgrade panel — backed by /v1/subscriptions/change-plan, but
            that endpoint is application-admin only. Tenant-driven downgrades
            need a human in the loop because they can deactivate non-HQ
            branches and disable paid features mid-period. */}
        {selectedPlan && isDowngradeSelected && (
          <div className="space-y-3 rounded-lg border border-amber-300/60 bg-amber-50 p-4 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
            <div className="flex items-start gap-2">
              <ArrowDown
                className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
                aria-hidden="true"
              />
              <div className="space-y-1">
                <p className="font-medium">
                  This is a downgrade from {currentPlanTier} to{" "}
                  {selectedPlan.tier}
                </p>
                <p className="text-muted-foreground">
                  Downgrading mid-period can deactivate non-HQ branches and
                  remove paid features (KYC, branding, exports, multi-location)
                  from your tenant. To avoid surprises we don&apos;t support
                  self-service downgrades. Contact support and we&apos;ll
                  schedule the move with you.
                </p>
                <p className="text-muted-foreground">
                  If you only want to stop being billed, cancel your
                  subscription from the billing page instead — you keep paid
                  features until the end of the period and drop to Free
                  automatically.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button asChild className="min-h-[44px] w-full sm:w-auto">
                    <a
                      href={`mailto:${SUPPORT_EMAIL}?subject=Downgrade%20request`}
                    >
                      <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
                      Email {SUPPORT_EMAIL}
                    </a>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Open your email client with a pre-filled message asking
                  support to schedule the downgrade.
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    asChild
                    className="min-h-[44px] w-full sm:w-auto"
                  >
                    <Link
                      href={LIST_HREF}
                      onClick={() => handleNavClick(LIST_HREF)}
                    >
                      Back to billing to cancel instead
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Return to billing where you can cancel your subscription —
                  you&apos;ll drop to Free at the end of the period.
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        )}

        {/* Enterprise contact-sales panel */}
        {selectedPlan && isEnterprise && (
          <div className="space-y-3 rounded-lg border bg-muted/40 p-4 text-sm">
            <p className="font-medium">Enterprise is sales-led</p>
            <p className="text-muted-foreground">
              Pricing, SSO, watchlists, on-prem, biometrics and dedicated SLA
              are tailored to your deployment. Reach out and we&apos;ll set up
              a call.
            </p>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button asChild className="min-h-[44px] w-full sm:w-auto">
                  <a
                    href={`mailto:${SALES_EMAIL}?subject=Enterprise%20plan%20enquiry`}
                  >
                    <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
                    Email {SALES_EMAIL}
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                Open your email client with a pre-filled message to our sales
                team
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Summary */}
        {selectedPlan && !isEnterprise && !isDowngradeSelected && (
          <div className="rounded-lg border bg-muted/40 p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                {isPremium
                  ? `Total today (${locationCount} location${locationCount === 1 ? "" : "s"})`
                  : "Total today"}
              </span>
              <span className="text-base font-semibold tabular-nums">
                {formatCurrency(
                  quotedTotalForCycle(selectedPlan) * 100,
                  selectedPlan.currency
                )}
              </span>
            </div>
            {isPremium && (
              <p className="mt-1 text-xs text-muted-foreground">
                {formatCurrency(
                  basePriceForCycle(selectedPlan) * 100,
                  selectedPlan.currency
                )}{" "}
                per location, billed {billingCycle}.
              </p>
            )}
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

          {!isEnterprise && !isDowngradeSelected && (
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
                Create a checkout session and open a secure payment page in a
                new tab
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
}
