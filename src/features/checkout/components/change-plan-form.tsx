"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  Check,
  ChevronRight,
  Loader2,
  Mail,
  Minus,
  Plus,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { NavButton } from "@/components/recipes/nav-button";
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
import { useDiscountPreview } from "@/features/discounts/hooks/use-discounts";
import { useClaimTrial } from "@/features/trials/hooks/use-trials";
import type {
  DiscountPreview,
  Plan,
  TrialClaimResponse,
} from "@/types/billing";
import type { BillingCycle, PlanTier } from "@/types/enums";
import { ApiError } from "@/types/api";

type AppliedCode =
  | { kind: "discount"; preview: DiscountPreview }
  | { kind: "trial"; trial: TrialClaimResponse };

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
  /**
   * Plan to preselect on mount — used by the `/app/billing/checkout`
   * deep-link (e.g. from a "discount available" notification). Ignored if it
   * doesn't match an available plan or matches the current plan.
   */
  initialPlanId?: string;
  /**
   * Discount code to auto-apply once a plan is selected — used by the
   * checkout deep-link. Validated through `/discounts/preview`; if it can't be
   * applied the error surfaces in the discount field rather than failing
   * silently.
   */
  initialDiscountCode?: string;
  /** Billing cycle to start on — defaults to monthly. */
  initialBillingCycle?: BillingCycle;
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
    case "TRIAL_NOT_SUPPORTED":
      return "This plan doesn't offer a free trial.";
    case "TRIAL_INVALID":
      return "That trial code is no longer valid.";
    case "TRIAL_ALREADY_USED":
      return "You've already used your free trial on this account.";
    case "DISCOUNT_INVALID":
      return "That discount code can't be used right now (expired, exhausted, or not valid for this plan).";
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
  initialPlanId,
  initialDiscountCode,
  initialBillingCycle,
}: ChangePlanFormProps) {
  const router = useRouter();
  const { loadingHref } = useNavigationLoading();

  const [billingCycle, setBillingCycle] = useState<BillingCycle>(
    initialBillingCycle ?? "monthly"
  );
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  // Discount code carried in from a checkout deep-link, applied once a plan
  // is selected. Cleared after the first apply attempt (success or failure).
  const [pendingDeepLinkCode, setPendingDeepLinkCode] = useState<string | null>(
    initialDiscountCode?.trim() || null
  );
  // Premium plans are priced per location. Default to a single location;
  // tenants who need more bump it before paying. Free/Starter ignore this.
  const [locationCount, setLocationCount] = useState<number>(1);

  // Discount code state. Collapsed by default — most users won't have a
  // code. Trials are not entered here; they are auto-claimed below when
  // the selected plan offers one and the tenant is eligible.
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [appliedCode, setAppliedCode] = useState<AppliedCode | null>(null);
  // Tracks the plan id whose auto-claimed trial the user explicitly
  // dismissed. Prevents the auto-claim effect from re-applying it after
  // every render until the user picks a different plan.
  const [autoTrialDismissedForPlan, setAutoTrialDismissedForPlan] = useState<
    string | null
  >(null);

  const plansQuery = usePlans({ status: "active" });
  const createSession = useCreateCheckoutSession();
  const discountPreview = useDiscountPreview();
  const claimTrial = useClaimTrial();

  // Drop any stale applied code when the plan changes — discount previews
  // are bound to (code, plan, billing_cycle), and a trial from another
  // plan is meaningless here.
  useEffect(() => {
    setAppliedCode(null);
    setCodeError(null);
  }, [selectedPlanId]);

  // Discount previews are bound to billing cycle, so drop one if the
  // cycle changes. Trials don't care about cycle — leave them in place.
  useEffect(() => {
    setAppliedCode((prev) => (prev?.kind === "discount" ? null : prev));
    setCodeError(null);
  }, [billingCycle]);

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

  // Deep-link bootstrap (1/2): preselect the plan passed via the query
  // string. Runs once, after the plans list has loaded so the id can be
  // validated. A plan that doesn't exist or is the current plan is ignored —
  // the user just lands on the picker with nothing selected.
  const deepLinkPlanHandled = useRef(false);
  useEffect(() => {
    if (deepLinkPlanHandled.current) return;
    if (!initialPlanId) {
      deepLinkPlanHandled.current = true;
      return;
    }
    if (plans.length === 0) return; // wait for the list to load
    const target = plans.find((p) => p.id === initialPlanId);
    deepLinkPlanHandled.current = true;
    if (target && target.id !== currentPlanId) {
      setSelectedPlanId(initialPlanId);
    }
  }, [plans, initialPlanId, currentPlanId]);

  // Deep-link bootstrap (2/2): auto-apply the discount code passed via the
  // query string once a plan is selected. Previews are bound to
  // (code, plan, cycle); on failure we open the discount field with the code
  // pre-filled and show the error so the user isn't left wondering.
  useEffect(() => {
    if (!pendingDeepLinkCode) return;
    if (!selectedPlan) return;
    if (appliedCode?.kind === "discount") return;

    let cancelled = false;
    const code = pendingDeepLinkCode;
    const planId = selectedPlan.id;

    discountPreview
      .mutateAsync({ code, planId, billingCycle })
      .then((preview) => {
        if (cancelled) return;
        setAppliedCode({ kind: "discount", preview });
        setPendingDeepLinkCode(null);
        toast.success(`${preview.discount.name} applied.`);
      })
      .catch((err) => {
        if (cancelled) return;
        setCodeOpen(true);
        setCodeInput(code);
        setCodeError(messageForError(err));
        setPendingDeepLinkCode(null);
      });

    return () => {
      cancelled = true;
    };
    // discountPreview.mutateAsync is stable across renders in @tanstack/react-query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingDeepLinkCode, selectedPlan, billingCycle]);

  // Auto-claim a trial the moment a trial-eligible plan is selected.
  // /trials/claim is idempotent for the same (tenant, plan), so this is
  // safe to call once per selection. Eligibility failures
  // (TRIAL_ALREADY_USED, TRIAL_NOT_SUPPORTED, etc.) are swallowed —
  // the user simply proceeds with the paid flow.
  useEffect(() => {
    if (!selectedPlan) return;
    if ((selectedPlan.trialDays ?? 0) <= 0) return;
    if (isEnterprise || isDowngradeSelected) return;
    if (autoTrialDismissedForPlan === selectedPlan.id) return;
    if (appliedCode !== null) return;
    // A deep-linked discount takes precedence — let it resolve first so we
    // don't flash a trial banner that the discount immediately replaces.
    if (pendingDeepLinkCode) return;

    let cancelled = false;
    const planId = selectedPlan.id;

    claimTrial
      .mutateAsync({ planId })
      .then((trial) => {
        if (cancelled) return;
        setAppliedCode({ kind: "trial", trial });
      })
      .catch(() => {
        // Eligibility failure — silently fall back to the paid flow.
      });

    return () => {
      cancelled = true;
    };
    // claimTrial.mutateAsync is stable across renders in @tanstack/react-query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedPlan,
    isEnterprise,
    isDowngradeSelected,
    autoTrialDismissedForPlan,
    appliedCode,
    pendingDeepLinkCode,
  ]);

  function basePriceForCycle(plan: Plan): number {
    return billingCycle === "yearly"
      ? plan.basePriceYearly
      : plan.basePriceMonthly;
  }

  function quotedTotalForCycle(plan: Plan): number {
    const base = basePriceForCycle(plan);
    return plan.tier === "premium" ? base * Math.max(1, locationCount) : base;
  }

  // For the summary, prefer the server-computed price from a discount
  // preview when one is applied (it's authoritative). Trial codes flatten
  // the total to 0 today.
  function totalDueToday(): number {
    if (!selectedPlan) return 0;
    if (appliedCode?.kind === "trial") return 0;
    if (appliedCode?.kind === "discount") {
      // The preview is computed against a single-location base. Premium
      // plans are billed per-location, so scale up if needed. This is a
      // preview only — the server re-runs the full breakdown at checkout.
      const preview = appliedCode.preview;
      const multiplier =
        selectedPlan.tier === "premium" ? Math.max(1, locationCount) : 1;
      return preview.finalPrice * multiplier;
    }
    return quotedTotalForCycle(selectedPlan);
  }

  function previewDiscountSavings(): number {
    if (appliedCode?.kind !== "discount" || !selectedPlan) return 0;
    const multiplier =
      selectedPlan.tier === "premium" ? Math.max(1, locationCount) : 1;
    return appliedCode.preview.discountAmount * multiplier;
  }

  // Drop the applied discount and clear the code field.
  function resetAppliedDiscount() {
    setAppliedCode(null);
    setCodeInput("");
    setCodeError(null);
  }

  // Drop the auto-applied trial and remember the dismissal so the
  // auto-claim effect doesn't reinstate it on the next render.
  function dismissAutoTrial() {
    if (selectedPlan) {
      setAutoTrialDismissedForPlan(selectedPlan.id);
    }
    setAppliedCode(null);
  }

  async function handleApplyDiscountCode() {
    const code = codeInput.trim();
    if (!code) {
      setCodeError("Enter a discount code.");
      return;
    }
    if (!selectedPlan) {
      setCodeError("Pick a plan first — discount codes are validated against the plan.");
      return;
    }
    setCodeError(null);

    try {
      const preview = await discountPreview.mutateAsync({
        code,
        planId: selectedPlan.id,
        billingCycle,
      });
      setAppliedCode({ kind: "discount", preview });
      setCodeInput("");
      toast.success(`${preview.discount.name} applied.`);
    } catch (err) {
      setCodeError(messageForError(err));
    }
  }

  async function runCheckout(opts: {
    trialCode?: string;
    discountIds?: string[];
  }) {
    if (!selectedPlan) return;
    try {
      const session = await createSession.mutateAsync({
        planId: selectedPlan.id,
        billingCycle,
        ...(opts.trialCode ? { trialCode: opts.trialCode } : {}),
        ...(opts.discountIds && opts.discountIds.length > 0
          ? { discountIds: opts.discountIds }
          : {}),
        ...(isPremium
          ? { metadata: { location_count: Math.max(1, locationCount) } }
          : {}),
      });
      if (session.checkoutUrl) {
        window.open(
          resolveCheckoutUrl(session.checkoutUrl),
          "_blank",
          "noopener,noreferrer",
        );
      }
      router.push(`/app/billing/checkout/${session.id}`);
    } catch (err) {
      toast.error(messageForError(err));
    }
  }

  async function handleSubscribe() {
    if (!selectedPlan || isEnterprise || isDowngradeSelected) return;
    if (appliedCode?.kind === "trial") {
      await runCheckout({ trialCode: appliedCode.trial.code });
      return;
    }
    if (appliedCode?.kind === "discount") {
      await runCheckout({ discountIds: [appliedCode.preview.discount.id] });
      return;
    }
    await runCheckout({});
  }

  const codePending = discountPreview.isPending;

  const isNavigatingBack = loadingHref === LIST_HREF;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Tooltip>
          <TooltipTrigger asChild>
            <NavButton
              href={LIST_HREF}
              variant="ghost"
              size="sm"
              className="min-h-[44px] -ml-2"
              disabled={createSession.isPending}
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
            </NavButton>
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
                            {(plan.trialDays ?? 0) > 0 && !isCurrent && (
                              <Badge
                                variant="outline"
                                className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                              >
                                {plan.trialDays}-day free trial
                              </Badge>
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
                  from your organization. To avoid surprises we don&apos;t support
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
                  <NavButton
                    href={LIST_HREF}
                    variant="outline"
                    className="min-h-[44px] w-full sm:w-auto"
                  >
                    Back to billing to cancel instead
                  </NavButton>
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

        {/* Auto-applied trial banner (no input — trials are claimed
            automatically when a trial-eligible plan is selected) */}
        {selectedPlan &&
          !isEnterprise &&
          !isDowngradeSelected &&
          appliedCode?.kind === "trial" && (
            <div className="rounded-lg border bg-card p-4">
              <AppliedTrialCard
                trial={appliedCode.trial}
                onRemove={dismissAutoTrial}
              />
            </div>
          )}

        {/* Discount code (optional, collapsed by default) */}
        {selectedPlan && !isEnterprise && !isDowngradeSelected && (
          <div className="rounded-lg border bg-card p-4">
            {appliedCode?.kind === "discount" ? (
              <AppliedDiscountCard
                preview={appliedCode.preview}
                onRemove={resetAppliedDiscount}
              />
            ) : codeOpen ? (
              <div className="space-y-2">
                <label
                  htmlFor="checkout-code"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Discount code
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="checkout-code"
                    value={codeInput}
                    onChange={(event) => {
                      setCodeInput(event.target.value);
                      if (codeError) setCodeError(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void handleApplyDiscountCode();
                      }
                    }}
                    placeholder="e.g. LAUNCH20"
                    autoComplete="off"
                    spellCheck={false}
                    className="min-h-[44px] flex-1 font-mono text-sm uppercase tracking-wider"
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        onClick={handleApplyDiscountCode}
                        disabled={!codeInput.trim() || codePending}
                        className="min-h-[44px] sm:w-auto"
                      >
                        {codePending ? (
                          <>
                            <Loader2
                              className="mr-2 h-4 w-4 animate-spin"
                              aria-hidden="true"
                            />
                            Checking…
                          </>
                        ) : (
                          "Apply"
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      Validate this discount code and apply it to the selected plan
                    </TooltipContent>
                  </Tooltip>
                </div>
                {codeError && (
                  <p
                    className="text-xs text-destructive"
                    role="alert"
                    aria-live="polite"
                  >
                    {codeError}
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Discount codes are only consumed when payment completes — you
                  can remove one before checking out.
                </p>
              </div>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setCodeOpen(true)}
                    className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    Have a discount code?
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Expand the discount code field — totally optional
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        )}

        {/* Summary */}
        {selectedPlan && !isEnterprise && !isDowngradeSelected && (
          <div className="rounded-lg border bg-muted/40 p-4 text-sm">
            {appliedCode?.kind === "trial" ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {appliedCode.trial.trialDays}-day free trial
                  </span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    Free
                  </span>
                </div>
                <div className="flex items-center justify-between border-t pt-2">
                  <span className="font-medium">Due today</span>
                  <span className="text-base font-semibold tabular-nums">
                    {formatCurrency(0, selectedPlan.currency)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  After your trial ends, your saved payment method will be
                  charged{" "}
                  {formatCurrency(
                    quotedTotalForCycle(selectedPlan) * 100,
                    selectedPlan.currency,
                  )}{" "}
                  per {billingCycle === "yearly" ? "year" : "month"}. Cancel
                  any time from the billing page.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {isPremium
                      ? `Subtotal (${locationCount} location${locationCount === 1 ? "" : "s"})`
                      : "Subtotal"}
                  </span>
                  <span className="tabular-nums">
                    {formatCurrency(
                      quotedTotalForCycle(selectedPlan) * 100,
                      selectedPlan.currency,
                    )}
                  </span>
                </div>
                {appliedCode?.kind === "discount" && (
                  <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                    <span>
                      Discount ({appliedCode.preview.discount.code})
                    </span>
                    <span className="tabular-nums">
                      −
                      {formatCurrency(
                        previewDiscountSavings() * 100,
                        selectedPlan.currency,
                      )}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t pt-2">
                  <span className="font-medium">Total today</span>
                  <span className="text-base font-semibold tabular-nums">
                    {formatCurrency(
                      Math.max(0, totalDueToday()) * 100,
                      selectedPlan.currency,
                    )}
                  </span>
                </div>
              </div>
            )}
            {isPremium && (
              <p className="mt-2 text-xs text-muted-foreground">
                {formatCurrency(
                  basePriceForCycle(selectedPlan) * 100,
                  selectedPlan.currency,
                )}{" "}
                per location, billed {billingCycle}.
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              You&apos;ll be redirected to a secure checkout page to complete
              payment. The final total — including any taxes — is calculated
              by our payment processor.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <NavButton
                href={LIST_HREF}
                variant="outline"
                disabled={createSession.isPending}
                className="min-h-[44px] w-full sm:w-auto"
              >
                Cancel
              </NavButton>
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
                  ) : appliedCode?.kind === "trial" ? (
                    "Start trial checkout"
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

function AppliedDiscountCard({
  preview,
  onRemove,
}: {
  preview: DiscountPreview;
  onRemove: () => void;
}) {
  const { discount } = preview;
  const offDescriptor =
    discount.discountType === "percentage"
      ? `${discount.value}% off`
      : `${formatCurrency(discount.value * 100, preview.currency)} off`;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Tag className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {discount.name}{" "}
          <span className="font-mono text-xs text-muted-foreground">
            ({discount.code})
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          {offDescriptor} — final price{" "}
          <span className="font-medium text-foreground tabular-nums">
            {formatCurrency(preview.finalPrice * 100, preview.currency)}
          </span>{" "}
          per {preview.billingCycle === "yearly" ? "year" : "month"}
        </p>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            aria-label="Remove discount"
            className="h-9 w-9 text-muted-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          Remove this discount and pay the full plan price
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

function AppliedTrialCard({
  trial,
  onRemove,
}: {
  trial: TrialClaimResponse;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {trial.trialDays}-day free trial of{" "}
          {trial.planDisplayName || trial.planName}{" "}
          <span className="font-mono text-xs text-muted-foreground">
            ({trial.code})
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          No charge today. Your trial is only redeemed once payment details
          are confirmed at checkout.
        </p>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            aria-label="Remove trial"
            className="h-9 w-9 text-muted-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          Drop this trial and continue without one
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
