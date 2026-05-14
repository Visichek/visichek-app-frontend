"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ExternalLink,
  CreditCard,
  Loader2,
  AlertTriangle,
  XCircle,
  Info,
} from "lucide-react";
import { PageHeader } from "@/components/recipes/page-header";
import { NavButton } from "@/components/recipes/nav-button";
import { StatCard } from "@/components/recipes/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DataTable } from "@/components/recipes/data-table";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { useSession } from "@/hooks/use-session";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { useMyUsage } from "@/features/usage/hooks/use-usage";
import { useTenantInvoices } from "@/features/invoices/hooks/use-invoices";
import { useActiveSubscription } from "@/features/subscriptions/hooks/use-subscriptions";
import { CheckoutHistoryTable } from "@/features/checkout/components/checkout-history-table";
import { CancelSubscriptionDialog } from "@/features/subscriptions/components/cancel-subscription-dialog";
import { formatCurrency } from "@/lib/utils/format-currency";
import { formatDate } from "@/lib/utils/format-date";
import type { Invoice } from "@/types/billing";
import type { InvoiceStatus, SubscriptionStatus } from "@/types/enums";

const CHANGE_PLAN_HREF = "/app/billing/change-plan";

function getInvoiceStatusVariant(status: InvoiceStatus): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "paid":
      return "secondary";
    case "issued":
      return "default";
    case "draft":
      return "outline";
    case "void":
    case "refunded":
      return "destructive";
    default:
      return "default";
  }
}

function formatInvoiceStatus(status: InvoiceStatus): string {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatSubscriptionStatus(status: SubscriptionStatus | string): string {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function subscriptionStatusVariant(
  status: SubscriptionStatus | string,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "active":
      return "secondary";
    case "trialing":
      return "default";
    case "past_due":
      return "destructive";
    case "cancelled":
    case "expired":
    case "suspended":
      return "destructive";
    default:
      return "outline";
  }
}

export function BillingPageClient() {
  const { tenantId, currentRole } = useSession();
  const { loadingHref, handleNavClick } = useNavigationLoading();
  const canManageBilling = currentRole === "super_admin";
  const [cancelOpen, setCancelOpen] = useState(false);

  const {
    data: usage,
    isLoading: usageLoading,
    isError: usageError,
    error: usageErrorObj,
    refetch: refetchUsage,
  } = useMyUsage();

  const INVOICES_PAGE_SIZE = 25;
  const [invoicesPageIndex, setInvoicesPageIndex] = useState(0);

  const {
    data: invoicesResponse,
    isLoading: invoicesLoading,
    refetch: refetchInvoices,
  } = useTenantInvoices(tenantId || "", {
    skip: invoicesPageIndex * INVOICES_PAGE_SIZE,
    limit: INVOICES_PAGE_SIZE,
  });

  const { data: activeSubscription } = useActiveSubscription(
    canManageBilling ? tenantId || "" : ""
  );

  const invoices = useMemo(() => invoicesResponse?.items ?? [], [invoicesResponse]);
  const invoicesMeta = invoicesResponse?.meta;

  const columns = useMemo<ColumnDef<Invoice>[]>(
    () => [
      {
        accessorKey: "invoiceNumber",
        header: "Invoice Number",
        cell: ({ row }) => row.original.invoiceNumber || "—",
      },
      {
        accessorKey: "totalMinor",
        header: "Amount",
        cell: ({ row }) =>
          formatCurrency(row.original.totalMinor, row.original.currency),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={getInvoiceStatusVariant(row.original.status)}>
            {formatInvoiceStatus(row.original.status)}
          </Badge>
        ),
      },
      {
        accessorKey: "issuedAt",
        header: "Issued Date",
        cell: ({ row }) =>
          row.original.issuedAt ? formatDate(row.original.issuedAt) : "—",
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="h-8 gap-2"
                disabled={!row.original.pdfUrl}
              >
                <a
                  href={row.original.pdfUrl || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span className="hidden sm:inline">View PDF</span>
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {row.original.pdfUrl
                ? "Open this invoice PDF in a new tab"
                : "A PDF is not available for this invoice yet"}
            </TooltipContent>
          </Tooltip>
        ),
      },
    ],
    []
  );

  if (usageLoading || !tenantId) {
    return <PageSkeleton />;
  }

  if (usageError) {
    return (
      <ErrorState
        title="Failed to load billing information"
        error={usageErrorObj}
        onRetry={() => {
          refetchUsage();
          refetchInvoices();
        }}
      />
    );
  }

  const hasActiveSubscription =
    activeSubscription?.status === "active" ||
    activeSubscription?.status === "trialing";

  const planTier = (usage?.planTier ?? "").toLowerCase();
  const isOnFree = planTier === "free";
  const isOnPaid =
    !isOnFree &&
    !!planTier &&
    hasActiveSubscription &&
    activeSubscription !== undefined;

  // The backend marks a sub `cancelled` when end-of-period cancel is queued
  // but `current_period_end` is still in the future. While that's true we
  // surface a "scheduled to end" notice instead of the generic state copy.
  const subStatus = activeSubscription?.status;
  const periodEnd = activeSubscription?.currentPeriodEnd;
  const periodEndDate = periodEnd ? formatDate(periodEnd) : null;
  const periodEndInFuture =
    typeof periodEnd === "number" && periodEnd * 1000 > Date.now();
  const scheduledToEnd =
    subStatus === "cancelled" && periodEndInFuture;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        <PageHeader
          title="Billing & Usage"
          description="View your subscription plan, usage, and invoices"
          actions={
            canManageBilling ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                {isOnPaid && !scheduledToEnd && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        className="min-h-[44px] gap-2"
                        onClick={() => setCancelOpen(true)}
                      >
                        <XCircle className="h-4 w-4" aria-hidden="true" />
                        Cancel subscription
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      Open the cancellation dialog. You can drop to Free
                      immediately or wait until the end of the billing
                      period.
                    </TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <NavButton href={CHANGE_PLAN_HREF} className="min-h-[44px] gap-2">
                      {loadingHref === CHANGE_PLAN_HREF ? (
                        <Loader2
                          className="h-4 w-4 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <CreditCard
                          className="h-4 w-4"
                          aria-hidden="true"
                        />
                      )}
                      {isOnFree
                        ? "Upgrade plan"
                        : hasActiveSubscription
                          ? "Change plan"
                          : "Subscribe"}
                    </NavButton>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {isOnFree
                      ? "See paid plans and start a secure checkout"
                      : hasActiveSubscription
                        ? "Pick a different plan and start a new checkout"
                        : "Pick a plan and start a secure checkout"}
                  </TooltipContent>
                </Tooltip>
              </div>
            ) : null
          }
        />

        {/* Subscription state banners — surface drop-to-FREE, scheduled
            cancel, past_due dunning. The backend never leaves a tenant
            without an active sub: dunning failures auto-provision the FREE
            plan, so a tenant landing on Free with prior paid invoices
            usually means the most recent payment failed. */}
        {isOnFree && (invoices.length > 0 || hasActiveSubscription) && (
          <BillingBanner
            tone="warning"
            icon={
              <AlertTriangle
                className="mt-0.5 h-5 w-5 text-amber-500"
                aria-hidden="true"
              />
            }
            title="You're on the Free plan"
            body={
              invoices.length > 0
                ? "If your last payment failed we automatically dropped you to Free so the app keeps working. Non-HQ branches were deactivated and paid features are off until you re-subscribe."
                : "Paid features (multi-location, branding, KYC, exports, appointments) are off until you upgrade."
            }
          />
        )}

        {scheduledToEnd && periodEndDate && (
          <BillingBanner
            tone="info"
            icon={
              <Info
                className="mt-0.5 h-5 w-5 text-sky-500"
                aria-hidden="true"
              />
            }
            title="Subscription scheduled to end"
            body={
              <>
                Your paid features stay on until{" "}
                <strong>{periodEndDate}</strong>, after which you&apos;ll
                drop to the Free plan automatically. You can re-upgrade
                before then to keep things running.
              </>
            }
          />
        )}

        {subStatus === "past_due" && (
          <BillingBanner
            tone="destructive"
            icon={
              <AlertTriangle
                className="mt-0.5 h-5 w-5 text-destructive"
                aria-hidden="true"
              />
            }
            title="Payment past due"
            body="We couldn't collect your latest payment. We'll keep retrying for a few days; if every attempt fails the subscription drops to the Free plan automatically. Update payment by upgrading again."
          />
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatCard
            title="Current Plan"
            value={usage?.planName ?? "—"}
            description="Active subscription plan"
          />
          <StatCard
            title="Plan Tier"
            value={
              usage?.planTier
                ? usage.planTier.charAt(0).toUpperCase() +
                  usage.planTier.slice(1)
                : "—"
            }
            description="Your plan level"
          />
          <StatCard
            title="Subscription Status"
            value={
              usage?.subscriptionStatus
                ? formatSubscriptionStatus(usage.subscriptionStatus)
                : "—"
            }
            description={
              periodEndDate && hasActiveSubscription
                ? `Renews ${periodEndDate}`
                : "Current subscription state"
            }
          />
        </div>

        {activeSubscription && canManageBilling && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-lg">Subscription</CardTitle>
              <Badge
                variant={subscriptionStatusVariant(activeSubscription.status)}
                className="capitalize"
              >
                {formatSubscriptionStatus(activeSubscription.status)}
              </Badge>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Billing cycle</dt>
                  <dd className="font-medium capitalize">
                    {activeSubscription.billingCycle}
                  </dd>
                </div>
                {typeof activeSubscription.effectivePrice === "number" && (
                  <div>
                    <dt className="text-muted-foreground">Effective price</dt>
                    <dd className="font-medium tabular-nums">
                      {formatCurrency(
                        activeSubscription.effectivePrice * 100,
                        activeSubscription.currency || "NGN",
                      )}
                    </dd>
                  </div>
                )}
                {periodEndDate && (
                  <div>
                    <dt className="text-muted-foreground">
                      {scheduledToEnd ? "Ends on" : "Next renewal"}
                    </dt>
                    <dd className="font-medium">{periodEndDate}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>
        )}

        {usage?.storage &&
          (typeof usage.storage.documentsUsed === "number" ||
            typeof usage.storage.storageMbUsed === "number") && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Storage</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {typeof usage.storage.documentsUsed === "number" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Documents</span>
                      <span className="text-sm text-muted-foreground">
                        {usage.storage.documentsUsed}
                        {usage.storage.documentsLimit != null &&
                          ` / ${usage.storage.documentsLimit}`}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{
                          width:
                            usage.storage.documentsLimit &&
                            usage.storage.documentsLimit > 0
                              ? `${Math.min(
                                  (usage.storage.documentsUsed /
                                    usage.storage.documentsLimit) *
                                    100,
                                  100
                                )}%`
                              : "0%",
                        }}
                      />
                    </div>
                  </div>
                )}

                {typeof usage.storage.storageMbUsed === "number" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Storage</span>
                      <span className="text-sm text-muted-foreground">
                        {usage.storage.storageMbUsed.toFixed(1)} MB
                        {usage.storage.storageMbLimit != null &&
                          ` / ${usage.storage.storageMbLimit} MB`}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{
                          width:
                            usage.storage.storageMbLimit &&
                            usage.storage.storageMbLimit > 0
                              ? `${Math.min(
                                  (usage.storage.storageMbUsed /
                                    usage.storage.storageMbLimit) *
                                    100,
                                  100
                                )}%`
                              : "0%",
                        }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              data={invoices}
              isLoading={invoicesLoading}
              pagination={true}
              serverPagination={{
                pageIndex: invoicesPageIndex,
                pageSize: INVOICES_PAGE_SIZE,
                totalCount: invoicesMeta?.total ?? null,
                onPageChange: setInvoicesPageIndex,
              }}
              emptyTitle="No invoices"
              emptyDescription="You don't have any invoices yet."
            />
          </CardContent>
        </Card>

        {canManageBilling && <CheckoutHistoryTable />}
      </div>

      {canManageBilling && tenantId && (
        <CancelSubscriptionDialog
          open={cancelOpen}
          onOpenChange={setCancelOpen}
          tenantId={tenantId}
          periodEnd={activeSubscription?.currentPeriodEnd}
          planLabel={usage?.planName}
        />
      )}
    </TooltipProvider>
  );
}

function BillingBanner({
  tone,
  icon,
  title,
  body,
}: {
  tone: "info" | "warning" | "destructive";
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
}) {
  const toneClass =
    tone === "destructive"
      ? "border-destructive/40 bg-destructive/5"
      : tone === "warning"
        ? "border-amber-300/60 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10"
        : "border-sky-300/60 bg-sky-50 dark:border-sky-500/30 dark:bg-sky-500/10";
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-4 text-sm ${toneClass}`}
      role="status"
    >
      {icon}
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}
